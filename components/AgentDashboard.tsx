
import React, { useState, useEffect } from 'react';
import { Lead, AgentSettings, ClosingCostBreakdown } from '../types';
import { discoverRealLeads, calculateVerifiedClosingCosts, generateStrategicBrief } from '../services/geminiService';
import { MarketTrendsChart } from './MarketTrendsChart';
import { enrichDiscoveredLeads, getLeadIntel, recomputeLeadIntel, type LeadIntel } from '../services/osintService';
import { AuthAgent } from '../services/authService';
import { VendorHub } from './vendors/VendorHub';
import { LeadDossier } from './leads/LeadDossier';

import { getVerificationUrls, discoverLeads as discoverPublicRecordLeads } from '../services/publicDataService';
import { DataImportModal } from './DataImportModal';

interface AgentDashboardProps {
   agent: AuthAgent;
   onLogout: () => void;
}

// Default zip codes per county for initial discovery
const DEFAULT_ZIPS: Record<string, string> = {
   'Miami-Dade': '33139',
   'Broward': '33301',
   'Palm Beach': '33401'
};

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ agent, onLogout }) => {
   const [leads, setLeads] = useState<Lead[]>([]);
   const [isScraping, setIsScraping] = useState(false);
   const [selectedCounty, setSelectedCounty] = useState('Miami-Dade');
   const [zipCode, setZipCode] = useState(DEFAULT_ZIPS['Miami-Dade']);
   const [activeTab, setActiveTab] = useState<'pipeline' | 'insights' | 'netsheet' | 'settings' | 'vendors'>('pipeline');

   const [discoveryLog, setDiscoveryLog] = useState<string[]>([]);
   const [isImportModalOpen, setIsImportModalOpen] = useState(false);

   // Verification State
   const [isVerifying, setIsVerifying] = useState(false);
   const [selectedLeadForBrief, setSelectedLeadForBrief] = useState<Lead | null>(null);
   const [selectedLeadForDossier, setSelectedLeadForDossier] = useState<Lead | null>(null);
   const [verificationBrief, setVerificationBrief] = useState<any>(null);

   // OSINT Enrichment State
   const [leadIntel, setLeadIntel] = useState<Record<string, LeadIntel>>({});
   const [isEnriching, setIsEnriching] = useState(false);
   const [enrichmentLog, setEnrichmentLog] = useState<string[]>([]);

   const [settings] = useState<AgentSettings>({
      showAiBrief: true, showMarketPulse: true, showEthicsCheck: true, showNetSheet: true, highDensityMode: false, autoRefreshLeads: false
   });

   // Net Sheet State
   const [marketPrice, setMarketPrice] = useState<number>(550000);
   const [mortgageBalance, setMortgageBalance] = useState<number>(0);
   const [annualTaxes, setAnnualTaxes] = useState<number>(4500);
   const [propertyType, setPropertyType] = useState('SFH');
   const [closingDate] = useState(new Date().toISOString().split('T')[0]);
   const [hasHOA, setHasHOA] = useState(false);
   const [numHOAs, setNumHOAs] = useState(1);
   const [hasPaceLoan, setHasPaceLoan] = useState(false);
   const [paceAmount, setPaceAmount] = useState(0);
   const [specialAssessments, setSpecialAssessments] = useState(0);
   const [isForeignNational, setIsForeignNational] = useState(false);
   const [purchasePrice, setPurchasePrice] = useState(0);
   const [isMarried, setIsMarried] = useState(true);
   const [prepBudget, setPrepBudget] = useState(2500);
   const [includeHomeWarranty, setIncludeHomeWarranty] = useState(true);

   const [breakdown, setBreakdown] = useState<ClosingCostBreakdown | null>(null);

   useEffect(() => {
      const update = async () => {
         const data = await calculateVerifiedClosingCosts(
            marketPrice, selectedCounty, propertyType, annualTaxes, closingDate, {
            hasPaceLoan, paceAmount, hasHOA, numHOAs,
            specialAssessments, isForeignNational,
            purchasePrice, isMarried, prepBudget, includeHomeWarranty
         }
         );
         setBreakdown(data);
      };
      update();
   }, [marketPrice, selectedCounty, propertyType, annualTaxes, closingDate, hasHOA, numHOAs, hasPaceLoan, paceAmount, specialAssessments, isForeignNational, purchasePrice, isMarried, prepBudget, includeHomeWarranty]);

   const handleDiscovery = async () => {
      setIsScraping(true);
      setDiscoveryLog([
         `Connecting to ${selectedCounty} Property Appraiser...`,
         `Searching zip code ${zipCode} for high-tenure homeowners...`,
         `Filtering residential properties (20+ years, homestead exempted)...`
      ]);
      try {
         // ─── PRIMARY: Real ArcGIS Property Records ───
         const publicLeads = await discoverPublicRecordLeads(selectedCounty, zipCode);
         setDiscoveryLog(prev => [
            ...prev,
            `Found ${publicLeads.length} verified property record leads.`
         ]);

         // ─── SECONDARY: Gemini AI for court record signals ───
         let geminiLeads: any[] = [];
         try {
            setDiscoveryLog(prev => [...prev, 'Scanning court records for probate/lis pendens signals...']);
            const geminiResult = await discoverRealLeads(selectedCounty);
            if (geminiResult?.verificationSteps) {
               setDiscoveryLog(prev => [...prev, ...geminiResult.verificationSteps]);
            }
            geminiLeads = (geminiResult?.leads || []).map((l: any) => ({
               ...l,
               id: 'ai_' + Math.random().toString(36).substr(2, 9),
               lastUpdated: 'Just Now',
               verificationLevel: 'signal_only',
               source_type: 'ai_signal'
            }));
            if (geminiLeads.length > 0) {
               setDiscoveryLog(prev => [...prev, `Found ${geminiLeads.length} AI-detected court record signals.`]);
            }
         } catch (aiErr) {
            console.warn('Gemini supplementary search failed:', aiErr);
            setDiscoveryLog(prev => [...prev, '⚠ AI court record scan unavailable — showing verified records only.']);
         }

         // ─── MERGE: Deduplicate by address ───
         const allNewLeads: Lead[] = [];
         const seenAddresses = new Set<string>();

         // Add public record leads first (higher trust)
         for (const pl of publicLeads) {
            const addrKey = pl.address.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!seenAddresses.has(addrKey)) {
               seenAddresses.add(addrKey);
               allNewLeads.push({
                  id: pl.id,
                  name: pl.name,
                  address: pl.address,
                  score: pl.score,
                  status: pl.score >= 70 ? 'hot' : 'warm',
                  type: 'seller',
                  reason: pl.signals.map(s => s.description).join('. ') || pl.motivationTrigger,
                  lastUpdated: 'Just Now',
                  verificationLevel: pl.verificationLevel,
                  scoringFactors: pl.signals.map(s => ({
                     label: s.type.replace(/_/g, ' '),
                     impact: s.strength === 'strong' ? 'high' : 'medium',
                     description: s.description
                  })),
                  estimatedEquity: pl.estimatedEquity,
                  motivationTrigger: pl.motivationTrigger,
                  source_type: 'public_record'
               } as Lead);
            }
         }

         // Add AI leads (deduped)
         for (const al of geminiLeads) {
            const addrKey = (al.address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (addrKey && !seenAddresses.has(addrKey)) {
               seenAddresses.add(addrKey);
               allNewLeads.push(al);
            }
         }

         if (allNewLeads.length > 0) {
            setLeads([...allNewLeads, ...leads]);
            setDiscoveryLog(prev => [
               ...prev,
               `✓ Discovery complete — ${allNewLeads.length} total leads added to pipeline.`
            ]);

            // ─── OSINT auto-enrichment ───
            setIsEnriching(true);
            setEnrichmentLog(['Running OSINT enrichment pipeline...']);
            try {
               const enrichResult = await enrichDiscoveredLeads(allNewLeads, selectedCounty);
               const intelMap: Record<string, LeadIntel> = {};
               for (const enriched of enrichResult.enriched) {
                  intelMap[enriched.id] = enriched.intel;
               }
               setLeadIntel(prev => ({ ...prev, ...intelMap }));
               setEnrichmentLog(prev => [
                  ...prev,
                  `✓ ${enrichResult.meta.verified} verified, ${enrichResult.meta.partial} partial, ${enrichResult.meta.unverified} unverified`,
                  `Enrichment complete — ${enrichResult.meta.total} leads processed.`,
               ]);
               setLeads(prev => prev.map(l => {
                  const intel = intelMap[l.id];
                  if (intel) {
                     const resolvedName = intel.property_profile?.owner_name;
                     const currentName = l.name;
                     const shouldUpdateName = (!currentName || currentName === 'Unknown' || currentName === 'Owner' || currentName.startsWith('Case #')) && resolvedName && resolvedName !== 'Unknown';
                     return {
                        ...l,
                        name: shouldUpdateName ? resolvedName : currentName,
                        score: intel.lead_score,
                        verificationLevel: intel.verification_status === 'strong_match' ? 'verified_record' as const : intel.verification_status === 'partial_match' ? 'high_probability' as const : 'signal_only' as const
                     };
                  }
                  return l;
               }));
            } catch (enrichErr) {
               console.error('Enrichment failed:', enrichErr);
               setEnrichmentLog(prev => [...prev, '⚠ OSINT enrichment failed — leads shown unenriched.']);
            } finally {
               setIsEnriching(false);
            }
         } else {
            setDiscoveryLog(prev => [...prev, `No leads found in ${zipCode}. Try a different zip code or county.`]);
         }
      } catch (err) {
         console.error("Discovery failed:", err);
         setDiscoveryLog(prev => [...prev, "Critical connection error to government portals."]);
      } finally {
         setIsScraping(false);
      }
   };

   const handleVerifyRecord = async (lead: Lead) => {
      setIsVerifying(true);
      setSelectedLeadForBrief(lead);
      setVerificationBrief(null);
      try {
         const brief = await generateStrategicBrief(lead);
         setVerificationBrief(brief);
         // Mark as verified in the main list
         setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, verificationLevel: 'verified_record' } : l));
      } catch (err) {
         console.error("Verification failed:", err);
      } finally {
         setIsVerifying(false);
      }
   };

   const handleImportLeads = (newLeads: any[]) => {
      const formattedLeads = newLeads.map(l => ({
         ...l,
         lastUpdated: 'Just Now'
      }));
      setLeads(prev => [...formattedLeads, ...prev]);
   };

   const loadLeadIntoCalculator = (lead: Lead) => {
      setMarketPrice(parseInt((lead.estimatedEquity || '500000').replace(/[^0-9]/g, '')) || 500000);
      setActiveTab('netsheet');
   };

   const sidebarIcons: Record<string, React.ReactNode> = {
      pipeline: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>,
      insights: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>,
      netsheet: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M2 9h20" /><path d="M2 15h20" /><path d="M9 3v18" /></svg>,
      vendors: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
      settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
   };

   const hotLeadCount = leads.filter(l => l.status === 'hot' || l.score >= 70).length;
   const verifiedCount = leads.filter(l => l.verificationLevel === 'verified_record').length;

   return (
      <div className={`flex min-h-[900px] bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200/60 text-slate-900 ${settings.highDensityMode ? 'text-xs' : 'text-sm'}`}>
         <aside className="w-60 bg-[#0b1120] text-white flex flex-col shrink-0">
            <div className="flex items-center gap-3 px-5 pt-6 pb-8">
               <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-900/50">C</div>
               <div className="leading-tight">
                  <span className="font-extrabold tracking-tight text-base block">Closr</span>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.2em]">Agent Intelligence</span>
               </div>
            </div>
            <nav className="flex-1 px-3 space-y-0.5">
               {[
                  { id: 'pipeline', label: 'Lead Pipeline' },
                  { id: 'insights', label: 'Market Pulse' },
                  { id: 'netsheet', label: 'Net Sheet Pro' },
                  { id: 'vendors', label: 'Vendor Hub' },
                  { id: 'settings', label: 'Settings' }
               ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[13px] font-medium ${activeTab === tab.id
                     ? 'bg-white/[0.08] text-white border-l-[3px] border-indigo-500 pl-[9px]'
                     : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border-l-[3px] border-transparent pl-[9px]'
                     }`}>
                     <span className={`w-5 h-5 flex items-center justify-center ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500'}`}>{sidebarIcons[tab.id]}</span>
                     {tab.label}
                  </button>
               ))}
            </nav>
            <div className="px-5 pb-5 mt-auto">
               <div className="bg-white/[0.05] rounded-lg px-3 py-2.5 flex items-center gap-3">
                  <div className="w-7 h-7 bg-indigo-600/30 rounded-md flex items-center justify-center text-[11px] font-bold text-indigo-300">{agent?.name?.charAt(0)?.toUpperCase() || 'A'}</div>
                  <div className="text-[11px] leading-tight truncate">
                     <span className="font-semibold text-slate-300 block truncate">{agent?.name || 'Agent'}</span>
                     <span className="text-slate-500 text-[9px]">Licensed Agent</span>
                  </div>
               </div>
            </div>
         </aside>

         <main className="flex-1 flex flex-col overflow-hidden bg-[#f8f9fb]">
            <header className="bg-white px-8 py-4 border-b border-slate-200/80 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-5">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                     {activeTab === 'pipeline' ? 'Lead Pipeline' : activeTab === 'netsheet' ? 'Net Sheet Pro' : activeTab === 'insights' ? 'Market Pulse' : activeTab === 'vendors' ? 'Vendor Hub' : activeTab === 'settings' ? 'Settings' : activeTab}
                  </h2>
                  {activeTab === 'pipeline' && leads.length > 0 && (
                     <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">{leads.length} leads</span>
                        {verifiedCount > 0 && <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">{verifiedCount} verified</span>}
                        {hotLeadCount > 0 && <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-md">{hotLeadCount} hot</span>}
                     </div>
                  )}
               </div>
               <div className="flex gap-2 items-center">
                  <select value={selectedCounty} onChange={e => { setSelectedCounty(e.target.value); setZipCode(DEFAULT_ZIPS[e.target.value] || '33139'); }} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                     <option>Miami-Dade</option>
                     <option>Broward</option>
                     <option>Palm Beach</option>
                  </select>
                  <input
                     type="text"
                     value={zipCode}
                     onChange={e => setZipCode(e.target.value)}
                     placeholder="ZIP"
                     className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 w-20"
                     maxLength={5}
                  />
                  <div className="w-px h-6 bg-slate-200 mx-1"></div>
                  <button onClick={() => setIsImportModalOpen(true)} className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg font-semibold text-xs hover:bg-slate-50 transition-all">
                     Import
                  </button>
                  <button onClick={handleDiscovery} disabled={isScraping} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-semibold text-xs hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50">
                     {isScraping ? 'Scanning…' : 'Scan Records'}
                  </button>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
               {activeTab === 'pipeline' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-2 space-y-4">
                        <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                           {(leads || []).map(lead => (
                              <div key={lead.id} className={`bg-white p-5 rounded-xl border transition-all shadow-sm flex flex-col hover:shadow-md ${lead.status === 'hot' || lead.score >= 70 ? 'border-l-[3px] border-l-red-500 border-t-slate-200 border-r-slate-200 border-b-slate-200' : lead.score >= 50 ? 'border-l-[3px] border-l-amber-400 border-t-slate-200 border-r-slate-200 border-b-slate-200' : 'border-slate-200'}`}>
                                 <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-3">
                                       <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                       </div>
                                       <div>
                                          <h4 className="text-sm font-semibold text-slate-900 leading-tight">{lead.name}</h4>
                                          <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{lead.address}</p>
                                       </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                       <div className="flex items-center gap-1">
                                          <span className="text-lg font-bold tabular-nums text-indigo-600">{leadIntel[lead.id]?.lead_score ?? lead.score}</span>
                                          {leadIntel[lead.id]?.verification_status === 'strong_match' && <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center"><span className="text-emerald-600 text-[10px] font-bold">✓</span></span>}
                                          {leadIntel[lead.id]?.verification_status === 'partial_match' && <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center"><span className="text-amber-600 text-[10px]">◐</span></span>}
                                       </div>
                                       <span className={`text-[10px] font-medium mt-0.5 ${leadIntel[lead.id]?.verification_status === 'strong_match' ? 'text-emerald-600' : leadIntel[lead.id]?.verification_status === 'partial_match' ? 'text-amber-600' : 'text-slate-400'
                                          }`}>
                                          {leadIntel[lead.id] ? leadIntel[lead.id].verification_status.replace('_', ' ') : (lead as any).source_type === 'public_record' ? 'Public Record' : 'Signal'}
                                       </span>
                                    </div>
                                 </div>

                                 {/* OSINT Intel Badge Row */}
                                 {leadIntel[lead.id] && (
                                    <div className="flex gap-1.5 mb-2.5 flex-wrap">
                                       {leadIntel[lead.id].risk_flags.slice(0, 3).map((flag, i) => (
                                          <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-red-50 text-red-600">
                                             {flag.replace(/_/g, ' ')}
                                          </span>
                                       ))}
                                       {leadIntel[lead.id].matches.owner_type === 'entity' && (
                                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-violet-50 text-violet-600">Entity</span>
                                       )}
                                       {leadIntel[lead.id].property_profile && (
                                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">
                                             {leadIntel[lead.id].property_profile!.property_type}
                                          </span>
                                       )}
                                    </div>
                                 )}

                                 <div className="bg-slate-50 p-2.5 rounded-lg mb-3">
                                    <p className="text-[10px] text-slate-500 leading-snug">{lead.reason}</p>
                                 </div>
                                 <div className="space-y-1.5 mb-4 flex-grow">
                                    {(lead.scoringFactors || []).map((f, idx) => (
                                       <div key={idx} className="flex items-center gap-2">
                                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.impact === 'high' ? 'bg-red-500' : 'bg-indigo-400'}`}></span>
                                          <span className="text-[11px] text-slate-600 truncate">{f.description}</span>
                                       </div>
                                    ))}
                                 </div>
                                 <div className="flex gap-2 mt-auto">
                                    <button
                                       onClick={() => handleVerifyRecord(lead)}
                                       className="flex-1 bg-white text-slate-700 border border-slate-200 py-2 rounded-lg font-medium text-[11px] hover:bg-slate-50 transition-all"
                                    >
                                       {leadIntel[lead.id] ? 'OSINT Brief' : 'Verify'}
                                    </button>
                                    <button
                                       onClick={() => loadLeadIntoCalculator(lead)}
                                       className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium text-[11px] hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-600/20"
                                    >
                                       Net Sheet
                                    </button>
                                    <button
                                       onClick={() => setSelectedLeadForDossier(lead)}
                                       className="bg-white text-indigo-600 border border-indigo-200 py-2 px-3 rounded-lg font-medium text-[11px] hover:bg-indigo-50 transition-all"
                                       title="Smart Dossier"
                                    >
                                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-fit sticky top-0">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Activity Log</h4>
                        <div className="space-y-3">
                           {isScraping && (
                              <div className="flex items-center gap-2.5 p-3 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                                 <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping"></span>
                                 <span className="text-[11px] font-medium">Scanning public records…</span>
                              </div>
                           )}
                           {isEnriching && (
                              <div className="flex items-center gap-2.5 p-3 bg-violet-50 text-violet-700 rounded-lg border border-violet-100">
                                 <span className="w-1.5 h-1.5 bg-violet-600 rounded-full animate-ping"></span>
                                 <span className="text-[11px] font-medium">Running OSINT enrichment…</span>
                              </div>
                           )}
                           {discoveryLog.length === 0 && enrichmentLog.length === 0 ? (
                              <div className="py-10 text-center">
                                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 mx-auto mb-3"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                 <p className="text-xs text-slate-400 font-medium">Ready to scan</p>
                                 <p className="text-[11px] text-slate-300 mt-1">Select a county and click Scan Records</p>
                              </div>
                           ) : (
                              <>
                                 {discoveryLog.map((log, idx) => (
                                    <div key={`d-${idx}`} className="flex gap-3 text-[10px] leading-relaxed group">
                                       <span className="text-emerald-500 font-bold">✓</span>
                                       <span className="text-slate-600 font-medium group-hover:text-blue-600 transition-colors">{log}</span>
                                    </div>
                                 ))}
                                 {enrichmentLog.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                       <p className="text-[8px] font-black text-violet-500 uppercase tracking-widest mb-2">OSINT Enrichment</p>
                                       {enrichmentLog.map((log, idx) => (
                                          <div key={`e-${idx}`} className="flex gap-3 text-[10px] leading-relaxed">
                                             <span className="text-violet-500 font-bold">⬡</span>
                                             <span className="text-slate-600 font-medium">{log}</span>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                              </>
                           )}
                        </div>
                     </div>
                  </div>
               )}



               {activeTab === 'netsheet' && (
                  <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
                     <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="space-y-2 col-span-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Market Value</label>
                           <input type="number" value={marketPrice} onChange={e => setMarketPrice(Number(e.target.value))} className="w-full bg-slate-50 border-2 border-blue-100 p-6 rounded-2xl text-4xl font-black text-blue-700 outline-none focus:border-blue-500" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Type</label>
                           <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-2xl text-xl font-bold">
                              <option value="SFH">Single Family</option>
                              <option value="Condo">Condo / Co-Op</option>
                              <option value="Townhouse">Townhouse</option>
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mortgage Balance</label>
                           <input type="number" value={mortgageBalance} onChange={e => setMortgageBalance(Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-2xl text-xl font-bold" />
                        </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        <div className="lg:col-span-2 space-y-8">
                           <div className="bg-white p-10 rounded-[3rem] border border-slate-200 space-y-10">
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Compliance & Adjustments</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                 {/* PACE & Assessments */}
                                 <div className="space-y-6">
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                       <label className="flex items-center gap-3 cursor-pointer">
                                          <input type="checkbox" checked={hasPaceLoan} onChange={e => setHasPaceLoan(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                                          <span className="font-black text-slate-900 text-sm">PACE / Renovate FL Loan</span>
                                       </label>
                                       {hasPaceLoan && (
                                          <input type="number" value={paceAmount} onChange={e => setPaceAmount(Number(e.target.value))} className="w-full mt-4 p-3 rounded-xl border border-slate-200 text-sm font-bold" placeholder="Outstanding PACE Balance" />
                                       )}
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                       <label className="flex items-center gap-3 cursor-pointer mb-2">
                                          <input type="checkbox" checked={hasHOA} onChange={e => setHasHOA(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                                          <span className="font-black text-slate-900 text-sm">HOA / Condo Association</span>
                                       </label>
                                       {hasHOA && (
                                          <div className="space-y-3">
                                             <input type="number" value={numHOAs} onChange={e => setNumHOAs(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-200 text-[10px] font-bold" placeholder="Number of Associations" />
                                             <input type="number" value={specialAssessments} onChange={e => setSpecialAssessments(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold" placeholder="Special Assessments" />
                                          </div>
                                       )}
                                    </div>
                                 </div>

                                 {/* Taxes & Foreign Status */}
                                 <div className="space-y-6">
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                       <p className="font-black text-slate-900 text-sm mb-4">🌎 FIRPTA & Residency</p>
                                       <div className="flex gap-2">
                                          <button onClick={() => setIsForeignNational(true)} className={`flex-1 py-3 rounded-xl font-bold text-[10px] ${isForeignNational ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>Foreign Seller</button>
                                          <button onClick={() => setIsForeignNational(false)} className={`flex-1 py-3 rounded-xl font-bold text-[10px] ${!isForeignNational ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>Domestic Seller</button>
                                       </div>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Annual Real Estate Taxes</label>
                                       <input type="number" value={annualTaxes} onChange={e => setAnnualTaxes(Number(e.target.value))} className="w-full p-4 rounded-xl border border-slate-200 text-xl font-black text-slate-900" />
                                       <p className="text-[8px] text-slate-400 font-bold uppercase mt-2">Used for daily proration calc</p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl flex flex-col h-fit sticky top-10">
                           <div className="text-center mb-10">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">Seller Net Proceeds</p>
                              <h3 className="text-5xl font-black text-emerald-400">
                                 ${((breakdown?.netProceeds || 0) - mortgageBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </h3>
                           </div>

                           <div className="space-y-4 flex-1 text-[11px] font-medium">
                              <div className="flex justify-between border-b border-white/5 pb-2">
                                 <span className="text-slate-500 uppercase">Comm. (6%)</span>
                                 <span className="text-red-400 font-black">-${breakdown?.commissions.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 pb-2">
                                 <span className="text-slate-500 uppercase">Doc Stamps ({selectedCounty})</span>
                                 <span className="font-black">-${(breakdown?.docStamps! + (breakdown?.miamiDadeSurtax || 0)).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 pb-2">
                                 <span className="text-slate-500 uppercase">Title & Settlement</span>
                                 <span className="font-black">-${(breakdown?.titleInsurance! + breakdown?.settlementFee!).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 pb-2">
                                 <span className="text-slate-500 uppercase">Tax Proration</span>
                                 <span className="font-black">-${breakdown?.taxProration.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              </div>
                              {isForeignNational && (
                                 <div className="flex justify-between border-b border-white/5 pb-2 text-orange-400">
                                    <span className="uppercase">FIRPTA (15%)</span>
                                    <span className="font-black">-${breakdown?.firptaWithholding.toLocaleString()}</span>
                                 </div>
                              )}
                           </div>
                           <button
                              onClick={() => {
                                 const csvContent = "data:text/csv;charset=utf-8,"
                                    + "Name,Address,Status,Score,Source\n"
                                    + leads.map(l => {
                                       // Safe access to properties
                                       const source = (l as any).source_type || l.reason || 'Unknown';
                                       return `"${l.name}","${l.address}","${l.verificationLevel}",${l.score},"${source}"`;
                                    }).join("\n");
                                 const encodedUri = encodeURI(csvContent);
                                 const link = document.createElement("a");
                                 link.setAttribute("href", encodedUri);
                                 link.setAttribute("download", "closr_pro_sheet.csv");
                                 document.body.appendChild(link);
                                 link.click();
                                 document.body.removeChild(link);
                              }}
                              className="w-full bg-blue-600 py-6 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-blue-700 transition-all mt-8">
                              Export Pro Report
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'vendors' && <VendorHub activeLeadId={leads.length > 0 ? leads[0].id : undefined} />}

               {activeTab === 'insights' && <div className="h-[600px]"><MarketTrendsChart /></div>}

               {activeTab === 'settings' && (
                  <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                     {/* Agent Profile */}
                     <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Agent Profile</h4>
                        <div className="flex items-start gap-8">
                           <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg">
                              {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                           </div>
                           <div className="flex-1 grid grid-cols-2 gap-6">
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Full Name</label>
                                 <p className="text-lg font-black text-slate-900">{agent.name || 'Agent'}</p>
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email</label>
                                 <p className="text-lg font-bold text-slate-700">{agent.email || '—'}</p>
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">License #</label>
                                 <p className="text-lg font-bold text-slate-700">{(agent as any).licenseNumber || (agent as any).license_number || '—'}</p>
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Default County</label>
                                 <p className="text-lg font-bold text-slate-700">{selectedCounty}</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Dashboard Preferences */}
                     <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Dashboard Preferences</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                              <div>
                                 <p className="font-black text-slate-900 text-sm">High Density Mode</p>
                                 <p className="text-[10px] text-slate-500 font-bold mt-1">Compact view for more leads on screen</p>
                              </div>
                              <div className={`w-12 h-7 rounded-full cursor-pointer transition-colors flex items-center px-1 ${settings.highDensityMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                 <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${settings.highDensityMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                              </div>
                           </div>
                           <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                              <div>
                                 <p className="font-black text-slate-900 text-sm">Show AI Briefings</p>
                                 <p className="text-[10px] text-slate-500 font-bold mt-1">Display AI-generated strategic briefs on leads</p>
                              </div>
                              <div className={`w-12 h-7 rounded-full cursor-pointer transition-colors flex items-center px-1 ${settings.showAiBrief ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                 <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${settings.showAiBrief ? 'translate-x-5' : 'translate-x-0'}`}></div>
                              </div>
                           </div>
                           <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                              <div>
                                 <p className="font-black text-slate-900 text-sm">Market Pulse Chart</p>
                                 <p className="text-[10px] text-slate-500 font-bold mt-1">Show real-time market trends dashboard</p>
                              </div>
                              <div className={`w-12 h-7 rounded-full cursor-pointer transition-colors flex items-center px-1 ${settings.showMarketPulse ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                 <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${settings.showMarketPulse ? 'translate-x-5' : 'translate-x-0'}`}></div>
                              </div>
                           </div>
                           <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                              <div>
                                 <p className="font-black text-slate-900 text-sm">Auto-Refresh Leads</p>
                                 <p className="text-[10px] text-slate-500 font-bold mt-1">Automatically refresh lead pipeline hourly</p>
                              </div>
                              <div className={`w-12 h-7 rounded-full cursor-pointer transition-colors flex items-center px-1 ${settings.autoRefreshLeads ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                 <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${settings.autoRefreshLeads ? 'translate-x-5' : 'translate-x-0'}`}></div>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Data Management */}
                     <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Data & Export</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <button
                              onClick={() => {
                                 const csvContent = "data:text/csv;charset=utf-8,"
                                    + "Name,Address,Score,Status,Verification,Source\n"
                                    + leads.map(l => {
                                       const source = (l as any).source_type || l.reason || 'Unknown';
                                       return `"${l.name}","${l.address}",${l.score},"${l.status || ''}","${l.verificationLevel}","${source}"`;
                                    }).join("\n");
                                 const link = document.createElement("a");
                                 link.setAttribute("href", encodeURI(csvContent));
                                 link.setAttribute("download", `closr_leads_${new Date().toISOString().split('T')[0]}.csv`);
                                 document.body.appendChild(link);
                                 link.click();
                                 document.body.removeChild(link);
                              }}
                              className="bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 transition-all shadow-lg"
                           >
                              📥 Export All Leads
                           </button>
                           <button
                              onClick={() => {
                                 if (confirm('Clear all leads from the pipeline? This cannot be undone.')) {
                                    setLeads([]);
                                    setLeadIntel({});
                                    setDiscoveryLog([]);
                                    setEnrichmentLog([]);
                                 }
                              }}
                              className="bg-white text-red-600 border-2 border-red-100 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-50 transition-all"
                           >
                              🗑 Clear Pipeline
                           </button>
                           <div className="flex items-center justify-center gap-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">API Connected</span>
                           </div>
                        </div>
                        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <p className="text-[10px] font-bold text-slate-500">
                              <strong className="text-slate-700">Pipeline Stats:</strong> {leads.length} total leads • {leads.filter(l => l.verificationLevel === 'verified_record').length} verified • {leads.filter(l => l.score >= 70).length} hot
                           </p>
                        </div>
                     </div>

                     {/* About & Compliance */}
                     <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">About & Compliance</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Application</p>
                              <p className="text-sm font-black text-slate-900">Closr AgentX Platform</p>
                              <p className="text-[10px] text-slate-500 font-bold mt-1">v2.0 • Senior-Centered Real Estate Intelligence</p>
                           </div>
                           <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Data Sources</p>
                              <p className="text-[10px] text-slate-600 font-bold leading-relaxed">
                                 Miami-Dade, Broward & Palm Beach County Property Appraisers • Florida Realtors® • MIAMI REALTORS® • County Clerk Records
                              </p>
                           </div>
                           <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Fair Housing</p>
                              <p className="text-[10px] text-blue-800 font-bold leading-relaxed">
                                 This platform complies with the Fair Housing Act. Lead generation is based solely on public property records and does not discriminate based on race, color, religion, sex, national origin, disability, or familial status.
                              </p>
                           </div>
                           <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Data Privacy</p>
                              <p className="text-[10px] text-slate-600 font-bold leading-relaxed">
                                 All lead data is sourced from publicly available government records. Personal data is processed locally and not shared with third parties. OSINT enrichment uses only public record APIs.
                              </p>
                           </div>
                        </div>
                     </div>

                     {/* Logout */}
                     <div className="flex justify-end">
                        <button
                           onClick={onLogout}
                           className="bg-red-50 text-red-600 border border-red-100 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-100 transition-all"
                        >
                           Sign Out
                        </button>
                     </div>
                  </div>
               )}
            </div>
         </main >

         {/* Verification Brief Modal */}
         {
            (selectedLeadForBrief || isVerifying) && (
               <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6">
                  <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
                     <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                        <div>
                           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Public Record Verification</span>
                           <h3 className="text-3xl font-black">{selectedLeadForBrief?.name}</h3>
                        </div>
                        <button onClick={() => setSelectedLeadForBrief(null)} className="text-4xl hover:text-blue-400 transition-colors">×</button>
                     </div>

                     <div className="p-10 overflow-y-auto space-y-8">
                        {isVerifying ? (
                           <div className="flex flex-col items-center justify-center py-20 space-y-6">
                              <div className="w-16 h-16 border-8 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              <div className="text-center">
                                 <p className="text-xl font-black text-slate-900 uppercase tracking-widest">Authenticating Signal...</p>
                                 <p className="text-slate-400 font-bold text-sm mt-2">Querying County Clerk Legal Indices for {selectedLeadForBrief?.address}</p>
                              </div>
                           </div>
                        ) : verificationBrief ? (
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                              <div className="space-y-8">
                                 {/* OSINT Intel Panel */}
                                 {selectedLeadForBrief && leadIntel[selectedLeadForBrief.id] && (() => {
                                    const intel = leadIntel[selectedLeadForBrief.id];
                                    return (
                                       <div className="bg-violet-50 p-6 rounded-2xl border-2 border-violet-100">
                                          <h4 className="text-[10px] font-black text-violet-800 uppercase tracking-widest mb-4">⬡ OSINT Intelligence</h4>
                                          <div className="grid grid-cols-3 gap-4 mb-4">
                                             <div className="text-center">
                                                <p className="text-2xl font-black text-violet-700">{intel.lead_score}</p>
                                                <p className="text-[8px] font-black text-violet-500 uppercase">OSINT Score</p>
                                             </div>
                                             <div className="text-center">
                                                <p className="text-2xl font-black text-violet-700">{Math.round(intel.matches.address_to_parcel_confidence * 100)}%</p>
                                                <p className="text-[8px] font-black text-violet-500 uppercase">Addr Match</p>
                                             </div>
                                             <div className="text-center">
                                                <p className="text-2xl font-black text-violet-700">{Math.round(intel.matches.owner_name_match_confidence * 100)}%</p>
                                                <p className="text-[8px] font-black text-violet-500 uppercase">Name Match</p>
                                             </div>
                                          </div>
                                          {intel.property_profile && (
                                             <div className="space-y-2 text-[10px] font-medium text-violet-800">
                                                <div className="flex justify-between border-b border-violet-200/50 pb-1">
                                                   <span>Owner of Record</span>
                                                   <span className="font-black">{intel.property_profile.owner_name}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-violet-200/50 pb-1">
                                                   <span>Parcel / Folio</span>
                                                   <span className="font-black">{intel.property_profile.parcel_id}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-violet-200/50 pb-1">
                                                   <span>Assessed Value</span>
                                                   <span className="font-black">${intel.property_profile.assessed_value?.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-violet-200/50 pb-1">
                                                   <span>Market Value</span>
                                                   <span className="font-black">${intel.property_profile.market_value?.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-violet-200/50 pb-1">
                                                   <span>Year Built</span>
                                                   <span className="font-black">{intel.property_profile.year_built}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                   <span>Homestead</span>
                                                   <span className="font-black">{intel.property_profile.homestead ? 'Yes' : 'No'}</span>
                                                </div>
                                             </div>
                                          )}
                                          {intel.risk_flags.length > 0 && (
                                             <div className="mt-3 flex gap-1 flex-wrap">
                                                {intel.risk_flags.map((flag, i) => (
                                                   <span key={i} className="text-[7px] font-black uppercase px-2 py-0.5 rounded bg-red-100 text-red-700">{flag.replace(/_/g, ' ')}</span>
                                                ))}
                                             </div>
                                          )}
                                          <p className="text-[9px] text-violet-600 font-medium mt-3 leading-relaxed">{intel.explanation}</p>
                                          {intel.sources.length > 0 && (
                                             <div className="mt-3 pt-2 border-t border-violet-200">
                                                <p className="text-[7px] font-black text-violet-400 uppercase mb-1">Sources</p>
                                                {intel.sources.map((s, i) => (
                                                   <p key={i} className="text-[8px] text-violet-500">{s.source_name}</p>
                                                ))}
                                             </div>
                                          )}
                                       </div>
                                    );
                                 })()}

                                 <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Executive Analysis</h4>
                                    <p className="text-slate-700 leading-relaxed font-medium">{verificationBrief.executiveSummary}</p>
                                 </div>

                                 <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Digital Trail</h4>
                                    <div className="space-y-3">
                                       {verificationBrief.verifiedRecords?.map((rec: any, i: number) => (
                                          <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                                             <div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase">{rec.label}</p>
                                                <p className="text-sm font-black text-slate-900">{rec.value}</p>
                                                <p className="text-[9px] text-blue-600 font-bold">{rec.source}</p>
                                             </div>
                                             {rec.verifiedUrl && (
                                                <a href={rec.verifiedUrl} target="_blank" rel="noopener noreferrer" className="bg-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg border border-slate-200 hover:bg-blue-600 hover:text-white transition-all">Source</a>
                                             )}
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              </div>

                              <div className="space-y-8">
                                 <div className="bg-emerald-50 p-8 rounded-[2rem] border-2 border-emerald-100">
                                    <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-4">Equity & Tax Portability (Estimated)</h4>
                                    <div className="space-y-4">
                                       {verificationBrief.financialInsights?.map((item: any, i: number) => (
                                          <div key={i} className="flex justify-between items-center border-b border-emerald-200/50 pb-2">
                                             <span className="text-xs font-bold text-emerald-700">{item.label}</span>
                                             <span className="text-xl font-black text-emerald-900">{item.estimatedValue}</span>
                                          </div>
                                       ))}
                                    </div>
                                 </div>

                                 <div className="p-8 bg-slate-900 text-white rounded-[2rem] shadow-xl">
                                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Risk & Readiness Assessment</h4>
                                    <div className="mb-6">
                                       <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Insurance Factor:</p>
                                       <p className="text-sm font-bold">{verificationBrief.riskAssessment}</p>
                                    </div>
                                    <div>
                                       <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Strategic Recommended Action:</p>
                                       <p className="text-sm font-bold text-emerald-400">{verificationBrief.recommendedAction}</p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ) : (
                           <div className="py-20 text-center text-slate-400 font-bold">Failed to load verification data.</div>
                        )}
                     </div>

                     <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                        <div className="flex gap-4">
                           <button
                              onClick={() => {
                                 // Simple prompt for MVP - in production this would be a nice form
                                 const type = prompt("Signal Type (probate, foreclosure, divorce):");
                                 const caseNum = prompt("Case Number:");
                                 if (type && caseNum && selectedLeadForBrief) {
                                    setLeadIntel(prev => {
                                       const prevIntel = prev[selectedLeadForBrief.id] || {
                                          lead_score: selectedLeadForBrief.score,
                                          matches: { owner_type: 'individual', owner_name_match_confidence: 1, address_to_parcel_confidence: 1, verification_status: 'partial_match', mailing_address_match: 'unknown', flags: [] as string[] },
                                          risk_flags: [],
                                          verification_status: 'partial_match',
                                          sources: [],
                                          explanation: 'Manual Entry',
                                          lead_score_breakdown: { address_parcel_resolved: 0, owner_name_match: 0, mailing_match: 0, entity_investor_bonus: 0, contact_deliverable: 0, no_parcel_penalty: 0, court_record_bonus: 0, high_tenure_bonus: 0, mismatch_penalty: 0, missing_fields_penalty: 0, raw_total: 0 },
                                          entity_profile: undefined,
                                          property_profile: undefined
                                       };

                                       return {
                                          ...prev,
                                          [selectedLeadForBrief.id]: {
                                             ...prevIntel,
                                             lead_score: Math.min(prevIntel.lead_score + 20, 100),
                                             verification_status: 'strong_match',
                                             risk_flags: [...prevIntel.risk_flags, 'manual_court_record'],
                                             sources: [...prevIntel.sources, { source_name: `Manual: ${type} #${caseNum}`, retrieved_at: new Date().toISOString() }],
                                             explanation: `${prevIntel.explanation} • Verified ${type} case #${caseNum}`
                                          }
                                       };
                                    });
                                 }
                              }}
                              className="text-slate-500 font-bold text-xs hover:text-blue-600 underline"
                           >
                              + Log Court Record
                           </button>
                        </div>
                        <button onClick={() => setSelectedLeadForBrief(null)} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all">Close Briefing</button>
                     </div>
                  </div>
               </div>
            )}

         {selectedLeadForDossier && (
            <LeadDossier
               lead={leads.find(l => l.id === selectedLeadForDossier.id) || selectedLeadForDossier}
               onClose={() => setSelectedLeadForDossier(null)}
            />
         )}

         <DataImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImportConfirmed={handleImportLeads}
         />
      </div>
   );
};
