import React, { useState } from 'react';
import { Vendor } from '../../services/vendorService';

interface VendorCardProps {
    vendor: Vendor;
    onAssign: (vendorId: string) => void;
    isAssigned?: boolean;
}

export const VendorCard: React.FC<VendorCardProps> = ({ vendor, onAssign, isAssigned = false }) => {
    const [isAssigning, setIsAssigning] = useState(false);

    const categoryEmojis: Record<string, string> = {
        mover: '🚚',
        estate_sale: '🏷️',
        attorney: '⚖️',
        organizer: '📦',
        cleaner: '🧹',
        other: '🔧'
    };

    const handleAssign = () => {
        setIsAssigning(true);
        onAssign(vendor.id);
        // Reset state handled by parent re-render usually, but safety timeout
        setTimeout(() => setIsAssigning(false), 2000);
    };

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all group flex flex-col h-full">
            <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl shadow-sm border border-slate-100">
                    {categoryEmojis[vendor.category] || '🔧'}
                </div>
                {vendor.isVerified && (
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-100">
                        Vetted
                    </span>
                )}
            </div>

            <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm mb-1">{vendor.name}</h4>
                <div className="flex items-center gap-1 mb-3">
                    <span className="text-amber-400 text-xs">★</span>
                    <span className="text-xs font-bold text-slate-600">{vendor.rating.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-400">({Math.floor(Math.random() * 50) + 10} reviews)</span>
                </div>

                <div className="space-y-1 mb-4">
                    {vendor.phone && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span>📞</span>
                            <span>{vendor.phone}</span>
                        </div>
                    )}
                    {vendor.email && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span>✉️</span>
                            <span className="truncate">{vendor.email}</span>
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={handleAssign}
                disabled={isAssigned || isAssigning}
                className={`w-full py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${isAssigned
                        ? 'bg-slate-100 text-slate-400 cursor-default'
                        : 'bg-slate-900 text-white hover:bg-blue-600 shadow-lg active:scale-95 disabled:opacity-50'
                    }`}
            >
                {isAssigned ? 'Assigned' : isAssigning ? 'Assigning...' : 'Assign to Lead'}
            </button>
        </div>
    );
};
