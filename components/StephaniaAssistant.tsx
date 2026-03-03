
import React, { useState, useRef, useEffect } from 'react';
import { getStephaniaResponse, ai, encodeAudio, decodeAudio, decodeAudioData, EXPERT_SYSTEM_PROMPT } from '../services/geminiService';
import { UserData } from '../types';
import { Modality } from '@google/genai';

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: any[];
}

const SUGGESTED_QUESTIONS = [
  "What is the Homestead Exemption?",
  "Tell me about 'Rightsizing'",
  "What are Florida Doc Stamps?",
  "How can I save on taxes?"
];

export const StephaniaAssistant: React.FC<{ userData?: UserData }> = ({ userData }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hello, I'm Stephania. I am your Transition Advocate, trained in South Florida real estate regulations and senior housing needs. I'm here to provide verified facts from our local county and government records to ensure your equity is protected. How can I assist with your planning today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const stopVoice = () => {
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    setIsVoiceActive(false);
    setIsSpeaking(false);
    setIsListening(false);
  };

  const startVoice = async () => {
    try {
      setIsVoiceActive(true);
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const blob = { data: encodeAudio(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(session => session.sendRealtimeInput({ media: blob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
            setIsListening(true);
          },
          onmessage: async (message) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              setIsSpeaking(true);
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const audioBuffer = await decodeAudioData(decodeAudio(base64Audio), outputCtx, 24000, 1);
              const sourceNode = outputCtx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(outputCtx.destination);
              sourceNode.onended = () => {
                sourcesRef.current.delete(sourceNode);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
              sourceNode.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(sourceNode);
            }
          },
          onclose: () => setIsVoiceActive(false),
          onerror: () => setIsVoiceActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: EXPERT_SYSTEM_PROMPT
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsVoiceActive(false);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const msg = textOverride || input;
    if (!msg.trim() || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const response = await getStephaniaResponse(msg, history, userData);
      setMessages(prev => [...prev, { role: 'model', text: response.text || "I'm here for you. Could you repeat that?", sources: response.sources }]);
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I lost my connection for a second. I'm ready to listen now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[750px] border border-blue-50 relative">
      {/* Compassionate Header */}
      <div className="bg-blue-900 p-8 text-white flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <div className="w-16 h-16 rounded-full bg-blue-400 border-4 border-white flex items-center justify-center text-4xl shadow-lg">👩‍💼</div>
          <div>
            <h3 className="text-3xl font-bold tracking-tight">Stephania</h3>
            <p className="text-blue-200 text-lg italic font-medium">Expert Real Estate Mind</p>
          </div>
        </div>
        
        <button 
          onClick={isVoiceActive ? stopVoice : startVoice}
          className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all shadow-xl ${isVoiceActive ? 'bg-red-500 hover:bg-red-600 scale-110' : 'bg-emerald-500 hover:bg-emerald-600'}`}
        >
          <span className="text-3xl">{isVoiceActive ? '⏹' : '🎤'}</span>
          <span className="text-[10px] font-black uppercase mt-1">{isVoiceActive ? 'Stop' : 'Voice'}</span>
        </button>
      </div>

      {isVoiceActive && (
        <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-lg flex flex-col items-center justify-center p-12 text-center">
           <div className="relative mb-8">
              <div className={`absolute inset-0 bg-blue-500/30 rounded-full animate-ping ${isSpeaking ? 'opacity-100' : 'opacity-0'}`}></div>
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-2xl border-4 ${isSpeaking ? 'bg-blue-600 border-blue-400' : 'bg-slate-700 border-slate-600'}`}>
                {isSpeaking ? '🔊' : '👂'}
              </div>
           </div>
           <h2 className="text-3xl font-black text-white mb-2">{isSpeaking ? "Stephania is Speaking..." : "Listening..."}</h2>
           <p className="text-slate-400 senior-accessible-text mb-10">We can take as much time as you need.</p>
           <button onClick={stopVoice} className="bg-white text-slate-900 px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl">Go Back to Typing</button>
        </div>
      )}

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-[2rem] p-6 senior-accessible-text shadow-sm ${m.role === 'user' ? 'bg-blue-700 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'}`}>
              {m.text}
            </div>
            {m.sources && m.sources.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 px-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter self-center mr-1">Verified Sources:</span>
                {m.sources.map((s, idx) => s.web && (
                  <a key={idx} href={s.web.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold bg-white text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-50 transition-all shadow-sm">
                    {s.web.title || "Government Record"}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-blue-700 rounded-2xl px-6 py-4 animate-pulse font-black border border-blue-50 shadow-sm text-lg flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
              Consulting county records...
            </div>
          </div>
        )}
      </div>

      {/* Suggested Questions Area */}
      <div className="px-8 py-3 bg-white border-t border-slate-50 overflow-x-auto whitespace-nowrap flex space-x-2 no-scrollbar">
        {SUGGESTED_QUESTIONS.map((q, i) => (
          <button key={i} onClick={() => handleSend(q)} className="inline-block px-5 py-2.5 bg-blue-50 text-blue-800 rounded-xl text-base font-bold border border-blue-100 hover:bg-blue-100 transition-all">
            {q}
          </button>
        ))}
      </div>

      {/* Senior-Accessible Input */}
      <div className="p-8 bg-white border-t border-slate-100">
        <div className="flex space-x-3">
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me a question..." className="flex-1 border-2 border-slate-100 rounded-[1.5rem] px-6 py-5 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-xl font-medium"
          />
          <button onClick={() => handleSend()} disabled={isLoading} className="bg-blue-700 text-white px-10 py-5 rounded-[1.5rem] hover:bg-blue-800 transition-all disabled:opacity-50 font-black uppercase tracking-widest text-base shadow-lg">Send</button>
        </div>
      </div>
    </div>
  );
};
