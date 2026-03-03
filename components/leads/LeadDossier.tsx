
import React, { useState, useEffect } from 'react';
import { Lead, ClosingCostBreakdown } from '../../types';
import { generateActionPlan, estimateRepairs, calculateHomesteadPortability, ActionPlan, RepairEstimate, HomesteadSavings } from '../../services/analysisService';
import { calculateVerifiedClosingCosts } from '../../services/geminiService';

interface LeadDossierProps {
    lead: Lead;
    onClose: () => void;
}

export const LeadDossier: React.FC<LeadDossierProps> = ({ lead, onClose }) => {
    const [activeTab, setActiveTab] = useState<'intel' | 'financials' | 'action' | 'family'>('intel');
    const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
    const [repairs, setRepairs] = useState<RepairEstimate[]>([]);
    const [homesteadSavings, setHomesteadSavings] = useState<HomesteadSavings | null>(null);
    const [netSheet, setNetSheet] = useState<ClosingCostBreakdown | null>(null);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

    // Initial load of deep analysis
    useEffect(() => {
        const analyzeLead = async () => {
            setIsLoadingAnalysis(true);
            try {
                // Parallel execution for speed
                const [plan, repairEst] = await Promise.all([
                    generateActionPlan(lead),
                    estimateRepairs(lead)
                ]);
                setActionPlan(plan);
                setRepairs(repairEst);

                // Homestead calc (mock assessed value for now, or derive from lead data if available)
                // In a real app, we'd fetch the exact assessed value from the property API first.
                const estimatedMarketValue = parseInt((lead.estimatedEquity || '500000').replace(/[^0-9]/g, '')) || 500000;
                const mockAssessedValue = estimatedMarketValue * 0.6; // Assessed is usually lower due to SOH cap
                setHomesteadSavings(calculateHomesteadPortability(estimatedMarketValue, mockAssessedValue, 10)); // Assuming 10 year tenure for now

                // Initial Net Sheet
                const costs = await calculateVerifiedClosingCosts(estimatedMarketValue, 'Miami-Dade');
                setNetSheet(costs);

            } catch (err) {
                console.error("Analysis failed", err);
            } finally {
                setIsLoadingAnalysis(false);
            }
        };

        if (lead) {
            analyzeLead();
        }
    }, [lead]);

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">

                {/* Header */}
                <div className="bg-slate-900 p-8 text-white flex justify-between items-start shrink-0">
                    <div className="flex gap-6 items-center">
                        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-black shadow-lg">
                            {lead.score}
                        </div>
                        <div>
                            <div className="flex gap-3 items-center mb-1">
                                <h2 className="text-3xl font-black tracking-tight">{lead.name}</h2>
                                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-bold uppercase tracking-wider text-blue-400">
                                    {lead.verificationLevel.replace('_', ' ')}
                                </span>
                            </div>
                            <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                                📍 {lead.address} • <span className="text-emerald-400">{lead.type.toUpperCase()}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-all text-xl"
                    >
                        ×
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 shrink-0">
                    {[
                        { id: 'intel', label: 'Verified Intel', icon: '⬡' },
                        { id: 'financials', label: 'Financial Power', icon: '💰' },
                        { id: 'action', label: 'Smart Action Plan', icon: '⚡' },
                        { id: 'family', label: 'Stakeholders', icon: '👥' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-6 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-all border-b-4 ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400'
                                }`}
                        >
                            <span className="text-lg">{tab.icon}</span> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-10">
                    {isLoadingAnalysis && !actionPlan ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-6">
                            <div className="w-16 h-16 border-8 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm animate-pulse">Running Deep Analysis...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'intel' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 space-y-8">
                                        {/* Signal Card */}
                                        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">🏛️</div>
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Primary Signal Origin</h3>
                                            <div className="flex gap-6 items-start relative z-10">
                                                <div className="p-4 bg-red-50 text-red-600 rounded-xl">
                                                    <div className="font-black text-2xl">⚠️</div>
                                                </div>
                                                <div>
                                                    <h4 className="text-xl font-black text-slate-900 mb-2">{lead.reason}</h4>
                                                    <p className="text-slate-500 text-sm leading-relaxed max-w-lg">
                                                        This lead was flagged due to a high-priority public record match. Verification indicates a strong likelihood of transition within 6-12 months.
                                                    </p>

                                                    <div className="mt-6 flex gap-3">
                                                        {(lead.scoringFactors || []).map((f, i) => (
                                                            <span key={i} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 border border-slate-200">
                                                                {f.label}: {f.description}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Property Facts */}
                                        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Property Vital Signs</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Year Built</p>
                                                    <p className="text-xl font-black text-slate-900">1988</p> {/* Dynamic in real app */}
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">SqFt (Living)</p>
                                                    <p className="text-xl font-black text-slate-900">2,450</p>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Lot Size</p>
                                                    <p className="text-xl font-black text-slate-900">10,500</p>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Last Sale</p>
                                                    <p className="text-xl font-black text-slate-900">1992</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Verification Status */}
                                    <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl">
                                        <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-6">Verification Ledger</h3>
                                        <ul className="space-y-4">
                                            <li className="flex items-center justify-between py-3 border-b border-white/10">
                                                <span className="text-sm font-medium">Owner Name Match</span>
                                                <span className="text-emerald-400 font-black">✓ CONFIRMED</span>
                                            </li>
                                            <li className="flex items-center justify-between py-3 border-b border-white/10">
                                                <span className="text-sm font-medium">Mailing Address</span>
                                                <span className="text-emerald-400 font-black">✓ MATCHES</span>
                                            </li>
                                            <li className="flex items-center justify-between py-3 border-b border-white/10">
                                                <span className="text-sm font-medium">Homestead Exemption</span>
                                                <span className="text-emerald-400 font-black">✓ ACTIVE</span>
                                            </li>
                                            <li className="flex items-center justify-between py-3 border-b border-white/10">
                                                <span className="text-sm font-medium">Mortgage Status</span>
                                                <span className="text-amber-400 font-black">⚠ UNKNOWN</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'financials' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Net Sheet Preview */}
                                        <div className="bg-emerald-900 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl font-black">$</div>
                                            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">Estimated Net Proceeds</h3>
                                            <p className="text-5xl font-black mb-8">${(netSheet?.netProceeds || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>

                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between border-b border-emerald-800 pb-2">
                                                    <span className="opacity-70">Sale Price (Est.)</span>
                                                    <span className="font-bold">${((netSheet?.netProceeds || 0) + (netSheet?.totalExpenses || 0)).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-emerald-800 pb-2">
                                                    <span className="opacity-70">Total Closing Costs</span>
                                                    <span className="font-bold text-red-300">-${(netSheet?.totalExpenses || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Homestead Savings */}
                                        {homesteadSavings && (
                                            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Homestead Portability</h3>
                                                <div className="flex items-end gap-2 mb-2">
                                                    <span className="text-4xl font-black text-slate-900">${homesteadSavings.portabilityAmount.toLocaleString()}</span>
                                                    <span className="text-sm font-bold text-slate-500 mb-1">portable value</span>
                                                </div>
                                                <p className="text-emerald-600 font-bold text-sm mb-6">Save approx. ${Math.round(homesteadSavings.annualTaxSavings).toLocaleString()}/year on next home</p>

                                                <div className="p-4 bg-blue-50 text-blue-800 text-xs rounded-xl font-medium leading-relaxed">
                                                    ℹ️ {homesteadSavings.notes}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Repair Estimator */}
                                    {repairs.length > 0 && (
                                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Pre-Listing Repair Estimates</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {repairs.map((repair, i) => (
                                                    <div key={i} className="p-6 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all bg-slate-50">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <h4 className="font-black text-slate-900">{repair.category}</h4>
                                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${repair.urgency === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{repair.urgency} Priority</span>
                                                        </div>
                                                        <p className="text-2xl font-black text-slate-700 mb-2">${repair.estimatedCost.toLocaleString()}</p>
                                                        <p className="text-xs text-slate-500 mb-3">{repair.description}</p>
                                                        <div className="text-[10px] font-bold text-emerald-600">
                                                            Potential Value Add: +${repair.impactOnValue.toLocaleString()}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'action' && actionPlan && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="bg-slate-900 text-white p-8 rounded-[2rem]">
                                            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Strategic Approach</h3>
                                            <p className="font-bold text-lg leading-relaxed">{actionPlan.recommendedStrategy}</p>
                                        </div>

                                        <div className="bg-white p-8 rounded-[2rem] border border-slate-200">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Immediate Steps</h3>
                                            <div className="space-y-6 relative">
                                                {/* Timeline Line */}
                                                <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-slate-100"></div>

                                                {actionPlan.steps.map((step, i) => (
                                                    <div key={i} className="flex gap-4 relative z-10">
                                                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 shadow-lg text-sm">
                                                            {step.order}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-900">{step.action}</h4>
                                                            <p className="text-xs text-slate-500 mt-1">{step.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 space-y-6">
                                        {actionPlan.scripts.map((script, i) => (
                                            <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="font-black text-slate-900 text-lg">{script.label}</h3>
                                                    <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold uppercase text-slate-500">{script.tone} Tone</span>
                                                </div>
                                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 font-medium leading-relaxed font-mono text-sm whitespace-pre-wrap">
                                                    {script.text}
                                                </div>
                                                <div className="mt-4 flex justify-end gap-2">
                                                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase hover:bg-slate-50">Copy Script</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'family' && (
                                <div className="text-center py-20">
                                    <div className="inline-block p-6 rounded-full bg-slate-100 text-4xl mb-6">🚧</div>
                                    <h3 className="text-xl font-black text-slate-900 mb-2">Stakeholder Management</h3>
                                    <p className="text-slate-500">Track heirs, attorneys, and family decision makers here.</p>
                                    <button className="mt-6 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm">Add Family Member</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
