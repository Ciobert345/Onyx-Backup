import React, { useState, useEffect, useRef } from 'react';
import { ToggleLeft, ToggleRight, Activity, CheckCircle2 } from 'lucide-react';
import { ipcService } from '../services/ipcService.ts';

const Settings: React.FC = () => {
    const [autoStart, setAutoStart] = useState(false);
    const [showStats, setShowStats] = useState(true);
    const [loading, setLoading] = useState(true);
    const [showSavedToast, setShowSavedToast] = useState(false);
    const firstLoad = useRef(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        if (ipcService.getPreferences) {
            const prefs = await ipcService.getPreferences();
            if (prefs) {
                setAutoStart(prefs.autoStart || false);
                // Default to true if undefined
                setShowStats(prefs.showSystemStats !== undefined ? prefs.showSystemStats : true);
            }
        }
        setLoading(false);
        // Ensure firstLoad is set to false only after initial load is done
        setTimeout(() => { firstLoad.current = false; }, 500);
    };

    // Auto-save effect
    useEffect(() => {
        if (loading || firstLoad.current) return;

        const saveSettings = async () => {
            if (ipcService.savePreferences) {
                const success = await ipcService.savePreferences({
                    autoStart,
                    showSystemStats: showStats
                });
                if (success) {
                    setShowSavedToast(true);
                    setTimeout(() => setShowSavedToast(false), 2000);
                }
            }
        };

        saveSettings();
    }, [autoStart, showStats, loading]);

    return (
        <div className="space-y-10 animate-fade-in relative">

            {/* Toast Notification */}
            <div className={`fixed top-8 left-1/2 -translate-x-1/2 bg-surfaceHighlight border border-border text-primary px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl z-50 transition-all duration-300 transform ${showSavedToast ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0 pointer-events-none'}`}>
                <CheckCircle2 size={18} className="text-green-500" />
                <span className="text-sm font-medium">Settings saved</span>
            </div>

            <header>
                <h1 className="text-3xl font-light tracking-tight text-primary">Settings</h1>
                <p className="text-secondary text-sm mt-1">Manage system preferences and application behavior</p>
            </header>

            <section>
                <h2 className="text-xl font-medium text-primary mb-6">System</h2>
                <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 backdrop-blur-sm bg-opacity-80">
                    <div className="flex items-center justify-between p-4 bg-surfaceHighlight rounded-lg border border-border">
                        <div className="space-y-1">
                            <div className="text-primary font-medium">Run on Startup</div>
                            <div className="text-sm text-secondary">Automatically start Onyx when you log in to Windows</div>
                        </div>
                        <button
                            onClick={() => setAutoStart(!autoStart)}
                            className={`transition-colors ${autoStart ? 'text-primary' : 'text-neutral-600 hover:text-neutral-400'}`}
                        >
                            {autoStart ? (
                                <ToggleRight size={40} className="fill-current" />
                            ) : (
                                <ToggleLeft size={40} className="fill-current" />
                            )}
                        </button>
                    </div>
                </div>

                <h2 className="text-xl font-medium text-primary mb-6 mt-10">Monitoring</h2>
                <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 backdrop-blur-sm bg-opacity-80">
                    <div className="flex items-center justify-between p-4 bg-surfaceHighlight rounded-lg border border-border">
                        <div className="space-y-1">
                            <div className="text-primary font-medium flex items-center gap-2">
                                <Activity size={16} />
                                Show System Graphs
                            </div>
                            <div className="text-sm text-secondary">Display real-time CPU, RAM, and Disk usage on Dashboard</div>
                        </div>
                        <button
                            onClick={() => setShowStats(!showStats)}
                            className={`transition-colors ${showStats ? 'text-primary' : 'text-neutral-600 hover:text-neutral-400'}`}
                        >
                            {showStats ? (
                                <ToggleRight size={40} className="fill-current" />
                            ) : (
                                <ToggleLeft size={40} className="fill-current" />
                            )}
                        </button>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-xl font-medium text-primary mb-6 mt-10">Data Management</h2>
                <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 backdrop-blur-sm bg-opacity-80">
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-surfaceHighlight rounded-lg border border-border gap-4">
                        <div className="space-y-1 w-full">
                            <div className="text-primary font-medium">Configuration Backup</div>
                            <div className="text-sm text-secondary">Export your settings to a file or restore from a backup</div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                onClick={async () => {
                                    setLoading(true);
                                    await ipcService.importConfig();
                                    loadSettings();
                                    setLoading(false);
                                }}
                                className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium uppercase tracking-wider text-neutral-400 hover:text-white border border-border hover:border-neutral-600 rounded-lg transition-all"
                            >
                                Import
                            </button>
                            <button
                                onClick={async () => {
                                    await ipcService.exportConfig();
                                }}
                                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold uppercase tracking-wider text-black bg-white rounded-lg hover:bg-neutral-200 transition-colors shadow-lg shadow-white/10"
                            >
                                Export
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Settings;
