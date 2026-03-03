
import React from 'react';
import { VendorAssignment } from '../../services/vendorService';

interface MoveTimelineProps {
    assignments: VendorAssignment[];
    onTaskToggle: (taskId: string, isCompleted: boolean) => void;
}

export const MoveTimeline: React.FC<MoveTimelineProps> = ({ assignments, onTaskToggle }) => {
    // Sort assignments by date
    const sortedAssignments = [...assignments].sort((a, b) => a.assignedAt - b.assignedAt);

    return (
        <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pl-8 py-4">
            {sortedAssignments.length === 0 ? (
                <div className="text-slate-400 text-sm font-medium italic">No vendors assigned yet. Start building the timeline!</div>
            ) : sortedAssignments.map((assignment, index) => (
                <div key={assignment.id} className="relative">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-white border-4 border-blue-500 shadow-sm z-10"></div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className="inline-block px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider mb-2">
                                    {assignment.category.replace('_', ' ')}
                                </span>
                                <h4 className="font-bold text-slate-900">{assignment.vendorName}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${assignment.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200 text-slate-500'
                                }`}>
                                {assignment.status === 'completed' ? '✓' : index + 1}
                            </div>
                        </div>

                        {/* Task Checklist */}
                        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            {assignment.tasks.map(task => (
                                <label key={task.id} className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={task.isCompleted}
                                            onChange={(e) => onTaskToggle(task.id, e.target.checked)}
                                            className="peer h-4 w-4 bg-white border-2 border-slate-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                    <span className={`text-xs font-medium transition-all ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700 group-hover:text-blue-700'}`}>
                                        {task.description}
                                    </span>
                                </label>
                            ))}
                            {assignment.tasks.length === 0 && (
                                <p className="text-[10px] text-slate-400 italic">No active tasks tracked.</p>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
