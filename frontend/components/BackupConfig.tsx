import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen, Plus, Trash2, PlayCircle, Settings, X, Lock, ShieldCheck, Loader2, LogIn, LogOut, Clock, CheckCircle2 } from 'lucide-react';
import { BackupConfig, BackupMode } from '../types.ts';
import { ipcService } from '../services/ipcService.ts';

const BackupConfiguration: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Config State
  const [config, setConfig] = useState<BackupConfig>({
    sourcePath: '',
    destinations: [''],
    mode: BackupMode.ONE_WAY_BACKUP,
    exclusions: [],
  });

  const [newExclusion, setNewExclusion] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Auto-save state
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const firstLoad = useRef(true);

  // Drive folder selector state
  const [showDriveFolderModal, setShowDriveFolderModal] = useState(false);
  const [driveFolders, setDriveFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderName, setSelectedFolderName] = useState('');

  // Trigger type: 'manual', 'automatic', or 'scheduled'
  const [triggerType, setTriggerType] = useState<'manual' | 'automatic' | 'scheduled'>('manual');

  // Backup schedule state (for scheduled trigger)
  const [backupSchedule, setBackupSchedule] = useState<{ day: string; time: string; enabled: boolean }>({
    day: 'Daily',
    time: '02:00',
    enabled: false
  });

  // Google Config Modal State
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);
  const [googleConfig, setGoogleConfig] = useState({ clientId: '', clientSecret: '' });
  const [savingGoogleConfig, setSavingGoogleConfig] = useState(false);

  const handleLogin = () => {
    setIsLoggingIn(true);
    // Simulate Google Auth Delay
    setTimeout(() => {
      setIsLoggingIn(false);
      setIsAuthenticated(true);
    }, 2000);
  };

  const handleSourceSelect = async () => {
    const path = await ipcService.selectDirectory();
    if (path) setConfig({ ...config, sourcePath: path });
  };

  const openDriveFolderModal = async () => {
    setShowDriveFolderModal(true);
    setLoadingFolders(true);
    const folders = await ipcService.listDriveFolders();
    setDriveFolders(folders);
    setLoadingFolders(false);
  };

  const selectDriveFolder = (folderId: string, folderName: string) => {
    setConfig({ ...config, destinations: [`drive://${folderId}`] });
    setSelectedFolderName(folderName);
    setShowDriveFolderModal(false);
  };

  const createNewDriveFolder = async () => {
    if (!newFolderName.trim()) return;
    const folder = await ipcService.createDriveFolder(newFolderName);
    if (folder) {
      setDriveFolders([...driveFolders, folder]);
      setNewFolderName('');
      alert(`Folder "${folder.name}" created!`);
    }
  };

  const addExclusion = () => {
    if (newExclusion.trim()) {
      setConfig({ ...config, exclusions: [...config.exclusions, newExclusion.trim()] });
      setNewExclusion('');
    }
  };

  const removeExclusion = (index: number) => {
    const newExclusions = config.exclusions.filter((_, i) => i !== index);
    setConfig({ ...config, exclusions: newExclusions });
  };

  const selectExclusionFiles = async () => {
    if (!ipcService.selectExclusions) return;
    const files = await ipcService.selectExclusions();
    if (files && files.length > 0) {
      const newExclusions = files.map(file => {
        // Try to make relative to source path if possible
        if (config.sourcePath && file.startsWith(config.sourcePath)) {
          let relative = file.substring(config.sourcePath.length);
          if (relative.startsWith('\\') || relative.startsWith('/')) {
            relative = relative.substring(1);
          }
          // normalize slashes
          return relative.replace(/\\/g, '/');
        }
        // Fallback to filename for now (simpler logic) app assumes exclusions are patterns
        // Ideally should be relative path
        const parts = file.split(/[/\\]/);
        return parts[parts.length - 1];
      });

      // Filter duplicates
      const unique = newExclusions.filter(e => !config.exclusions.includes(e));

      setConfig({ ...config, exclusions: [...config.exclusions, ...unique] });
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    // Simulate test
    setTimeout(() => {
      setIsTesting(false);
      setTestResult('success');
      setTimeout(() => setTestResult(null), 3000);
    }, 1500);
  };

  // --- Auto-Save Logic ---
  const saveConfigToBackend = async () => {
    // Basic validation silently fails or we can show error toast
    if (!config.sourcePath || !config.destinations[0]) return;

    setIsSaving(true);

    const jobType: 'sync' | 'backup' = 'backup';
    const job = {
      id: 'manual-backup',
      source: config.sourcePath,
      dest: config.destinations[0],
      destName: selectedFolderName,
      type: jobType,
      mode: config.mode,
      triggerType: triggerType,
      exclusions: config.exclusions
    };

    const schedules = [];
    if (triggerType === 'scheduled' && backupSchedule.enabled) {
      schedules.push({
        id: 'backup-schedule-1',
        day: backupSchedule.day,
        time: backupSchedule.time,
        action: 'BACKUP' as const,
        enabled: true,
        type: 'backup' as const
      });
    }

    try {
      const res = await ipcService.saveConfig({ jobs: [job], scheduler: schedules });
      if (res) {
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 2000);
      }
    } catch (error) {
      console.error("Auto-save failed", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced effect for auto-save
  useEffect(() => {
    // Skip if still loading initial data or if first render
    if (firstLoad.current) {
      return;
    }

    const timer = setTimeout(() => {
      saveConfigToBackend();
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [config, selectedFolderName, triggerType, backupSchedule]);



  // --- Login View ---
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');

  const initiateDriveLogin = async () => {
    // Check if running in Electron
    if (!window.electronAPI) {
      alert("Error: You are running in a browser. Please open the Electron Desktop App window to sign in.");
      return;
    }

    setIsLoggingIn(true);
    const res = await ipcService.getDriveAuthUrl();
    if (res.url) {
      setDriveUrl(res.url);
    } else {
      console.error("Auth URL fetch failed:", res.error);

      // Relaxed check: if there is ANY error, it's likely configuration related in this context
      // But let's be at least a bit specific to avoid hiding network errors
      if (res.error && (
        res.error.toLowerCase().includes('client') ||
        res.error.toLowerCase().includes('config') ||
        res.error.toLowerCase().includes('init') ||
        res.error.toLowerCase().includes('credentials')
      )) {
        setShowGoogleConfigModal(true);
      } else {
        alert(`Failed to initialize Google Login. Error: ${JSON.stringify(res.error)}`);
      }
    }
    setIsLoggingIn(false);
  };

  const saveGoogleCredentials = async () => {
    if (!googleConfig.clientId || !googleConfig.clientSecret) {
      alert("Please enter both Client ID and Client Secret");
      return;
    }

    setSavingGoogleConfig(true);
    try {
      const success = await ipcService.saveConfig({
        google: {
          clientId: googleConfig.clientId,
          clientSecret: googleConfig.clientSecret,
          redirectUri: 'urn:ietf:wg:oauth:2.0:oob'
        }
      });

      if (success) {
        setShowGoogleConfigModal(false);
        // Retry login immediately
        initiateDriveLogin();
      } else {
        alert("Failed to save credentials");
      }
    } catch (e) {
      alert("Error saving credentials");
    } finally {
      setSavingGoogleConfig(false);
    }
  };

  const submitAuthCode = async () => {
    setIsLoggingIn(true);
    const success = await ipcService.submitDriveCode(authCode);
    setIsLoggingIn(false);
    if (success) {
      setIsAuthenticated(true);
    } else {
      alert("Authentication Failed. Check logs.");
    }
  };

  const handleLogout = async () => {
    const success = await ipcService.logoutGoogle();
    if (success) {
      setIsAuthenticated(false);
      setDriveUrl(null);
      setAuthCode('');
    }
  };

  // Check auth status on mount
  React.useEffect(() => {
    const checkAuth = async () => {
      const isAuth = await ipcService.checkGoogleAuth();
      setIsAuthenticated(isAuth);
    };
    checkAuth();
  }, []);

  // Load saved config on mount
  React.useEffect(() => {
    const loadConfig = async () => {
      if (window.electronAPI) {
        const res = await window.electronAPI.getConfig();
        if (res.success && res.config && res.config.jobs && res.config.jobs.length > 0) {
          const job = res.config.jobs[0];
          if (job.source && job.dest) {
            setConfig({
              sourcePath: job.source,
              destinations: [job.dest],
              mode: job.mode || BackupMode.ONE_WAY_BACKUP,
              exclusions: job.exclusions || []
            });

            if (job.dest.startsWith('drive://')) {
              if (job.destName) {
                setSelectedFolderName(job.destName);
              } else {
                setSelectedFolderName('Drive folder selected');
              }
            }

            if (job.triggerType) {
              setTriggerType(job.triggerType);
            }
          }

          if (res.config.scheduler && res.config.scheduler.length > 0) {
            const backupSched = res.config.scheduler.find((s: any) => s.action === 'BACKUP');
            if (backupSched) {
              setBackupSchedule({
                day: backupSched.day,
                time: backupSched.time,
                enabled: backupSched.enabled !== false
              });
            }
          }
        }
      }
    };
    loadConfig().then(() => {
      // Allow auto-save only after initial data is loaded
      // We use a small timeout to ensure the state update doesn't trigger effect immediately with "changed" logic
      setTimeout(() => {
        firstLoad.current = false;
      }, 500);
    });
  }, []);

  const googleConfigModal = showGoogleConfigModal && (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] animate-fade-in">
      <div className="bg-surface border border-border rounded-xl p-0 max-w-lg w-full m-4 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-neutral-900/50 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Settings size={16} />
            Configure Google Access
          </h3>
          <button onClick={() => setShowGoogleConfigModal(false)} className="text-neutral-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <p className="text-blue-200 text-sm">
              To use Google Drive, you need to provide your own Google Cloud Console credentials.
              <br />
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-400 font-bold hover:underline mt-2 inline-block">
                Get Credentials →
              </a>
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase text-neutral-500 font-bold mb-2">Client ID</label>
            <input
              type="text"
              value={googleConfig.clientId}
              onChange={(e) => setGoogleConfig({ ...googleConfig, clientId: e.target.value })}
              placeholder="apps.googleusercontent.com"
              className="w-full bg-black/40 border border-border rounded-md px-4 py-3 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-white/50 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs uppercase text-neutral-500 font-bold mb-2">Client Secret</label>
            <input
              type="password"
              value={googleConfig.clientSecret}
              onChange={(e) => setGoogleConfig({ ...googleConfig, clientSecret: e.target.value })}
              placeholder="Client Secret"
              className="w-full bg-black/40 border border-border rounded-md px-4 py-3 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-white/50 transition-all font-mono"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              onClick={() => setShowGoogleConfigModal(false)}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveGoogleCredentials}
              disabled={!googleConfig.clientId || !googleConfig.clientSecret || savingGoogleConfig}
              className="bg-white text-black px-6 py-2 rounded-md hover:bg-neutral-200 transition-colors disabled:opacity-50 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            >
              {savingGoogleConfig ? <Loader2 className="animate-spin" size={14} /> : null}
              Save & Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fade-in pb-20">
        <div className="bg-surface border border-border p-10 rounded-2xl shadow-2xl max-w-md w-full text-center backdrop-blur-md bg-opacity-80">
          <div className="w-16 h-16 bg-surfaceHighlight rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
            <Lock size={32} />
          </div>

          <h2 className="text-2xl font-light text-primary mb-2">Authentication Required</h2>

          {!driveUrl ? (
            <>
              <p className="text-secondary text-sm mb-8">
                Please sign in with your Google Account to access backup configurations and cloud features.
              </p>
              <button
                onClick={initiateDriveLogin}
                disabled={isLoggingIn}
                className="w-full bg-white text-black hover:bg-gray-200 transition-colors py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
                Sign in with Google
              </button>
            </>
          ) : (
            <div className="text-left space-y-4">
              <p className="text-sm text-secondary">
                1. <a href={driveUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Click here to authorize</a> in your browser.
                <br />
                2. Copy the code provided and paste it below:
              </p>
              <input
                className="w-full bg-surfaceHighlight border border-border rounded p-2 text-primary"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Enter Authorization Code"
              />
              <button
                onClick={submitAuthCode}
                disabled={!authCode || isLoggingIn}
                className="w-full bg-primary text-black py-2 rounded font-medium"
              >
                {isLoggingIn ? 'Verifying...' : 'Submit Code'}
              </button>
            </div>
          )}

          <p className="text-xs text-neutral-600 mt-6 flex items-center justify-center gap-1">
            <ShieldCheck size={12} /> Secure Connection
          </p>
        </div>
        {googleConfigModal}
      </div>
    );
  }

  // --- Main Config View ---
  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in pb-10 relative">

      {/* Toast Notification */}
      <div className={`fixed top-8 left-1/2 -translate-x-1/2 bg-white text-black border border-white/20 px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.2)] z-50 transition-all duration-300 transform ${showSavedToast ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0 pointer-events-none'}`}>
        <CheckCircle2 size={18} className="text-black" />
        <span className="text-sm font-bold tracking-wide">CHANGES SAVED</span>
      </div>

      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tighter mb-2">Backups</h1>
          <p className="text-neutral-400 text-sm">Configure your sync rules and destinations</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-neutral-500 hover:text-white px-4 py-2 transition-colors text-xs uppercase font-bold tracking-widest"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Core Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-8">

          {/* Directories Section */}
          <section className="bg-surface border border-border rounded-lg p-0 overflow-hidden group">
            <div className="p-6 border-b border-border bg-neutral-900/50">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <FolderOpen size={16} className="text-neutral-400" />
                Path Configuration
              </h3>
            </div>

            <div className="p-6 space-y-6 relative">
              {/* Connector Line */}
              <div className="absolute left-[2.85rem] top-16 bottom-20 w-0.5 bg-gradient-to-b from-neutral-800 via-neutral-700 to-neutral-800 hidden sm:block"></div>

              {/* Source */}
              <div className="relative pl-0 sm:pl-16 transition-all duration-300">
                <div className="hidden sm:flex absolute left-0 top-3 w-8 h-8 rounded-full bg-neutral-900 border border-neutral-700 items-center justify-center z-10">
                  <span className="text-xs font-bold text-neutral-500">1</span>
                </div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2 font-bold">Source</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={config.sourcePath}
                    placeholder="Select source directory..."
                    className="flex-1 bg-black/40 border border-border rounded-md px-4 py-3 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-white/50 transition-all font-mono"
                  />
                  <button
                    onClick={handleSourceSelect}
                    className="bg-neutral-100 hover:bg-white text-black px-5 rounded-md text-xs font-bold uppercase tracking-wider transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                  >
                    Browse
                  </button>
                </div>
              </div>

              {/* Destination */}
              <div className="relative pl-0 sm:pl-16 transition-all duration-300">
                <div className="hidden sm:flex absolute left-0 top-3 w-8 h-8 rounded-full bg-neutral-900 border border-neutral-700 items-center justify-center z-10">
                  <span className="text-xs font-bold text-neutral-500">2</span>
                </div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2 font-bold">Destination</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={selectedFolderName || ''}
                    placeholder="Select Google Drive folder..."
                    className="flex-1 bg-black/40 border border-border rounded-md px-4 py-3 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-white/50 transition-all font-mono"
                  />
                  <button
                    onClick={openDriveFolderModal}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white border border-border px-5 rounded-md text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Trigger Configuration */}
          <section className="bg-surface border border-border rounded-lg p-0 overflow-hidden">
            <div className="p-6 border-b border-border bg-neutral-900/50">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} className="text-neutral-400" />
                Automation
              </h3>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setTriggerType('automatic')}
                  className={`p-5 rounded-lg border text-left transition-all duration-300 relative group overflow-hidden ${triggerType === 'automatic'
                    ? 'bg-neutral-100 border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                    : 'bg-black/20 border-border text-neutral-400 hover:bg-neutral-900 hover:border-neutral-600'
                    }`}
                >
                  <div className="relative z-10">
                    <div className="font-bold text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                      Automatic
                      {triggerType === 'automatic' && <CheckCircle2 size={14} className="text-black" />}
                    </div>
                    <div className={`text-xs ${triggerType === 'automatic' ? 'text-neutral-600' : 'text-neutral-600'}`}>
                      Real-time sync on file change
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => { setTriggerType('scheduled'); setBackupSchedule({ ...backupSchedule, enabled: true }); }}
                  className={`p-5 rounded-lg border text-left transition-all duration-300 relative group overflow-hidden ${triggerType === 'scheduled'
                    ? 'bg-neutral-100 border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                    : 'bg-black/20 border-border text-neutral-400 hover:bg-neutral-900 hover:border-neutral-600'
                    }`}
                >
                  <div className="relative z-10">
                    <div className="font-bold text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                      Scheduled
                      {triggerType === 'scheduled' && <CheckCircle2 size={14} className="text-black" />}
                    </div>
                    <div className={`text-xs ${triggerType === 'scheduled' ? 'text-neutral-600' : 'text-neutral-600'}`}>
                      Run at specific times
                    </div>
                  </div>
                </button>
              </div>

              {/* Schedule Options */}
              <div className={`grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border/50 transition-all duration-300 ${triggerType === 'scheduled' ? 'opacity-100 translate-y-0' : 'opacity-30 pointer-events-none translate-y-2'}`}>
                <div>
                  <label className="block text-xs uppercase text-neutral-500 font-bold mb-2">Frequency</label>
                  <div className="relative">
                    <select
                      disabled={triggerType !== 'scheduled'}
                      value={backupSchedule.day}
                      onChange={(e) => setBackupSchedule({ ...backupSchedule, day: e.target.value })}
                      className="w-full bg-black/40 border border-border text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-white/50 appearance-none cursor-pointer hover:bg-neutral-900 transition-colors"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">▾</div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs uppercase text-neutral-500 font-bold mb-2">Time</label>
                  <input
                    type="time"
                    disabled={triggerType !== 'scheduled'}
                    value={backupSchedule.time}
                    onChange={(e) => setBackupSchedule({ ...backupSchedule, time: e.target.value })}
                    className="w-full bg-black/40 border border-border text-white rounded-md px-4 py-3 text-sm focus:outline-none focus:border-white/50 [color-scheme:dark] transition-colors"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Exclusions & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-8 flex flex-col">

          {/* Exclusions */}
          <section className="bg-surface border border-border rounded-lg p-0 overflow-hidden flex-1 flex flex-col">
            <div className="p-6 border-b border-border bg-neutral-900/50">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <X size={16} className="text-neutral-400" />
                Exclusions
              </h3>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addExclusion()}
                  placeholder="e.g. node_modules"
                  className="flex-1 bg-black/40 border border-border rounded-md px-4 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-white/50 transition-colors font-mono"
                />
                <button
                  onClick={addExclusion}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white w-10 h-10 flex items-center justify-center rounded-md border border-border transition-colors group"
                  title="Add typed exclusion"
                >
                  <Plus size={18} className="text-neutral-400 group-hover:text-white transition-colors" />
                </button>
              </div>

              <div className="bg-black/20 border border-border/50 rounded-lg p-4 flex-1">
                {config.exclusions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {config.exclusions.map((ex, idx) => (
                      <span key={idx} className="bg-neutral-900 border border-border px-3 py-1 rounded text-xs text-neutral-300 flex items-center gap-2 group hover:border-red-500/30 transition-colors cursor-default font-mono">
                        {ex}
                        <button onClick={() => removeExclusion(idx)} className="text-neutral-600 group-hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-700">
                    <ShieldCheck size={24} className="mb-2 opacity-50" />
                    <p className="text-xs uppercase tracking-wider font-bold">No Exclusions</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Test & Validate Action */}
          <div className="bg-surface border border-border rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="min-h-[20px]">
                {testResult === 'success' && <span className="text-green-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 animate-fade-in"><CheckCircle2 size={14} /> Valid Configuration</span>}
                {testResult === 'error' && <span className="text-red-400 text-xs font-bold uppercase tracking-wider animate-fade-in">Invalid Configuration</span>}
                {!testResult && isSaving && <span className="text-neutral-500 text-xs font-bold uppercase tracking-wider animate-pulse">Saving...</span>}
                {!testResult && !isSaving && <span className="text-neutral-600 text-xs font-bold uppercase tracking-wider">Ready</span>}
              </div>
            </div>

            <button
              onClick={handleTest}
              disabled={isTesting}
              className="w-full sm:w-auto bg-white text-black hover:bg-neutral-200 px-6 py-3 rounded-md text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              {isTesting ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
              {isTesting ? 'Testing' : 'Test Config'}
            </button>
          </div>
        </div>
      </div>

      {/* Drive Folder Selector Modal - Unchanged */}
      {showDriveFolderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-surface border border-border rounded-lg p-0 max-w-md w-full m-4 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border bg-neutral-900/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Select Drive Folder</h3>
              <button onClick={() => setShowDriveFolderModal(false)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {loadingFolders ? (
                <div className="text-center py-8 text-neutral-500">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  <span className="text-xs uppercase tracking-wider font-bold">Loading...</span>
                </div>
              ) : (
                <>
                  <div className="mb-6 max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                    {driveFolders.length === 0 ? (
                      <p className="text-neutral-500 text-sm italic text-center py-4">No folders found.</p>
                    ) : (
                      driveFolders.map(folder => (
                        <button
                          key={folder.id}
                          onClick={() => selectDriveFolder(folder.id, folder.name)}
                          className="w-full text-left px-4 py-3 hover:bg-neutral-800 rounded-md transition-colors flex items-center gap-3 group border border-transparent hover:border-neutral-700"
                        >
                          <FolderOpen size={16} className="text-neutral-500 group-hover:text-white transition-colors" />
                          <span className="text-neutral-300 group-hover:text-white text-sm font-medium truncate">{folder.name}</span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="border-t border-border pt-6">
                    <label className="block text-xs text-neutral-500 mb-2 font-bold uppercase tracking-wider">Create New Folder</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name..."
                        className="flex-1 bg-black/40 border border-border rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/50"
                      />
                      <button
                        onClick={createNewDriveFolder}
                        disabled={!newFolderName.trim()}
                        className="bg-white text-black px-4 py-2 rounded-md hover:bg-neutral-200 transition-colors disabled:opacity-50 text-xs font-bold uppercase tracking-wider"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Google Config Modal */}
      {googleConfigModal}
    </div>
  );
};

export default BackupConfiguration;