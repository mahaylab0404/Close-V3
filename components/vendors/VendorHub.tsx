
import React, { useState, useEffect } from 'react';
import { Vendor, VendorAssignment, getVendors, assignVendor, getVendorAssignments, updateVendorTask } from '../../services/vendorService';
import { VendorCard } from './VendorCard';
import { MoveTimeline } from './MoveTimeline';

interface VendorHubProps {
    activeLeadId?: string;
}

export const VendorHub: React.FC<VendorHubProps> = ({ activeLeadId }) => {
    const [activeTab, setActiveTab] = useState<'directory' | 'timeline'>('timeline');
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [assignments, setAssignments] = useState<VendorAssignment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedCounty, setSelectedCounty] = useState<string>('Miami-Dade');

    // Simulate auth token for now (in real app, get from context)
    const token = 'dummy_token';

    useEffect(() => {
        if (activeLeadId) {
            loadAssignments();
        } else {
            // If no lead selected, default to directory view
            setActiveTab('directory');
        }
    }, [activeLeadId]);

    useEffect(() => {
        if (activeTab === 'directory') {
            loadVendors();
        }
    }, [activeTab, selectedCategory, selectedCounty]);

    const loadVendors = async () => {
        setIsLoading(true);
        try {
            const data = await getVendors(token, selectedCounty, selectedCategory);
            setVendors(data);
        } catch (err) {
            console.error('Failed to load vendors', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadAssignments = async () => {
        if (!activeLeadId) return;
        try {
            const data = await getVendorAssignments(token, activeLeadId);
            setAssignments(data);
        } catch (err) {
            console.error('Failed to load assignments', err);
        }
    };

    const handleAssignVendor = async (vendorId: string) => {
        if (!activeLeadId) {
            alert("Please select a lead first.");
            return;
        }
        try {
            // Optimistic update or reload? Reload is safer for tasks.
            await assignVendor(token, activeLeadId, vendorId);
            await loadAssignments();
            setActiveTab('timeline');
        } catch (err) {
            alert('Failed to assign vendor');
        }
    };

    const handleTaskToggle = async (taskId: string, isCompleted: boolean) => {
        // Optimistic update
        setAssignments(prev => prev.map(a => ({
            ...a,
            tasks: a.tasks.map(t => t.id === taskId ? { ...t, isCompleted } : t)
        })));

        try {
            await updateVendorTask(token, taskId, isCompleted);
        } catch (err) {
            console.error('Failed to update task', err);
            // Revert on failure
            loadAssignments();
        }
    };

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[800px]">
            {/* Header */}
            <div className="bg-slate-900 text-white p-8 flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Vendor Management Hub</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">
                        {activeLeadId ? 'Managing Transition Team' : 'Vendor Directory'}
                    </p>
                </div>
                <div className="flex bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('timeline')}
                        disabled={!activeLeadId}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'timeline' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white disabled:opacity-30'
                            }`}
                    >
                        My Team
                    </button>
                    <button
                        onClick={() => setActiveTab('directory')}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'directory' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Directory
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">

                {/* Filters (Directory Only) */}
                {activeTab === 'directory' && (
                    <div className="p-6 border-b border-slate-200 bg-white flex gap-4 overflow-x-auto shrink-0">
                        <select
                            value={selectedCounty}
                            onChange={e => setSelectedCounty(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="Miami-Dade">Miami-Dade</option>
                            <option value="Broward">Broward</option>
                            <option value="Palm Beach">Palm Beach</option>
                        </select>
                        <div className="flex gap-2">
                            {['', 'mover', 'estate_sale', 'attorney', 'organizer'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${selectedCategory === cat
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                        }`}
                                >
                                    {cat || 'All Vendors'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main View */}
                <div className="flex-1 overflow-y-auto p-8">
                    {activeTab === 'timeline' ? (
                        <div className="max-w-3xl mx-auto">
                            <h3 className="text-xl font-black text-slate-900 mb-6">Transition Timeline</h3>
                            <MoveTimeline assignments={assignments} onTaskToggle={handleTaskToggle} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {isLoading ? (
                                <p className="col-span-3 text-center py-20 text-slate-400">Loading directory...</p>
                            ) : vendors.length === 0 ? (
                                <p className="col-span-3 text-center py-20 text-slate-400">No vendors found for this filter.</p>
                            ) : (
                                vendors.map(vendor => (
                                    <VendorCard
                                        key={vendor.id}
                                        vendor={vendor}
                                        onAssign={handleAssignVendor}
                                        isAssigned={assignments.some(a => a.vendorId === vendor.id)}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
