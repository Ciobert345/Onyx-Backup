import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast.tsx';
import { Play, Pause, RefreshCw, CheckCircle, AlertCircle, Clock, FolderOpen, Activity, HardDrive, Cpu, Server, Calendar, Shield, Terminal, Command } from 'lucide-react';
import { ipcService } from '../services/ipcService.ts';

import { SystemStatus, JobStatus, SystemStats } from '../types.ts';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, YAxis, XAxis, CartesianGrid } from 'recharts';

// Helpers defined outside to be used in CustomTooltip
const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === 'Never' || dateStr.startsWith('Invalid')) return dateStr;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div style={{ pointerEvents: 'none' }} className="bg-[#0A0A0A] border border-neutral-800 p-3 rounded-lg shadow-xl backdrop-blur-md z-50">
        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mb-1">{data.name}</p>
        <p className="text-sm font-mono font-medium text-white">{formatBytes(Number(data.value))}</p>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [cpuHistory, setCpuHistory] = useState<{ load: number, time: string }[]>([]);
  const [showGraphs, setShowGraphs] = useState(true);
  const [notification, setNotification] = useState<{ id?: number; title: string; message: string; type: string } | null>(null);

  // Minecraft Server State
  const [mcStatus, setMcStatus] = useState<{ online: boolean; players: { now: number; max: number } | null; error?: string } | null>(null);
  const [mcConfig, setMcConfig] = useState<{ ip: string; port: string } | null>(null);

  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchLogs();
    fetchPreferences();

    if (window.electronAPI && window.electronAPI.onNotification) {
      window.electronAPI.onNotification((data) => {
        console.log('[FRONTEND] Received notification:', data);
        setNotification({ ...data, id: Date.now() });
      });
    }

    const listInterval = setInterval(() => {
      fetchLogs();
      fetchStatus();
    }, 1000); // Faster polling (1s)

    return () => clearInterval(listInterval);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showGraphs) {
      fetchSysStats();
      interval = setInterval(fetchSysStats, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showGraphs]);

  // Minecraft Fetcher
  useEffect(() => {
    if (!mcConfig?.ip) return;

    const fetchMcStatus = async () => {
      try {
        const res = await ipcService.getMinecraftStatus(mcConfig.ip, mcConfig.port || '25565');

        if (res.success && res.data && res.data.online) {
          setMcStatus({ online: true, players: { now: res.data.players.online, max: res.data.players.max } });
        } else {
          setMcStatus({ online: false, players: null, error: 'Offline' });
        }
      } catch (e) {
        console.error('[MC WIDGET] Error:', e);
        setMcStatus({ online: false, players: null, error: 'Connection Failed' });
      }
    };

    fetchMcStatus();
    const mcInterval = setInterval(fetchMcStatus, 10000); // Check every 10s
    return () => clearInterval(mcInterval);
  }, [mcConfig]);

  // Poll for preference changes so the widget updates when settings change
  useEffect(() => {
    const prefInterval = setInterval(fetchPreferences, 2000);
    return () => clearInterval(prefInterval);
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchPreferences = async () => {
    const prefs = await ipcService.getPreferences();
    if (prefs) {
      if (prefs.showSystemStats !== undefined) {
        setShowGraphs(prefs.showSystemStats);
      } else {
        setShowGraphs(true); // Default
      }
      // Load MC Config
      if (prefs.minecraftIp) {
        setMcConfig({ ip: prefs.minecraftIp, port: prefs.minecraftPort || '25565' });
      }
    } else {
      setShowGraphs(true); // Default if no prefs
    }
  };

  const fetchSysStats = async () => {
    const stats = await ipcService.getSystemStats();
    if (stats) {
      setSysStats(stats);
      setCpuHistory(prev => {
        const now = new Date();
        const timeStr = now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
        const newHistory = [...prev, { load: stats.cpuLoad, time: timeStr }];
        if (newHistory.length > 20) return newHistory.slice(newHistory.length - 20);
        return newHistory;
      });
    }
  };

  const fetchStatus = async () => {
    const data = await ipcService.getStatus();
    setStatus(data);
  };

  const fetchConfig = async () => {
    if (window.electronAPI) {
      const res = await window.electronAPI.getConfig();
      if (res.success) {
        setConfig(res.config);
      }
    }
  };

  const fetchLogs = async () => {
    const logData = await ipcService.getLogs();
    setLogs(logData);
  };

  const handleStartJob = async () => {
    setLoading(true);
    if (window.electronAPI) {
      const jobId = config?.jobs?.[0]?.id || 'manual-backup';
      const isSyncJob = config?.jobs?.[0]?.mode === 'Two-Way Sync' || config?.jobs?.[0]?.type === 'sync';

      if (isSyncJob) {
        await window.electronAPI.startSync(jobId);
      } else {
        await window.electronAPI.startBackup(jobId);
      }
    }
    await fetchStatus();
    setLoading(false);
  };

  const handleOpenSource = async () => {
    const source = config?.jobs?.[0]?.source;
    if (source) {
      await ipcService.openPath(source);
    }
  };

  if (!status) return <div className="p-8 text-secondary">Loading system status...</div>;

  const isSync = config?.jobs?.[0]?.mode === 'Two-Way Sync' || config?.jobs?.[0]?.type === 'sync';
  const actionText = isSync ? 'Sync Now' : 'Backup Now';
  const nextRun = status?.nextBackup || 'Not scheduled';

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-6 overflow-x-hidden overflow-y-auto lg:overflow-hidden text-primary bg-background animate-fade-in">
      <style>{`
        .recharts-wrapper { outline: none !important; }
        .recharts-surface { outline: none !important; }
        .recharts-wrapper * { outline: none !important; box-shadow: none !important; }
        .recharts-tooltip-cursor { stroke: rgba(255, 255, 255, 0.1) !important; }
        :focus { outline: none !important; }
        /* Custom Scrollbar for Logs */
        .log-scrollbar::-webkit-scrollbar { width: 4px; }
        .log-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .log-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; }
        .log-scrollbar::-webkit-scrollbar-thumb:hover { background: transparent; }
        .log-scrollbar::-webkit-scrollbar-corner { background: transparent; }

        /* Custom Scrollbar for Disks/Other */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
        .custom-scrollbar::-webkit-scrollbar-corner { background: transparent; }
      `}</style>

      {/* HEADER - Fixed */}
      <header className="shrink-0 flex justify-between items-center h-14">
        <div>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight">Dashboard</h1>
          <p className="text-secondary text-sm">System Overview</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status?.status === JobStatus.RUNNING ? 'bg-primary animate-pulse' : 'bg-neutral-600'}`}></span>
          <span className="text-xs font-mono text-secondary uppercase">{status?.status === JobStatus.RUNNING ? 'Running' : 'Idle'}</span>
        </div>
      </header>

      {/* KPI ROW - Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 shrink-0 h-auto md:h-32">
        {/* Card 1 */}
        <div className="bg-surface border border-border p-4 md:p-5 rounded-xl flex flex-row md:flex-col justify-between items-center md:items-stretch shadow-sm h-24 md:h-full group hover:border-neutral-500 transition-colors">
          <div className="flex justify-between items-start w-full">
            <div>
              <p className="text-secondary text-[10px] uppercase tracking-wider font-bold">Last Job</p>
              <h2 className="text-lg font-medium mt-1">{formatDate(status?.lastBackup || 'Never')}</h2>
            </div>
            <div className={`p-2 rounded-full ${status?.lastBackupStatus === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
              {status?.lastBackupStatus === 'failed' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            </div>
          </div>
          <div className="hidden md:block w-full">
            {status?.status === JobStatus.RUNNING && status?.progress ? (
              <div className="w-full">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-secondary uppercase font-bold tracking-wider">Progress</span>
                  <span className="text-xs font-mono text-emerald-500 font-bold">
                    {status.progress.total ? Math.min(Math.round((status.progress.processed / status.progress.total) * 100), 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: status.progress.total ? `${Math.min((status.progress.processed / status.progress.total) * 100, 100)}%` : '0%' }}></div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-secondary opacity-60 group-hover:opacity-100 transition-opacity">
                <Clock size={10} />
                <p>{status?.lastBackupStatus === 'failed' ? 'Check logs for errors' : 'System functioning normally'}</p>
              </div>
            )}
          </div>
        </div>
        {/* Card 2 */}
        <div className="bg-surface border border-border p-4 md:p-5 rounded-xl flex flex-row md:flex-col justify-between items-center md:items-stretch shadow-sm h-24 md:h-full hover:border-neutral-500 transition-colors">
          <div className="flex justify-between items-start w-full">
            <div>
              <p className="text-secondary text-[10px] uppercase tracking-wider font-bold">Storage Used</p>
              <h2 className="text-2xl font-light mt-1">{status?.storageUsed ? formatBytes(Number(status.storageUsed)) : '0 B'}</h2>
            </div>
            <div className="p-2 rounded-full bg-surfaceHighlight text-secondary">
              <HardDrive size={20} />
            </div>
          </div>
        </div>
        {/* Card 3 - MINECRAFT SERVER STATUS */}
        <div className="bg-surface border border-border p-4 md:p-5 rounded-xl flex flex-row md:flex-col justify-between items-center md:items-stretch shadow-sm h-24 md:h-full hover:border-neutral-500 transition-colors overflow-hidden">
          <div className="flex justify-between items-start w-full">
            <div>
              <p className="text-secondary text-[10px] uppercase tracking-wider font-bold">Minecraft Server</p>
              {!mcConfig?.ip ? (
                <h2 className="text-sm font-medium mt-1 text-neutral-500">Not formatted</h2>
              ) : (
                mcStatus?.online ? (
                  <div className="mt-1">
                    <h2 className="text-2xl font-bold text-white flex items-baseline gap-1">
                      {mcStatus.players?.now}<span className="text-sm font-normal text-secondary">/{mcStatus.players?.max}</span>
                    </h2>
                    <p className="text-[10px] text-green-500 font-bold uppercase tracking-wide mt-1 animate-pulse">Online</p>
                  </div>
                ) : (
                  <div className="mt-1">
                    <h2 className="text-lg font-medium text-neutral-400">Offline</h2>
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-wide mt-0.5">Connection Failed</p>
                  </div>
                )
              )}
            </div>
            <div className={`p-2 rounded-full ${mcStatus?.online ? 'bg-green-500/10 text-green-500' : 'bg-surfaceHighlight text-secondary'}`}>
              <Server size={20} />
            </div>
          </div>
          {/* Optional server address display at bottom if space permits */}
          {mcConfig?.ip && (
            <div className="hidden md:block mt-auto pt-2 border-t border-white/5">
              <p className="text-[10px] text-neutral-500 truncate">{mcConfig.ip}</p>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col gap-6">

        {/* ROW 1: CHARTS */}
        {showGraphs && (
          <div className="shrink-0 flex flex-col gap-4 lg:gap-6 lg:grid lg:grid-cols-4 lg:h-64">

            {/* CPU */}
            <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5 flex flex-col shadow-sm h-72 lg:h-full group hover:border-neutral-500 transition-colors">
              <div className="flex justify-between items-center mb-2 shrink-0">
                <h3 className="text-sm font-medium flex items-center gap-2"><Cpu size={16} /> CPU Usage</h3>
                <span className="text-lg font-bold">{sysStats?.cpuLoad}%</span>
              </div>
              {/* Fixed Layout: Flex Column Logic instead of Absolute */}
              <div className="flex-1 w-full min-h-0">
                {cpuHistory.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cpuHistory}>
                      <defs>
                        <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', color: '#fff' }}
                        itemStyle={{ color: '#8884d8' }}
                        labelStyle={{ color: '#888' }}
                      />
                      <Area type="monotone" dataKey="load" stroke="#8884d8" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* DISKS - REDESIGNED */}
            <div className="lg:col-span-1 bg-surface border border-border rounded-xl p-5 overflow-hidden flex flex-col shadow-sm h-48 lg:h-full hover:border-neutral-500 transition-colors">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-4 shrink-0"><HardDrive size={16} /> Disks</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                {sysStats?.disks.map((disk, idx) => (
                  <div key={idx} className="group/disk relative">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${disk.use > 90 ? 'bg-red-500/10 text-red-500' : 'bg-neutral-800 text-neutral-400'}`}>
                          <HardDrive size={12} />
                        </div>
                        <span className="text-xs font-medium text-neutral-300">{disk.mount || 'Local Disk'}</span>
                      </div>
                      <span className={`text-xs font-bold ${disk.use > 90 ? 'text-red-500' : 'text-emerald-500'}`}>{Math.round(disk.use)}%</span>
                    </div>
                    <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${disk.use > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`}
                        style={{ width: `${disk.use}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-neutral-500">
                      <span>Used: {formatBytes(disk.used)}</span>
                      <span>Total: {formatBytes(disk.size)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RAM */}
            <div className="lg:col-span-1 bg-surface border border-border rounded-xl p-5 flex flex-col shadow-sm h-64 lg:h-full hover:border-neutral-500 transition-colors">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-2 shrink-0"><Activity size={16} /> Memory</h3>
              {/* Fixed Layout: Flex Column Logic with Relative Container for Centered Text */}
              <div className="flex-1 w-full min-h-0 relative">
                {sysStats && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[{ name: 'Used', value: sysStats.memory.used }, { name: 'Free', value: sysStats.memory.available }]}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="75%"
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={false}
                      >
                        <Cell fill="#a855f7" />
                        <Cell fill="#333" />
                      </Pie>
                      <Tooltip
                        content={<CustomTooltip />}
                        position={{ x: 0, y: 0 }}
                        wrapperStyle={{ outline: 'none', zIndex: 100 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold">{sysStats ? Math.round((sysStats.memory.used / sysStats.memory.total) * 100) : 0}%</span>
                  <span className="text-[10px] text-secondary uppercase">Used</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ROW 2: ACTIONS & LOGS */}
        <div className="shrink-0 flex flex-col gap-4 lg:gap-6 lg:grid lg:grid-cols-2 lg:h-64 pb-2">

          {/* Left: Logs (Monochromatic Terminal) */}
          <div className="bg-[#0A0A0A] border border-border rounded-xl overflow-hidden flex flex-col shadow-sm h-64 lg:h-full group hover:border-neutral-500 transition-colors">
            <div className="px-4 py-2 border-b border-border bg-surfaceHighlight flex justify-between items-center shrink-0">
              <span className="text-[10px] font-mono text-secondary uppercase tracking-wider flex items-center gap-2">
                <Terminal size={10} /> System Logs
              </span>
            </div>
            <div
              ref={logsContainerRef}
              className="flex-1 p-4 overflow-y-auto log-scrollbar bg-[#050505]"
            >
              {logs ? (
                <pre className="text-[10px] font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed tracking-tight">{logs}</pre>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[10px] font-sans text-neutral-700">Waiting for system logs...</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions (Minimal Deck) */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between shadow-sm h-auto lg:h-full relative overflow-hidden hover:border-neutral-500 transition-colors">

            <div className="flex justify-between items-center mb-4 lg:mb-0 shrink-0 relative z-10">
              <h3 className="text-sm font-medium text-primary flex items-center gap-2">
                <Command size={16} /> Control Panel
              </h3>
              <span className="text-[10px] bg-surfaceHighlight border border-border px-2 py-0.5 rounded text-secondary">
                v2.0.0
              </span>
            </div>

            <div className="flex flex-col gap-3 flex-1 justify-center relative z-10">
              <button
                onClick={handleStartJob}
                disabled={loading || status?.status === 'Running'}
                className="group w-full bg-primary hover:bg-neutral-200 text-black font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : (isSync ? <RefreshCw size={18} /> : <Play size={18} fill="currentColor" />)}
                {actionText}
              </button>
              <button
                onClick={handleOpenSource}
                className="w-full bg-transparent hover:bg-surfaceHighlight text-primary py-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-border hover:border-neutral-500 active:scale-[0.98]"
              >
                <FolderOpen size={18} />
                Browse Files
              </button>
            </div>

            <div className="flex items-center justify-center pt-4 lg:pt-0 relative z-10 opacity-40">
              <Shield size={12} className="text-secondary mr-1.5" />
              <span className="text-[9px] text-secondary uppercase tracking-widest font-semibold">Secure Backup Active</span>
            </div>
          </div>

        </div>

        {/* Spacer - Only useful on desktop to prevent stretch */}
        <div className="flex-1 hidden lg:block"></div>

      </div>

      {notification && createPortal(
        <div key={(notification as any).id}>
          <Toast message={notification.message} onDismiss={() => setNotification(null)} />
        </div>,
        document.body
      )}

    </div>
  );
};

export default Dashboard;