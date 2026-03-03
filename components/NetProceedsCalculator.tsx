
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getHomeHealthAssessment } from '../services/geminiService';

interface RepairItem {
  id: string;
  label: string;
  cost: number;
  urgency: 'critical' | 'important' | 'ROI-booster';
  reason: string;
  seniorBenefit: string;
  insuranceRisk: 'high' | 'medium' | 'none';
}

const DIAGNOSTIC_QUESTIONS = [
  { id: 'water', text: "Do you notice slow drainage or occasional back-ups in your sinks?", impact: "Possible Cast Iron deterioration" },
  { id: 'roof_age', text: "Has your roof been fully replaced in the last 15 years?", impact: "Major insurance eligibility factor" },
  { id: 'electrical', text: "Do your lights flicker when the A/C kicks on?", impact: "Potential electrical panel age-out" },
  { id: 'spots', text: "Are there any dark spots or peeling paint on your ceilings?", impact: "Active or past leak indicator" }
];

export const NetProceedsCalculator: React.FC = () => {
  const [zipCode, setZipCode] = useState<string>('33139');
  const [salePrice, setSalePrice] = useState<number>(550000);
  const [mortgageBalance, setMortgageBalance] = useState<number>(0);
  const [sqft, setSqft] = useState<number>(2000);
  const [homeYear, setHomeYear] = useState<number>(1978);
  const [roofType, setRoofType] = useState<string>('Shingle');
  
  const [repairList, setRepairList] = useState<RepairItem[]>([]);
  const [selectedRepairs, setSelectedRepairs] = useState<string[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagStep, setDiagStep] = useState(0);
  const [diagAnswers, setDiagAnswers] = useState<Record<string, boolean>>({});
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const runAiAssessment = async () => {
    setIsDiagnosing(true);
    const issues = Object.entries(diagAnswers)
      .filter(([_, val]) => val)
      .map(([key, _]) => DIAGNOSTIC_QUESTIONS.find(q => q.id === key)?.impact || '');

    const result = await getHomeHealthAssessment({
      age: homeYear,
      zip: zipCode,
      sqft: sqft,
      roofType: roofType,
      observedIssues: issues
    });
    
    if (result && result.repairs) {
      setRepairList(result.repairs);
      const criticalIds = result.repairs
        .filter((r: RepairItem) => r.urgency === 'critical')
        .map((r: RepairItem) => r.id);
      setSelectedRepairs(criticalIds);
    }
    setIsDiagnosing(false);
    setShowDiagnostic(false);
  };

  const calculatedRepairTotal = (repairList || [])
    .filter(r => (selectedRepairs || []).includes(r.id))
    .reduce((acc, curr) => acc + curr.cost, 0);

  const totalExpenses = (salePrice * 0.06) + (salePrice * 0.007) + 3500 + mortgageBalance + calculatedRepairTotal;
  const netProceeds = salePrice - totalExpenses;

  const chartData = [
    { name: 'Fixed Costs & Mortgage', value: mortgageBalance + (salePrice * 0.06) + (salePrice * 0.007) + 3500, color: '#94a3b8' },
    { name: 'Selected Repairs', value: calculatedRepairTotal, color: '#fbbf24' },
    { name: 'Your Net Check', value: Math.max(0, netProceeds), color: '#059669' },
  ];

  return (
    <div className="bg-[#fdfdfb] p-8 md:p-16 rounded-[3rem] shadow-2xl border border-slate-100 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Financial Transparency Hub</h2>
        <p className="text-2xl text-slate-500 max-w-3xl mx-auto leading-relaxed senior-accessible-text">
          In South Florida, "As-Is" doesn't always mean "No-Repairs." We help you see exactly what your net check will look like after insurance-mandated fixes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        <div className="space-y-12">
          {/* Diagnostic Profile */}
          <section className="bg-white p-10 rounded-[2.5rem] border-4 border-blue-100 shadow-sm space-y-8">
            <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest text-center">Your Home's Profile</h3>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase">Zip Code</label>
                <input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} className="w-full bg-slate-50 p-6 rounded-2xl text-2xl font-bold border-2 border-slate-100 outline-none focus:border-blue-600" />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase">Year Built</label>
                <input type="number" value={homeYear} onChange={e => setHomeYear(Number(e.target.value))} className="w-full bg-slate-50 p-6 rounded-2xl text-2xl font-bold border-2 border-slate-100 outline-none focus:border-blue-600" />
              </div>
            </div>

            <button 
              onClick={() => { setShowDiagnostic(true); setDiagStep(0); }}
              className="w-full bg-blue-700 text-white p-8 rounded-[1.5rem] font-black uppercase text-xl hover:bg-blue-800 transition-all shadow-xl active:scale-95"
            >
              Start Diagnostic Assessment
            </button>
            <p className="text-center text-sm text-slate-400 font-bold uppercase tracking-tighter">Recommended for homes over 15 years old</p>
          </section>

          {/* Repair List */}
          {repairList && repairList.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-3xl font-black text-slate-900">Recommended Repairs</h3>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">2025 Estimates</span>
              </div>
              
              <div className="space-y-4">
                {repairList.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRepairs(prev => (prev || []).includes(r.id) ? (prev || []).filter(x => x !== r.id) : [...(prev || []), r.id])}
                    className={`w-full text-left p-8 rounded-[2rem] border-4 transition-all flex flex-col gap-4 ${
                      (selectedRepairs || []).includes(r.id) ? 'bg-amber-50 border-amber-500 shadow-xl' : 'bg-white border-slate-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${r.urgency === 'critical' ? 'bg-red-600 text-white' : 'bg-blue-100 text-blue-800'}`}>{r.urgency}</span>
                        <p className="text-2xl font-black text-slate-900">{r.label}</p>
                      </div>
                      <span className="text-3xl font-black text-slate-900">${r.cost.toLocaleString()}</span>
                    </div>
                    <p className="text-lg text-slate-500 leading-relaxed font-medium">{r.reason}</p>
                    <div className="bg-slate-100/50 p-4 rounded-xl text-sm font-bold text-slate-600 flex items-center gap-3">
                       <span className="text-xl">💡</span> {r.seniorBenefit}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Totals Display */}
        <div className="flex flex-col items-center">
          <div className="bg-slate-900 text-white p-12 rounded-[3.5rem] w-full shadow-2xl relative overflow-hidden mb-12">
            <div className="relative z-10 text-center">
              <p className="text-xs font-black uppercase tracking-[0.4em] opacity-40 mb-2">Estimated Net Check</p>
              <h3 className="text-7xl font-black mb-10 text-emerald-400">${Math.max(0, netProceeds).toLocaleString()}</h3>
              
              <div className="space-y-6 text-left border-t border-white/10 pt-10">
                <div className="flex justify-between text-xl font-bold">
                  <span className="opacity-60">Listing Price</span>
                  <span>${salePrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-red-400">
                  <span className="opacity-60">Estimated Fees & Repairs</span>
                  <span>-${totalExpenses.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center">
             <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-10">Distribution of Funds</h4>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">
                      {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800 }} />
                  </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-2 gap-4 mt-8 w-full">
                {chartData.map(c => (
                  <div key={c.name} className="flex items-center gap-3 text-sm font-bold text-slate-500">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></span>
                    {c.name}
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Trust & Transparency Pledge */}
      <div className="mt-24 p-12 bg-blue-50/50 rounded-[3rem] border-2 border-blue-100 flex flex-col md:flex-row items-center gap-12">
         <div className="text-6xl">🛡️</div>
         <div>
            <h4 className="text-2xl font-black text-blue-900 mb-2">Our Data Integrity Pledge</h4>
            <p className="text-xl text-blue-800/70 senior-accessible-text">
              We never sell your home data to telemarketers or predatory buyers. This calculator uses real-time South Florida labor rates and actual insurance carrier guidelines to give you the honest truth about your home's value.
            </p>
         </div>
      </div>

      {/* Diagnostic Modal */}
      {showDiagnostic && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-12 relative animate-in zoom-in">
            <button onClick={() => setShowDiagnostic(false)} className="absolute top-10 right-10 text-4xl text-slate-300 hover:text-slate-900">×</button>
            
            <div className="mb-12">
               <div className="flex justify-between items-center mb-6">
                 <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-4 py-2 rounded-full">AI Inspector</span>
                 <span className="text-sm font-black text-slate-400">Question {diagStep + 1} of {DIAGNOSTIC_QUESTIONS.length}</span>
               </div>
               <h3 className="text-4xl font-black leading-tight">{DIAGNOSTIC_QUESTIONS[diagStep].text}</h3>
               <p className="mt-4 text-blue-500 font-bold italic">“Why we ask: {DIAGNOSTIC_QUESTIONS[diagStep].impact}”</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <button 
                onClick={() => {
                  setDiagAnswers({...diagAnswers, [DIAGNOSTIC_QUESTIONS[diagStep].id]: true});
                  if (diagStep < DIAGNOSTIC_QUESTIONS.length - 1) setDiagStep(diagStep + 1);
                  else runAiAssessment();
                }}
                className="bg-slate-900 text-white p-10 rounded-[2rem] text-2xl font-black hover:bg-blue-700 transition-all shadow-xl"
              >
                Yes
              </button>
              <button 
                onClick={() => {
                  setDiagAnswers({...diagAnswers, [DIAGNOSTIC_QUESTIONS[diagStep].id]: false});
                  if (diagStep < DIAGNOSTIC_QUESTIONS.length - 1) setDiagStep(diagStep + 1);
                  else runAiAssessment();
                }}
                className="bg-slate-50 text-slate-400 p-10 rounded-[2rem] text-2xl font-black border-2 border-slate-100 hover:bg-slate-100 transition-all"
              >
                No / Not Sure
              </button>
            </div>

            {isDiagnosing && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center rounded-[3rem]">
                <div className="w-16 h-16 border-8 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="text-xl font-black text-blue-900 uppercase tracking-widest">Generating Your Expert Report...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
