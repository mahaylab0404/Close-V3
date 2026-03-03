
import React, { useState } from 'react';
import { parseLegalNoticeText, enrichParsedCases, ParsedCase } from '../services/leadParserService';
import { DiscoveredLead } from '../services/publicDataService';

interface DataImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportConfirmed: (leads: DiscoveredLead[]) => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({ isOpen, onClose, onImportConfirmed }) => {
    const [step, setStep] = useState<'input' | 'processing' | 'review'>('input');
    const [rawText, setRawText] = useState('');
    const [parsedCases, setParsedCases] = useState<ParsedCase[]>([]);
    const [verifiedLeads, setVerifiedLeads] = useState<DiscoveredLead[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleParse = async () => {
        setIsProcessing(true);
        setStep('processing');

        // 1. Parse Text
        const cases = parseLegalNoticeText(rawText);
        setParsedCases(cases);

        // 2. Enrich/Verify against Property API
        try {
            const leads = await enrichParsedCases(cases);
            setVerifiedLeads(leads);
            setStep('review');
        } catch (error) {
            console.error("Import error:", error);
            // Handle error state
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = () => {
        onImportConfirmed(verifiedLeads);
        onClose();
        // Reset state
        setStep('input');
        setRawText('');
        setParsedCases([]);
        setVerifiedLeads([]);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Import Leads from Text</h2>
                        <p className="text-sm text-slate-500">Paste foreclosure lists, auction calendars, or legal notices.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'input' && (
                        <div className="space-y-6">
                            {/* Source Shortcuts */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <a href="https://miamidade.realforeclose.com/index.cfm?zaction=USER&zmethod=CALENDAR" target="_blank" rel="noopener noreferrer" className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 group transition-all text-center">
                                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📅</div>
                                    <div className="font-bold text-slate-700 text-sm">Miami Foreclosure Calendar</div>
                                    <div className="text-[10px] text-slate-500 mt-1">RealForeclose.com</div>
                                </a>
                                <a href="https://broward.realforeclose.com/index.cfm?zaction=USER&zmethod=CALENDAR" target="_blank" rel="noopener noreferrer" className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 group transition-all text-center">
                                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🌴</div>
                                    <div className="font-bold text-slate-700 text-sm">Broward Foreclosure Calendar</div>
                                    <div className="text-[10px] text-slate-500 mt-1">RealForeclose.com</div>
                                </a>
                                <a href="https://communitynewspapers.com/category/legal-notices/" target="_blank" rel="noopener noreferrer" className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 group transition-all text-center">
                                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">⚖️</div>
                                    <div className="font-bold text-slate-700 text-sm">Legal Notices</div>
                                    <div className="text-[10px] text-slate-500 mt-1">Miami Community News</div>
                                </a>

                                {/* Court Record Searches */}
                                <a href="https://www2.miamidadeclerk.gov/ocr/Search.aspx" target="_blank" rel="noopener noreferrer" className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 group transition-all text-center">
                                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🏛️</div>
                                    <div className="font-bold text-slate-700 text-sm">Miami Court Search</div>
                                    <div className="text-[10px] text-slate-500 mt-1">Miami-Dade Clerk</div>
                                </a>
                                <a href="https://www.browardclerk.org/Web2/CaseSearch/" target="_blank" rel="noopener noreferrer" className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 group transition-all text-center">
                                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🔍</div>
                                    <div className="font-bold text-slate-700 text-sm">Broward Case Search</div>
                                    <div className="text-[10px] text-slate-500 mt-1">Broward Clerk</div>
                                </a>
                                <a href="https://applications.mypalmbeachclerk.com/eCaseView/" target="_blank" rel="noopener noreferrer" className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 group transition-all text-center">
                                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🏖️</div>
                                    <div className="font-bold text-slate-700 text-sm">Palm Beach Courts</div>
                                    <div className="text-[10px] text-slate-500 mt-1">eCaseView</div>
                                </a>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700">
                                    Step 2: Paste Raw Text Here
                                </label>
                                <textarea
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                    className="w-full h-64 p-4 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                    placeholder={`Instructions:
1. Use the "Court Search" links above to find case details.
2. If you only have a Case Number, search for it on the Clerk's website to find the Defendant's Name and Property Address.
3. Copy the full text (Case #, Name, Address) and paste it here.
4. The system will auto-detect the details.`}
                                />
                            </div>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            <p className="text-slate-600 font-medium">Analyzing text & verifying property records...</p>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="bg-green-50 p-4 rounded-lg flex-1 border border-green-100">
                                    <div className="text-2xl font-bold text-green-700">{verifiedLeads.length}</div>
                                    <div className="text-sm text-green-600">Verified Homeowners Found</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg flex-1 border border-slate-100">
                                    <div className="text-2xl font-bold text-slate-700">{parsedCases.length}</div>
                                    <div className="text-sm text-slate-500">Total Cases Detected</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-semibold text-slate-800">Verified Leads Preview</h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Signal</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Property Value</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Address</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-200">
                                            {verifiedLeads.map((lead) => (
                                                <tr key={lead.id}>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{lead.name}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-500">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                            {lead.signals[0]?.description}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-500">
                                                        ${lead.property?.marketValue.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-500 truncate max-w-xs" title={lead.address}>
                                                        {lead.address}
                                                    </td>
                                                </tr>
                                            ))}
                                            {verifiedLeads.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                                        No property matches found for the detected names.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 transition-all">
                    {step === 'input' && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">
                                Cancel
                            </button>
                            <button
                                onClick={handleParse}
                                disabled={!rawText.trim()}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all"
                            >
                                Process Text
                            </button>
                        </>
                    )}
                    {step === 'review' && (
                        <>
                            <button onClick={() => setStep('input')} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">
                                Back to Edit
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={verifiedLeads.length === 0}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 shadow-sm hover:shadow transition-all"
                            >
                                Import {verifiedLeads.length} Leads
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
