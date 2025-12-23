import React, { useState, useEffect } from 'react';
import { History, HardDrive, Zap, CheckCircle2, XCircle, Info, Calendar, Trash2 } from 'lucide-react';
import { ipcService } from '../services/ipcService.ts';
import { HistoryEvent } from '../types.ts';

const HistoryPage: React.FC = () => {
    const [events, setEvents] = useState<HistoryEvent[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'BACKUP' | 'POWER'>('ALL');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
        const interval = setInterval(loadHistory, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const loadHistory = async () => {
        const data = await ipcService.getHistory();
        setEvents(data);
        setLoading(false);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success': return <CheckCircle2 size={16} className="text-green-400" />;
            case 'failed': return <XCircle size={16} className="text-red-400" />;
            default: return <Info size={16} className="text-blue-400" />;
        }
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('default', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    const filteredEvents = filter === 'ALL'
        ? events
        : events.filter(e => e.category === filter);

    return (
        <div className="space-y-8 animate-fade-in pb-10 h-full flex flex-col">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-light text-primary tracking-tight">System History</h1>
                    <p className="text-secondary text-sm mt-1">Log of recent backup jobs and power actions</p>
                </div>

                <div className="bg-surface border border-border p-1 rounded-lg flex gap-1">
                    {['ALL', 'BACKUP', 'POWER'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${filter === f
                                ? 'bg-neutral-100 text-black shadow-sm'
                                : 'text-secondary hover:text-white hover:bg-neutral-800'
                                }`}
                        >
                            {f === 'ALL' ? 'All Events' : f}
                        </button>
                    ))}
                    <div className="w-px bg-border mx-1 my-1"></div>
                    <button
                        onClick={async () => {
                            if (confirm('Are you sure you want to clear the history logs?')) {
                                await ipcService.clearHistory();
                                loadHistory();
                            }
                        }}
                        className="px-4 py-1.5 rounded text-xs font-bold text-red-400 hover:text-red-300 hover:bg-neutral-800 transition-all flex items-center gap-2"
                    >
                        <Trash2 size={12} /> Clear
                    </button>
                </div>
            </header>

            <div className="bg-surface border border-border rounded-xl flex-1 overflow-hidden backdrop-blur-sm bg-opacity-80 flex flex-col shadow-2xl min-h-[600px]">
                {events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-neutral-600">
                        <History size={48} className="mb-4 opacity-50" />
                        <p>No history events found.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-neutral-900/50 text-xs font-semibold text-secondary sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 uppercase tracking-wider w-40">Time</th>
                                    <th className="px-6 py-4 uppercase tracking-wider w-32">Type</th>
                                    <th className="px-6 py-4 uppercase tracking-wider">Action / Details</th>
                                    <th className="px-6 py-4 uppercase tracking-wider w-32 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredEvents.map(event => (
                                    <tr key={event.id} className="hover:bg-neutral-800/30 transition-colors group">
                                        <td className="px-6 py-4 text-sm font-mono text-secondary group-hover:text-primary transition-colors">
                                            {formatDate(event.timestamp)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-2 text-xs font-bold px-2 py-1 rounded border ${event.category === 'BACKUP'
                                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                }`}>
                                                {event.category === 'BACKUP' ? <HardDrive size={12} /> : <Zap size={12} />}
                                                {event.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-primary">{event.action}</div>
                                            {event.details && (
                                                <div className="text-xs text-secondary mt-1 max-w-xl truncate" title={event.details}>
                                                    {event.details}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <span className={`text-xs capitalize font-medium ${event.status === 'success' ? 'text-green-400' :
                                                    event.status === 'failed' ? 'text-red-400' : 'text-blue-400'
                                                    }`}>
                                                    {event.status}
                                                </span>
                                                {getStatusIcon(event.status)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
