import React, { useEffect, useState } from 'react';
import { Play, Pause, RefreshCw, CheckCircle, AlertCircle, Clock, FolderOpen } from 'lucide-react';
import { ipcService } from '../services/ipcService.ts';

import { SystemStatus, JobStatus, SystemStats } from '../types.ts';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, RadialBarChart, RadialBar, Legend } from 'recharts';

const Dashboard: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [cpuHistory, setCpuHistory] = useState<{ load: number }[]>([]);
  const [showGraphs, setShowGraphs] = useState(true);

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchLogs();
    fetchPreferences();
    const listInterval = setInterval(() => {
      fetchLogs();
      fetchStatus();
    }, 2000);
    return () => clearInterval(listInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchPreferences = async () => {
    const prefs = await ipcService.getPreferences();
    if (prefs) {
      if (prefs.showSystemStats !== undefined) {
        setShowGraphs(prefs.showSystemStats);
      } else {
        setShowGraphs(true); // Default
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
        const newHistory = [...prev, { load: stats.cpuLoad }];
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
      // Re-evaluate isSync here to be safe (or use closure variable if stable)
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

  const handlePause = async () => {
    await ipcService.pauseJob();
    await fetchStatus();
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  if (!status) return <div className="p-8 text-secondary">Loading system status...</div>;



  const handleOpenSource = async () => {
    const source = config?.jobs?.[0]?.source;
    if (source) {
      await ipcService.openPath(source);
    }
  };

  // Determine Text based on Job Type
  const isSync = config?.jobs?.[0]?.mode === 'Two-Way Sync' || config?.jobs?.[0]?.type === 'sync';
  const actionText = isSync ? 'Sync Now' : 'Backup Now';


  return (
    <div className="space-y-10 animate-fade-in">
      <header>
        <h1 className="text-3xl font-light text-primary tracking-tight">Dashboard</h1>
        <p className="text-secondary text-sm mt-1">System overview and quick actions</p>
      </header>

      {/* CSS to suppress Recharts focus outline */}
      <style>{`
        .recharts-wrapper { outline: none !important; }
        .recharts-surface { outline: none !important; }
        .recharts-wrapper * {
          outline: none !important;
          box-shadow: none !important;
        }
        :focus {
           outline: none !important;
        }
      `}</style>

      {/* Metrics Section */}
      <section>
        <h2 className="text-xl font-medium text-primary mb-6">Status Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Card 1: Last Backup */}
          <div className="bg-surface border border-border p-6 rounded-xl flex flex-col justify-between backdrop-blur-sm bg-opacity-80 hover:border-neutral-600 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-secondary text-xs uppercase tracking-wider font-semibold">Last Backup</p>
                <h2 className="text-2xl mt-2 font-medium text-primary">
                  {status.lastBackup && status.lastBackup !== 'Never'
                    ? new Date(status.lastBackup).toLocaleString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                    : 'Never'}
                </h2>
                <p className={`text-xs mt-1 ${status.status === JobStatus.RUNNING ? 'text-green-400 animate-pulse' : 'text-secondary'}`}>
                  {status.status === JobStatus.RUNNING ? 'Backup is running...' : status.lastBackup !== 'Never' ? 'Completed' : 'No backup yet'}
                </p>
              </div>
              <div className={`p-2 rounded-full ${status.status === JobStatus.RUNNING ? 'bg-green-900/20 text-green-400' : 'bg-surfaceHighlight text-secondary'}`}>
                <CheckCircle size={20} className={status.status === JobStatus.RUNNING ? 'animate-spin' : ''} />
              </div>
            </div>
          </div>

          {/* Card 2: Storage Used */}
          <div className="bg-surface border border-border p-6 rounded-xl flex flex-col justify-between backdrop-blur-sm bg-opacity-80 hover:border-neutral-600 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-secondary text-xs uppercase tracking-wider font-semibold">Storage Used</p>
                <h2 className="text-2xl mt-2 font-medium text-primary">
                  {typeof status.storageUsed === 'number' ? formatBytes(status.storageUsed) : status.storageUsed || '0 B'}
                </h2>
              </div>
              <div className="p-2 rounded-full bg-surfaceHighlight text-secondary">
                <Clock size={20} />
              </div>
            </div>
          </div>

          {/* Card 3: Total Files */}
          <div className="bg-surface border border-border p-6 rounded-xl flex flex-col justify-between backdrop-blur-sm bg-opacity-80 hover:border-neutral-600 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-secondary text-xs uppercase tracking-wider font-semibold">Total Files</p>
                <h2 className="text-2xl mt-2 font-medium text-primary">{status.totalFiles || 0}</h2>
              </div>
              <div className="p-2 rounded-full bg-surfaceHighlight text-secondary">
                <RefreshCw size={20} />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* System Health Section (Conditional) */}
      {showGraphs && (
        <section>
          <h2 className="text-xl font-medium text-primary mb-6">System Health</h2>
          {sysStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* CPU Usage */}
              <div className="bg-surface border border-border p-6 rounded-xl backdrop-blur-sm bg-opacity-80 select-none outline-none focus:outline-none" tabIndex={-1}>
                <h3 className="text-secondary text-xs uppercase tracking-wider font-semibold mb-4">CPU Usage</h3>
                <div className="h-40 -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cpuHistory}>
                      <defs>
                        <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c084fc" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#c084fc" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                        itemStyle={{ color: '#e5e5e5' }}
                        labelStyle={{ display: 'none' }}
                        formatter={(value: number) => [`${value}%`, 'Load']}
                        cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                        wrapperStyle={{ outline: 'none' }}
                      />
                      <Area type="monotone" dataKey="load" stroke="#c084fc" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between items-end mt-2">
                  <span className="text-xs text-secondary">Real-time Load</span>
                  <span className="text-2xl font-bold text-primary">{sysStats.cpuLoad}%</span>
                </div>
              </div>

              {/* RAM Usage */}
              <div className="bg-surface border border-border p-6 rounded-xl backdrop-blur-sm bg-opacity-80 flex flex-col justify-between select-none outline-none focus:outline-none" tabIndex={-1}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-secondary text-xs uppercase tracking-wider font-semibold">Memory</h3>
                  <span className="text-xs text-secondary">{formatBytes(sysStats.memory.used)} / {formatBytes(sysStats.memory.total)}</span>
                </div>
                <div className="h-40 flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Used', value: sysStats.memory.used },
                          { name: 'Free', value: sysStats.memory.available }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={false}
                      >
                        <Cell fill="#60a5fa" stroke="none" />
                        <Cell fill="#333" stroke="none" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-primary">{Math.round((sysStats.memory.used / sysStats.memory.total) * 100)}%</span>
                    <span className="text-xs text-secondary">Used</span>
                  </div>
                </div>
              </div>

              {/* Disk Usage */}
              <div className="bg-surface border border-border p-6 rounded-xl backdrop-blur-sm bg-opacity-80 overflow-y-auto max-h-[280px] custom-scrollbar select-none outline-none focus:outline-none" tabIndex={-1}>
                <h3 className="text-secondary text-xs uppercase tracking-wider font-semibold mb-6">Storage Drives</h3>
                <div className="space-y-6">
                  {sysStats.disks.map((disk, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-sm mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${disk.use > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                          <span className="text-primary font-medium truncate max-w-[100px]" title={disk.mount}>{disk.mount || 'Disk'}</span>
                          <span className="text-xs text-secondary">({disk.fs})</span>
                        </div>
                        <span className="text-primary font-bold">{Math.round(disk.use)}%</span>
                      </div>
                      <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${disk.use > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
                          style={{ width: `${disk.use}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-neutral-500 mt-1.5 uppercase tracking-wide">
                        <span>{formatBytes(disk.used)} Used</span>
                        <span>{formatBytes(disk.size)} Total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface border border-border p-6 rounded-xl backdrop-blur-sm bg-opacity-80 h-[220px] animate-pulse">
                  <div className="h-4 bg-neutral-800 rounded w-1/3 mb-6"></div>
                  <div className="h-32 bg-neutral-800/50 rounded-xl"></div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Quick Actions Section */}
      <section>
        <h2 className="text-xl font-medium text-primary mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Start Job Action */}
          <div className="bg-surface border border-border rounded-xl p-6 hover:border-neutral-600 transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-primary">
                {isSync ? <RefreshCw size={24} /> : <Play size={24} />}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-primary mb-1">{actionText}</h3>
                <p className="text-sm text-secondary mb-4">
                  {isSync ? 'Synchronize files between source and destination' : 'Create a backup of your files'}
                </p>
                <button
                  onClick={handleStartJob}
                  disabled={loading || status.status === JobStatus.RUNNING}
                  className="flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 font-medium text-sm"
                >
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : (isSync ? <RefreshCw size={16} /> : <Play size={16} />)}
                  Start
                </button>
              </div>
            </div>
          </div>

          {/* Open Source Action */}
          <div className="bg-surface border border-border rounded-xl p-6 hover:border-neutral-600 transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                <FolderOpen size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-primary mb-1">Open Source Folder</h3>
                <p className="text-sm text-secondary mb-4">Quickly access your configured source directory</p>
                <button
                  onClick={handleOpenSource}
                  className="flex items-center gap-2 bg-surfaceHighlight border border-border text-primary px-4 py-2 rounded-lg hover:bg-neutral-800 hover:border-neutral-600 transition-colors font-medium text-sm"
                >
                  <FolderOpen size={16} />
                  Open Folder
                </button>
              </div>
            </div>
          </div>

        </div>
      </section >

      {/* Activity Log Section */}
      < section >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium text-primary">Activity Log</h2>
          <button onClick={fetchLogs} className="text-xs text-secondary hover:text-white flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <div className="bg-surface border border-border rounded-xl overflow-hidden p-6">
          {logs ? (
            <pre className="text-xs text-neutral-400 font-mono whitespace-pre-wrap h-64 overflow-y-auto custom-scrollbar">
              {logs}
            </pre>
          ) : (
            <p className="text-sm text-secondary italic">No logs available.</p>
          )}
        </div>
      </section >

    </div >
  );
};

export default Dashboard;