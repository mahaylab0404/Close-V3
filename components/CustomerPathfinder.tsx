
import React, { useState } from 'react';
import { UserData, PersonalizedAdvice } from '../types';
import { getPersonalizedAdvice } from '../services/geminiService';

export const CustomerPathfinder: React.FC = () => {
  const [formData, setFormData] = useState<UserData>({
    intent: 'sell',
    reason: 'downsizing',
    condition: 'good',
    urgency: 'medium',
    location: '',
    emotionalReadiness: 'ready'
  });
  const [advice, setAdvice] = useState<PersonalizedAdvice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const result = await getPersonalizedAdvice(formData);
      setAdvice(Array.isArray(result) ? result : []);
    } catch (e) {
      console.error(e);
      setAdvice([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-2xl border border-blue-50 overflow-hidden">
      <div className="bg-blue-800 p-12 text-white">
        <h2 className="text-4xl font-bold tracking-tight">Your Personalized {formData.intent === 'buy' ? 'Buying' : 'Sale'} Pathfinder</h2>
        <p className="text-blue-100 mt-4 text-xl senior-accessible-text"> 
          Every transition is unique. Whether you're looking for your next home or moving on from your current one, 
          we'll build a custom guide using SRES® methodology and Florida-specific insights.
        </p>

        {/* Intent Toggle */}
        <div className="mt-8 flex bg-blue-900/50 p-1 rounded-2xl w-fit">
          <button 
            onClick={() => {
              setFormData({...formData, intent: 'sell', reason: 'downsizing'});
              setAdvice([]);
            }}
            className={`px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${formData.intent === 'sell' ? 'bg-white text-blue-900 shadow-lg' : 'text-blue-200 hover:text-white'}`}
          >
            I want to Sell
          </button>
          <button 
            onClick={() => {
              setFormData({...formData, intent: 'buy', reason: 'relocation'});
              setAdvice([]);
            }}
            className={`px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${formData.intent === 'buy' ? 'bg-white text-blue-900 shadow-lg' : 'text-blue-200 hover:text-white'}`}
          >
            I want to Buy
          </button>
        </div>
      </div>

      <div className="p-12 space-y-12">
        {/* Intake Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Primary Goal</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.reason}
              onChange={e => setFormData({...formData, reason: e.target.value as any})}
            >
              {formData.intent === 'sell' ? (
                <>
                  <option value="downsizing">Rightsizing/Downsizing</option>
                  <option value="health">Health/Assisted Living</option>
                  <option value="estate">Estate/Inheritance</option>
                  <option value="financial">Financial Freedom</option>
                  <option value="lifestyle">Lifestyle Change</option>
                </>
              ) : (
                <>
                  <option value="relocation">Relocating to S. Florida</option>
                  <option value="lifestyle">Active Adult Community</option>
                  <option value="downsizing">Smaller, Accessible Home</option>
                  <option value="family">Moving closer to family</option>
                  <option value="financial">Investing Equity</option>
                </>
              )}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {formData.intent === 'sell' ? 'Home Condition' : 'Desired Condition'}
            </label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.condition}
              onChange={e => setFormData({...formData, condition: e.target.value as any})}
            >
              <option value="excellent">Turnkey/Excellent</option>
              <option value="good">Lived-in/Normal</option>
              <option value="fair">Needs Updates</option>
              <option value="poor">Major Repairs</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Timeline</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.urgency}
              onChange={e => setFormData({...formData, urgency: e.target.value as any})}
            >
              <option value="low">Exploring (1 Year+)</option>
              <option value="medium">Planning (3-6 Months)</option>
              <option value="high">Urgent (ASAP)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Feelings</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.emotionalReadiness}
              onChange={e => setFormData({...formData, emotionalReadiness: e.target.value as any})}
            >
              <option value="ready">Ready to act</option>
              <option value="hesitant">A bit hesitant</option>
              <option value="overwhelmed">Overwhelmed</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {formData.intent === 'sell' ? 'Current ZIP' : 'Desired Area'}
            </label>
            <input 
              type="text" 
              placeholder="e.g. 33139"
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
            />
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-sm hover:bg-blue-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-4">
               <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
               Gathering {formData.intent === 'buy' ? 'Market' : 'Local'} Records...
            </div>
          ) : `Build My ${formData.intent === 'buy' ? 'Buying' : 'Sale'} Pathfinder Guide`}
        </button>

        {/* Pillars Display */}
        {advice && advice.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {advice.map((item, idx) => (
              <div key={idx} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col hover:border-blue-200 transition-all">
                <div className="flex justify-between items-center mb-8">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
                    item.pillar?.includes('Financial') ? 'bg-emerald-50 text-emerald-600' :
                    item.pillar?.includes('Emotional') || item.pillar?.includes('Lifestyle') ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {item.pillar?.includes('Financial') ? '⚖️' : item.pillar?.includes('Emotional') || item.pillar?.includes('Lifestyle') ? '🧠' : '📊'}
                  </div>
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    item.priority === 'high' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'
                  }`}>
                    {item.priority} Priority
                  </span>
                </div>

                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{item.pillar}</h4>
                <h3 className="text-2xl font-bold text-slate-900 mb-6 leading-tight">{item.title}</h3>
                
                <p className="text-slate-600 leading-relaxed text-sm mb-10 flex-1">{item.content}</p>
                
                <div className="pt-6 border-t border-slate-50 mt-auto">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Verified Source</p>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 text-emerald-500">✓</span>
                    <p className="text-[10px] font-bold text-slate-500 italic truncate">{item.source}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
