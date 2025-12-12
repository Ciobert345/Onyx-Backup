import React, { useState, useEffect } from 'react';
import { Power, Clock, Plus, Trash2, Calendar, Check, Pencil, X } from 'lucide-react';
import { ScheduleItem, PowerAction } from '../types.ts';
import { ipcService } from '../services/ipcService.ts';

const Scheduler: React.FC = () => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    const items = await ipcService.getSchedule();
    setSchedule(items);
    setLoading(false);
  };

  // State for new/editing task
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('00:00');
  const [newAction, setNewAction] = useState<PowerAction>(PowerAction.SHUTDOWN);

  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SHORT_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const toggleDay = (dayIndex: number) => {
    const day = WEEKDAYS[dayIndex];
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const selectAllDays = () => {
    if (selectedDays.length === 7) {
      setSelectedDays([]);
    } else {
      setSelectedDays([...WEEKDAYS]);
    }
  };

  const handleSaveItem = () => {
    if (selectedDays.length === 0) return;

    let currentSchedule = [...schedule];

    // If editing, remove the old item first
    if (editingId) {
      currentSchedule = currentSchedule.filter(item => item.id !== editingId);
    }

    let newItems: ScheduleItem[] = [];

    // Check if all days selected -> Daily
    if (selectedDays.length === 7) {
      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        day: 'Daily',
        time: newTime,
        action: newAction,
        enabled: true,
      });
    } else {
      // Create individual items
      newItems = selectedDays.map(day => ({
        id: Math.random().toString(36).substr(2, 9) + '-' + day, // Ensure unique ID
        day: day,
        time: newTime,
        action: newAction,
        enabled: true,
      }));
    }

    const updated = [...currentSchedule, ...newItems];
    setSchedule(updated);
    ipcService.saveSchedule(updated);

    // Reset selection nicely
    resetForm();
  };

  const startEditing = (item: ScheduleItem) => {
    setEditingId(item.id);
    setNewTime(item.time);
    setNewAction(item.action as PowerAction);

    if (item.day === 'Daily') {
      setSelectedDays([...WEEKDAYS]);
    } else {
      setSelectedDays([item.day]);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedDays([]);
    setNewTime('00:00');
    setNewAction(PowerAction.SHUTDOWN);
  };

  const removeScheduleItem = (id: string) => {
    const updated = schedule.filter(item => item.id !== id);
    setSchedule(updated);
    ipcService.saveSchedule(updated);
    if (editingId === id) resetForm(); // Cancel edit if deleted
  };

  const toggleEnabled = (id: string) => {
    const updated = schedule.map(item =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    setSchedule(updated);
    ipcService.saveSchedule(updated);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto h-full flex flex-col animate-fade-in pb-8">
      <header>
        <h1 className="text-3xl font-light text-primary tracking-tight">Power Scheduler</h1>
        <p className="text-secondary text-sm mt-1">Automate shutdown, restart, and hibernation tasks</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Col: Create/Edit Task */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`bg-surface border ${editingId ? 'border-primary' : 'border-border'} rounded-xl p-6 backdrop-blur-sm bg-opacity-80 shadow-lg transition-colors duration-300`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-primary flex items-center gap-2">
                {editingId ? <Pencil size={20} className="text-primary" /> : <Plus size={20} className="text-primary" />}
                {editingId ? 'Edit Task' : 'Create Task'}
              </h3>
              {editingId && (
                <button onClick={resetForm} className="text-xs flex items-center gap-1 text-secondary hover:text-red-400 transition-colors">
                  <X size={14} /> Cancel
                </button>
              )}
            </div>

            <div className="space-y-6">

              {/* 1. Action Selection */}
              <div>
                <label className="text-xs uppercase text-secondary font-semibold mb-3 block">1. Select Action</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.values(PowerAction).map(action => (
                    <button
                      key={action}
                      onClick={() => setNewAction(action)}
                      className={`px-4 py-3 rounded-lg text-sm font-medium border text-left transition-all flex items-center justify-between group ${newAction === action
                        ? 'bg-neutral-800 border-primary text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                        : 'bg-transparent border-border text-secondary hover:bg-neutral-900 hover:border-neutral-700'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <Power size={16} className={newAction === action ? 'text-primary' : 'text-neutral-500'} />
                        {action}
                      </span>
                      {newAction === action && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Time Selection */}
              <div>
                <label className="text-xs uppercase text-secondary font-semibold mb-3 block">2. Set Time</label>
                <div className="relative group">
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full bg-surfaceHighlight border border-border text-primary rounded-lg px-4 py-4 text-2xl font-mono focus:outline-none focus:border-primary transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* 3. Day Selection */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs uppercase text-secondary font-semibold">3. Repeat On</label>
                  <button onClick={selectAllDays} className="text-[10px] uppercase font-bold text-primary hover:text-white transition-colors tracking-wider">
                    {selectedDays.length === 7 ? 'Clear All' : 'Select All'}
                  </button>
                </div>
                <div className="flex justify-between gap-1">
                  {WEEKDAYS.map((day, index) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(index)}
                        className={`w-10 h-10 rounded-full text-xs font-bold transition-all flex items-center justify-center border ${isSelected
                          ? 'bg-primary text-black border-primary scale-105 shadow-md shadow-primary/20'
                          : 'bg-surfaceHighlight border-transparent text-secondary hover:bg-neutral-700 hover:text-white'
                          }`}
                        title={day}
                      >
                        {SHORT_DAYS[index]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-center text-xs text-secondary mt-3 h-4">
                  {selectedDays.length === 7 ? 'Repeats Daily' : selectedDays.length > 0 ? `${selectedDays.length} days selected` : 'Select days to repeat'}
                </p>
              </div>

              {/* Add/Update Button */}
              <button
                onClick={handleSaveItem}
                disabled={selectedDays.length === 0}
                className="w-full bg-primary text-black py-4 rounded-xl font-bold hover:bg-white transition-all disabled:opacity-50 disabled:hover:bg-primary shadow-lg shadow-primary/10 mt-2 flex items-center justify-center gap-2"
              >
                {editingId ? <Check size={18} /> : <Plus size={18} />}
                {editingId ? 'Update Task' : 'Schedule Task'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: List */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium text-primary flex items-center gap-2">
              <Calendar size={20} className="text-secondary" />
              {editingId ? 'Editing Selection...' : 'Active Schedules'}
            </h2>
            <span className="bg-surfaceHighlight px-3 py-1 rounded-full text-xs text-secondary border border-border">{schedule.length} active</span>
          </div>

          <div className={`bg-surface border border-border rounded-xl overflow-hidden backdrop-blur-sm bg-opacity-80 flex-1 flex flex-col transition-opacity duration-300 ${editingId ? 'opacity-50 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
            {schedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-neutral-600">
                <div className="w-16 h-16 rounded-full bg-surfaceHighlight flex items-center justify-center mb-4">
                  <Clock size={32} className="opacity-40" />
                </div>
                <p className="text-lg font-medium text-neutral-500">No scheduled tasks</p>
                <p className="text-sm">Create a new task using the panel on the left.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {schedule.map((item) => (
                  <div key={item.id} className={`p-4 sm:p-5 flex items-center justify-between group hover:bg-neutral-900/40 transition-colors ${editingId === item.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}>
                    <div className="flex items-center gap-5">
                      <div
                        onClick={() => !editingId && toggleEnabled(item.id)} // Disable toggle while editing
                        className={`w-12 h-7 rounded-full cursor-pointer relative transition-colors ${item.enabled ? 'bg-primary' : 'bg-neutral-800 border border-neutral-700'} ${editingId ? 'cursor-not-allowed opacity-80' : ''}`}
                      >
                        <div className={`absolute top-1 left-1 bg-black w-5 h-5 rounded-full transition-transform shadow-sm ${item.enabled ? 'translate-x-5' : 'translate-x-0 bg-neutral-500'}`}></div>
                      </div>

                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-mono text-primary tracking-tight">{item.time}</span>
                          <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider ${item.day === 'Daily'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                            {item.day}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-secondary mt-1">
                          <Power size={12} />
                          <span>{item.action}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditing(item)}
                        disabled={!!editingId} // Disable if already editing something
                        className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-500 hover:text-primary hover:bg-neutral-800 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                        title="Edit Task"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => removeScheduleItem(item.id)}
                        disabled={!!editingId}
                        className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-500 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                        title="Remove Task"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Scheduler;