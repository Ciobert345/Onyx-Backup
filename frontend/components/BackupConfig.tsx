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
      <div className="bg-surface border border-border rounded-xl p-0 max-w-lg w-full m-4 shadow-2xl overflow-hidden backdrop-blur-sm bg-opacity-80">
        <div className="px-6 pt-5 pb-4 border-b border-border/50 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
              <Settings size={16} className="text-primary" />
            </div>
            <h3 className="text-base font-semibold text-primary">Configure Google Access</h3>
          </div>
          <button 
            onClick={() => setShowGoogleConfigModal(false)} 
            className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-surfaceHighlight transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-400/90 text-sm leading-relaxed">
              To use Google Drive, you need to provide your own Google Cloud Console credentials.
              <br />
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank" 
                rel="noreferrer" 
                className="text-blue-400 font-semibold hover:text-blue-300 underline mt-2 inline-block transition-colors"
              >
                Get Credentials →
              </a>
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase text-secondary font-semibold mb-2.5 tracking-wider">
              Client ID
            </label>
            <input
              type="text"
              value={googleConfig.clientId}
              onChange={(e) => setGoogleConfig({ ...googleConfig, clientId: e.target.value })}
              placeholder="apps.googleusercontent.com"
              className="w-full bg-surfaceHighlight border border-border rounded-lg px-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-primary transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs uppercase text-secondary font-semibold mb-2.5 tracking-wider">
              Client Secret
            </label>
            <input
              type="password"
              value={googleConfig.clientSecret}
              onChange={(e) => setGoogleConfig({ ...googleConfig, clientSecret: e.target.value })}
              placeholder="Client Secret"
              className="w-full bg-surfaceHighlight border border-border rounded-lg px-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-primary transition-all font-mono"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              onClick={() => setShowGoogleConfigModal(false)}
              className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-secondary hover:text-primary transition-colors rounded-lg hover:bg-surfaceHighlight"
            >
              Cancel
            </button>
            <button
              onClick={saveGoogleCredentials}
              disabled={!googleConfig.clientId || !googleConfig.clientSecret || savingGoogleConfig}
              className="bg-primary text-black px-6 py-2.5 rounded-lg hover:bg-white transition-all disabled:opacity-50 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hover:shadow-lg shadow-primary/10"
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
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 bg-primary text-black px-5 py-2.5 rounded-lg flex items-center gap-2.5 shadow-lg shadow-primary/20 z-50 transition-all duration-300 transform ${showSavedToast ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
        <CheckCircle2 size={16} className="text-black" />
        <span className="text-sm font-semibold tracking-wide">Saved</span>
      </div>

      <header className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-light text-primary tracking-tight">Backup Configuration</h1>
            <p className="text-secondary text-sm mt-1">Configure your backup rules and destinations</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-secondary hover:text-primary px-3 py-1.5 rounded-lg hover:bg-surfaceHighlight transition-all text-xs uppercase font-semibold tracking-wider"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Core Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-8">

          {/* Directories Section */}
          <section className="bg-surface border border-border rounded-xl overflow-hidden backdrop-blur-sm bg-opacity-80 shadow-lg">
            <div className="px-6 pt-5 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                  <FolderOpen size={16} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-primary">Paths</h3>
                  <p className="text-xs text-secondary mt-0.5">Source and destination configuration</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Source */}
              <div>
                <label className="text-xs uppercase text-secondary font-semibold mb-2.5 block tracking-wider">
                  Source Directory
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={config.sourcePath}
                    placeholder="No source selected..."
                    className="flex-1 bg-surfaceHighlight border border-border rounded-lg px-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-primary transition-all font-mono"
                  />
                  <button
                    onClick={handleSourceSelect}
                    className="bg-primary text-black hover:bg-white px-5 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all hover:shadow-lg shadow-primary/10"
                  >
                    Browse
                  </button>
                </div>
              </div>

              {/* Destination */}
              <div>
                <label className="text-xs uppercase text-secondary font-semibold mb-2.5 block tracking-wider">
                  Destination
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={selectedFolderName || ''}
                    placeholder="No destination selected..."
                    className="flex-1 bg-surfaceHighlight border border-border rounded-lg px-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-primary transition-all"
                  />
                  <button
                    onClick={openDriveFolderModal}
                    className="bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-primary border border-border px-5 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Trigger Configuration */}
          <section className="bg-surface border border-border rounded-xl overflow-hidden backdrop-blur-sm bg-opacity-80 shadow-lg">
            <div className="px-6 pt-5 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                  <Clock size={16} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-primary">Automation</h3>
                  <p className="text-xs text-secondary mt-0.5">Configure backup triggers</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTriggerType('automatic')}
                  className={`p-4 rounded-lg border text-left transition-all duration-200 ${triggerType === 'automatic'
                    ? 'bg-primary/10 border-primary text-primary shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                    : 'bg-surfaceHighlight/50 border-border text-secondary hover:bg-surfaceHighlight hover:border-border/80 hover:text-primary/80'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider">Automatic</span>
                    {triggerType === 'automatic' && <CheckCircle2 size={14} className="text-primary" />}
                  </div>
                  <p className="text-xs text-secondary/80">Real-time sync on file change</p>
                </button>

                <button
                  onClick={() => { setTriggerType('scheduled'); setBackupSchedule({ ...backupSchedule, enabled: true }); }}
                  className={`p-4 rounded-lg border text-left transition-all duration-200 ${triggerType === 'scheduled'
                    ? 'bg-primary/10 border-primary text-primary shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                    : 'bg-surfaceHighlight/50 border-border text-secondary hover:bg-surfaceHighlight hover:border-border/80 hover:text-primary/80'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider">Scheduled</span>
                    {triggerType === 'scheduled' && <CheckCircle2 size={14} className="text-primary" />}
                  </div>
                  <p className="text-xs text-secondary/80">Run at specific times</p>
                </button>
              </div>

              {/* Schedule Options */}
              {triggerType === 'scheduled' && (
                <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase text-secondary font-semibold mb-2 tracking-wider">
                      Frequency
                    </label>
                    <select
                      value={backupSchedule.day}
                      onChange={(e) => setBackupSchedule({ ...backupSchedule, day: e.target.value })}
                      className="w-full bg-surfaceHighlight border border-border text-primary rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all [color-scheme:dark]"
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
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-secondary font-semibold mb-2 tracking-wider">
                      Time
                    </label>
                    <input
                      type="time"
                      value={backupSchedule.time}
                      onChange={(e) => setBackupSchedule({ ...backupSchedule, time: e.target.value })}
                      className="w-full bg-surfaceHighlight border border-border text-primary rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Exclusions & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-8 flex flex-col">

          {/* Exclusions */}
          <section className="bg-surface border border-border rounded-xl overflow-hidden backdrop-blur-sm bg-opacity-80 shadow-lg flex-1 flex flex-col">
            <div className="px-6 pt-5 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                  <X size={16} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-primary">Exclusions</h3>
                  <p className="text-xs text-secondary mt-0.5">Files and folders to exclude</p>
                </div>
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col min-h-0">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addExclusion()}
                  placeholder="e.g. node_modules, *.tmp"
                  className="flex-1 bg-surfaceHighlight border border-border rounded-lg px-4 py-2.5 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-primary transition-all font-mono"
                />
                <button
                  onClick={addExclusion}
                  className="bg-primary text-black hover:bg-white w-10 h-10 flex items-center justify-center rounded-lg transition-all hover:shadow-lg shadow-primary/10"
                  title="Add exclusion"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="bg-surfaceHighlight/50 border border-border/50 rounded-lg p-4 flex-1 overflow-y-auto min-h-0">
                {config.exclusions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {config.exclusions.map((ex, idx) => (
                      <span key={idx} className="bg-surface border border-border px-3 py-1.5 rounded-md text-xs text-primary flex items-center gap-2 group hover:border-red-500/50 transition-colors font-mono">
                        {ex}
                        <button 
                          onClick={() => removeExclusion(idx)} 
                          className="text-secondary hover:text-red-400 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-secondary/50">
                    <ShieldCheck size={24} className="mb-2 opacity-30" />
                    <p className="text-xs uppercase tracking-wider font-semibold">No Exclusions</p>
                    <p className="text-xs mt-1 text-secondary/70">All files will be backed up</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Test & Validate Action */}
          <div className="bg-surface border border-border rounded-xl p-5 backdrop-blur-sm bg-opacity-80 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="min-h-[20px] flex items-center">
                {testResult === 'success' && (
                  <span className="text-green-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 size={14} /> Valid
                  </span>
                )}
                {testResult === 'error' && (
                  <span className="text-red-400 text-xs font-semibold uppercase tracking-wider">
                    Invalid
                  </span>
                )}
                {!testResult && isSaving && (
                  <span className="text-secondary text-xs font-semibold uppercase tracking-wider animate-pulse">
                    Saving...
                  </span>
                )}
                {!testResult && !isSaving && (
                  <span className="text-secondary/70 text-xs font-semibold uppercase tracking-wider">
                    Ready
                  </span>
                )}
              </div>

              <button
                onClick={handleTest}
                disabled={isTesting}
                className="bg-primary text-black hover:bg-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg shadow-primary/10"
              >
                {isTesting ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                {isTesting ? 'Testing' : 'Test'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drive Folder Selector Modal */}
      {showDriveFolderModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-0 max-w-md w-full m-4 shadow-2xl overflow-hidden backdrop-blur-sm bg-opacity-80">
            <div className="px-6 pt-5 pb-4 border-b border-border/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                  <FolderOpen size={16} className="text-primary" />
                </div>
                <h3 className="text-base font-semibold text-primary">Select Drive Folder</h3>
              </div>
              <button 
                onClick={() => setShowDriveFolderModal(false)} 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-surfaceHighlight transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              {loadingFolders ? (
                <div className="text-center py-12 text-secondary">
                  <Loader2 className="animate-spin mx-auto mb-3" size={24} />
                  <span className="text-xs uppercase tracking-wider font-semibold">Loading folders...</span>
                </div>
              ) : (
                <>
                  <div className="mb-6 max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                    {driveFolders.length === 0 ? (
                      <div className="text-center py-8 text-secondary/70">
                        <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No folders found</p>
                      </div>
                    ) : (
                      driveFolders.map(folder => (
                        <button
                          key={folder.id}
                          onClick={() => selectDriveFolder(folder.id, folder.name)}
                          className="w-full text-left px-4 py-3 hover:bg-surfaceHighlight rounded-lg transition-all flex items-center gap-3 group border border-transparent hover:border-border/50"
                        >
                          <FolderOpen size={16} className="text-secondary group-hover:text-primary transition-colors" />
                          <span className="text-primary group-hover:text-primary text-sm font-medium truncate">{folder.name}</span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="pt-5 border-t border-border/50">
                    <label className="block text-xs uppercase text-secondary font-semibold mb-2.5 tracking-wider">
                      Create New Folder
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name..."
                        className="flex-1 bg-surfaceHighlight border border-border rounded-lg px-4 py-2.5 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-primary transition-all"
                      />
                      <button
                        onClick={createNewDriveFolder}
                        disabled={!newFolderName.trim()}
                        className="bg-primary text-black px-5 py-2.5 rounded-lg hover:bg-white transition-all disabled:opacity-50 text-xs font-semibold uppercase tracking-wider hover:shadow-lg shadow-primary/10"
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