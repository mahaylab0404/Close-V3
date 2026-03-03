
import React, { useState } from 'react';
import { generateTransitionRoadmap } from '../services/geminiService';

export const CustomerIntakeForm: React.FC<{ initialMode?: 'buy' | 'sell' | 'both' }> = ({ initialMode = 'sell' }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [roadmap, setRoadmap] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    propertyType: 'Single Family',
    yearsInHome: '',
    homeYear: 1985,
    sqft: 1800,
    roofAge: 'Unknown',
    acAge: 'Unknown',
    majorConcerns: [] as string[],
    otherConcerns: '',
    financialGoal: 'Max Profit',
    movingTarget: 'Within 6 Months',
    decisionHelp: 'Just me',
    accessibilityNeeded: [] as string[],
    emotionalState: 'Ready to Plan',
  });

  const handleCheckbox = (field: 'majorConcerns' | 'accessibilityNeeded', value: string) => {
    setFormData(prev => {
      const list = prev[field] || [];
      return {
        ...prev,
        [field]: list.includes(value) 
          ? list.filter(v => v !== value) 
          : [...list, value]
      };
    });
  };

  const generatePlan = async () => {
    setLoading(true);
    const plan = await generateTransitionRoadmap(formData);
    setRoadmap(plan);
    setLoading(false);
    setStep(4); 
  };

  const handleConnect = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1500);
  };

  if (submitted) {
    return (
      <div className="bg-emerald-50 p-16 rounded-[3rem] text-center border-2 border-emerald-100 shadow-xl animate-in zoom-in">
        <div className="text-7xl mb-6">🕊️</div>
        <h2 className="text-5xl font-bold text-emerald-900 mb-4">Your Guide is En Route</h2>
        <p className="text-xl text-emerald-700 max-w-xl mx-auto leading-relaxed senior-accessible-text">
          A Closr-Verified SRES® Expert has received your roadmap. They will call you shortly to discuss your unique timeline and provide a professional valuation.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
      {/* Progress Header */}
      <div className="bg-slate-900 p-10 text-white">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">90-Day Transition Planner</h2>
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Step {step} of 4</span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full transition-all duration-500" 
            style={{ width: `${(step / 4) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="p-12 flex-grow">
        {step === 1 && (
          <div className="space-y-8 animate-in slide-in-from-right">
            <div>
              <h3 className="text-3xl font-bold text-slate-800 mb-2">Let's start with the basics</h3>
              <p className="text-slate-500 senior-accessible-text">Tell us about your home and yourself.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Property Address</label>
                <input 
                  type="text" 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-slate-50 border-2 p-6 rounded-2xl text-xl font-bold outline-none focus:border-blue-600" 
                  placeholder="Street, City, Zip"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Year Built</label>
                <input 
                  type="number" 
                  value={formData.homeYear}
                  onChange={e => setFormData({...formData, homeYear: Number(e.target.value)})}
                  className="w-full bg-slate-50 border-2 p-6 rounded-2xl text-xl font-bold outline-none focus:border-blue-600" 
                  placeholder="e.g. 1972"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border-2 p-6 rounded-2xl text-xl font-bold outline-none focus:border-blue-600" 
                  placeholder="Full Name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Best Email</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-slate-50 border-2 p-6 rounded-2xl text-xl font-bold outline-none focus:border-blue-600" 
                  placeholder="name@email.com"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right">
            <div>
              <h3 className="text-3xl font-bold text-slate-800 mb-2">Detailed Home Review</h3>
              <p className="text-slate-500 senior-accessible-text">Florida insurance and marketability depends heavily on structural details.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Approximate Square Footage</label>
                <input 
                  type="number" 
                  value={formData.sqft}
                  onChange={e => setFormData({...formData, sqft: Number(e.target.value)})}
                  className="w-full bg-slate-50 border-2 p-6 rounded-2xl text-xl font-bold outline-none focus:border-blue-600" 
                  placeholder="e.g. 2400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roof Age & Material</label>
                <select 
                  value={formData.roofAge}
                  onChange={e => setFormData({...formData, roofAge: e.target.value})}
                  className="w-full bg-slate-50 border-2 p-6 rounded-2xl text-xl font-bold"
                >
                  <option>Recent Shingle (1-5 yrs)</option>
                  <option>Old Shingle (15+ yrs)</option>
                  <option>Tile (Newer)</option>
                  <option>Tile (Original/Aging)</option>
                  <option>Flat (Built-up)</option>
                  <option>Metal</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Have you noticed these typical transition hurdles?</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  'Cast Iron Pipe Issues', 
                  'Original Electrical Panel', 
                  'Old A/C System', 
                  'Wood Rot/Termite Sign', 
                  'Single-Pane Windows', 
                  'Settling Cracks'
                ].map(area => (
                  <button 
                    key={area}
                    type="button"
                    onClick={() => handleCheckbox('majorConcerns', area)}
                    className={`p-4 rounded-xl border-2 text-left font-bold transition-all ${
                      (formData.majorConcerns || []).includes(area) ? 'bg-blue-50 border-blue-600' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in slide-in-from-right text-center py-12">
            <div className="text-6xl mb-6">🧠</div>
            <h3 className="text-4xl font-bold text-slate-800">Reviewing Your Structural Data</h3>
            <p className="text-xl text-slate-500 max-w-lg mx-auto leading-relaxed senior-accessible-text">
              We're factoring in the construction year and regional costs to generate a precise 90-day plan.
            </p>
            <button 
              onClick={generatePlan}
              disabled={loading}
              className="mt-8 bg-blue-700 text-white px-16 py-6 rounded-3xl font-black uppercase tracking-widest text-lg hover:bg-blue-800 transition-all shadow-2xl disabled:opacity-50"
            >
              {loading ? 'Consulting Local Market Data...' : 'Generate My Structural Roadmap'}
            </button>
          </div>
        )}

        {step === 4 && roadmap && (
          <div className="space-y-10 animate-in fade-in">
            <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100">
              <h3 className="text-3xl font-bold text-blue-900 mb-4">Your Custom Florida Strategy</h3>
              <p className="text-blue-800 text-lg leading-relaxed senior-accessible-text italic">"{roadmap.summary}"</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2">Repair & Prep Priorities</h4>
                <ul className="space-y-3">
                  {roadmap.repairPriorities?.map((item: string, i: number) => (
                    <li key={i} className="flex gap-3 text-slate-700">
                      <span className="text-amber-500 font-bold">🛠️</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2">Financial Safeguards</h4>
                <ul className="space-y-3">
                  {roadmap.financialInsights?.map((item: string, i: number) => (
                    <li key={i} className="flex gap-3 text-slate-700">
                      <span className="text-emerald-500 font-bold">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">Expert Review Recommended</p>
                <h3 className="text-2xl font-bold mb-4">Finalize your plan with an expert</h3>
                <p className="text-slate-400 senior-accessible-text">Your roadmap suggests several structural factors that require a professional SRES® walkthrough.</p>
              </div>
              <button 
                onClick={handleConnect}
                disabled={loading}
                className="bg-blue-600 text-white px-12 py-6 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-all shadow-xl"
              >
                {loading ? 'Connecting...' : 'Connect to Certified Agent'}
              </button>
            </div>
          </div>
        )}
      </div>

      {step < 4 && (
        <div className="p-8 border-t flex justify-between items-center bg-slate-50/50">
          <button 
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            className="text-slate-400 font-bold uppercase tracking-widest text-xs hover:text-slate-600"
            disabled={step === 1}
          >
            Back
          </button>
          {step < 3 && (
            <button 
              onClick={() => setStep(prev => prev + 1)}
              className="bg-slate-900 text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all"
            >
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
};
