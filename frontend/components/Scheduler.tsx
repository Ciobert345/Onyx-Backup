import React, { useState, useEffect, useMemo } from 'react';
import { Power, Clock, Plus, Trash2, Calendar, Check, Pencil, X } from 'lucide-react';
import { ScheduleItem, PowerAction } from '../types.ts';
import { ipcService } from '../services/ipcService.ts';

const Scheduler: React.FC = () => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting: Daily first, then by Day index, then by Time
  const sortSchedule = (items: ScheduleItem[]) => {
    const dayOrder: Record<string, number> = {
      'Daily': 0,
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7
    };

    return [...items].sort((a, b) => {
      // 1. Sort by Day Priority
      const dayA = dayOrder[a.day] ?? 99;
      const dayB = dayOrder[b.day] ?? 99;
      if (dayA !== dayB) return dayA - dayB;

      // 2. Sort by Time
      return a.time.localeCompare(b.time);
    });
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    const items = await ipcService.getSchedule();
    setSchedule(sortSchedule(items));
    setLoading(false);
  };

  // State for new/editing task
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('00:00');
  const [newAction, setNewAction] = useState<PowerAction>(PowerAction.SHUTDOWN);
  const [dayOffset, setDayOffset] = useState<0 | 1>(1); // Default to next day for night times
  
  // Check if current time is in night range (00:00 - 05:59)
  const isNightTime = useMemo(() => {
    const [hour] = newTime.split(':').map(Number);
    return hour >= 0 && hour <= 5;
  }, [newTime]);

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
        dayOffset: isNightTime ? dayOffset : undefined,
      });
    } else {
      // Create individual items
      newItems = selectedDays.map(day => ({
        id: Math.random().toString(36).substr(2, 9) + '-' + day, // Ensure unique ID
        day: day,
        time: newTime,
        action: newAction,
        enabled: true,
        dayOffset: isNightTime ? dayOffset : undefined,
      }));
    }

    // Apply Sort
    const updated = sortSchedule([...currentSchedule, ...newItems]);
    setSchedule(updated);
    ipcService.saveSchedule(updated);

    // Reset selection nicely
    resetForm();
  };

  const startEditing = (item: ScheduleItem) => {
    setEditingId(item.id);
    setNewTime(item.time);
    setNewAction(item.action as PowerAction);
    
    // Restore dayOffset if it exists, otherwise default based on time
    const [hour] = item.time.split(':').map(Number);
    const isItemNightTime = hour >= 0 && hour <= 5;
    setDayOffset(isItemNightTime && item.dayOffset !== undefined ? item.dayOffset : 1);

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
    setDayOffset(1); // Reset to default (next day)
  };

  const removeScheduleItem = (id: string) => {
    const updated = sortSchedule(schedule.filter(item => item.id !== id));
    setSchedule(updated);
    ipcService.saveSchedule(updated);
    if (editingId === id) resetForm(); // Cancel edit if deleted
  };

  const toggleEnabled = (id: string) => {
    const updated = schedule.map(item =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    // Sort shouldn't change, but keeps consistency
    setSchedule(updated);
    ipcService.saveSchedule(updated);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto h-full flex flex-col animate-fade-in pb-8">
      <header>
        <h1 className="text-3xl font-light text-primary tracking-tight">Power Scheduler</h1>
        <p className="text-secondary text-sm mt-1">Automate shutdown, restart, and hibernation tasks</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-start">

        {/* Left Col: Create/Edit Task */}
        <div className="lg:col-span-4 h-full flex flex-col">
          <div className={`bg-surface border ${editingId ? 'border-primary/50' : 'border-border'} rounded-xl backdrop-blur-sm bg-opacity-80 shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full`}>
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-border/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editingId ? 'bg-primary/10' : 'bg-primary/5'}`}>
                    {editingId ? <Pencil size={16} className="text-primary" /> : <Plus size={16} className="text-primary" />}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-primary">
                      {editingId ? 'Edit Task' : 'Create Task'}
                    </h3>
                    <p className="text-xs text-secondary mt-0.5">
                      {editingId ? 'Modify scheduled task' : 'Schedule a new power action'}
                    </p>
                  </div>
                </div>
                {editingId && (
                  <button 
                    onClick={resetForm} 
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">

              {/* 1. Action Selection */}
              <div>
                <label className="text-xs uppercase text-secondary font-semibold mb-2.5 block tracking-wider">
                  Action
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(PowerAction).map(action => (
                    <button
                      key={action}
                      onClick={() => setNewAction(action)}
                      className={`
                        px-3 py-2.5 rounded-lg text-xs font-medium border transition-all
                        flex flex-col items-center justify-center gap-1.5 group relative
                        ${newAction === action
                          ? 'bg-primary/10 border-primary text-primary shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                          : 'bg-surfaceHighlight/50 border-border text-secondary hover:bg-surfaceHighlight hover:border-border/80 hover:text-primary/80'
                        }
                      `}
                    >
                      <Power size={14} className={newAction === action ? 'text-primary' : 'text-secondary group-hover:text-primary/80'} />
                      <span>{action}</span>
                      {newAction === action && (
                        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Time Selection */}
              <div>
                <label className="text-xs uppercase text-secondary font-semibold mb-2.5 block tracking-wider">
                  Time
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => {
                      const timeValue = e.target.value;
                      if (timeValue) {
                        setNewTime(timeValue);
                        // Reset dayOffset based on time range
                        const [hour] = timeValue.split(':').map(Number);
                        if (hour >= 0 && hour <= 5) {
                          // Night time: default to next day
                          setDayOffset(1);
                        } else {
                          // Day time: reset dayOffset (not applicable)
                          setDayOffset(1); // Keep default, but won't be used
                        }
                      }
                    }}
                    step="60"
                    className="time-input w-full bg-surfaceHighlight border border-border text-primary rounded-lg px-4 py-3 text-lg font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all hover:border-border/80"
                    style={{ 
                      cursor: 'text',
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield',
                      colorScheme: 'dark'
                    }}
                  />
                </div>
                
                {/* Night Time Day Selection */}
                {isNightTime && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Clock size={14} className="text-secondary" />
                      <span className="text-xs text-secondary uppercase tracking-wider">Orario notturno</span>
                    </div>
                    <div className="flex gap-3">
                      <label 
                        className="flex items-center gap-2.5 cursor-pointer group flex-1 select-none"
                        onClick={() => setDayOffset(0)}
                      >
                        <div className="relative flex items-center justify-center">
                          <input
                            type="radio"
                            name="dayOffset"
                            checked={dayOffset === 0}
                            onChange={() => setDayOffset(0)}
                            className="sr-only"
                          />
                          <div className={`
                            w-5 h-5 rounded-full border-2 transition-all duration-300 ease-out
                            ${dayOffset === 0 
                              ? 'border-primary bg-primary shadow-[0_0_0_4px_rgba(255,255,255,0.08),0_0_12px_rgba(255,255,255,0.15)] scale-100' 
                              : 'border-border bg-surfaceHighlight group-hover:border-primary/60 group-hover:bg-surfaceHighlight/90 group-active:scale-95'
                            }
                          `}>
                            {dayOffset === 0 && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-black shadow-sm transition-all duration-200 scale-100" />
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`
                          text-xs transition-all duration-200
                          ${dayOffset === 0 
                            ? 'text-primary font-semibold' 
                            : 'text-secondary group-hover:text-primary/90'
                          }
                        `}>
                          Stesso giorno
                        </span>
                      </label>
                      <label 
                        className="flex items-center gap-2.5 cursor-pointer group flex-1 select-none"
                        onClick={() => setDayOffset(1)}
                      >
                        <div className="relative flex items-center justify-center">
                          <input
                            type="radio"
                            name="dayOffset"
                            checked={dayOffset === 1}
                            onChange={() => setDayOffset(1)}
                            className="sr-only"
                          />
                          <div className={`
                            w-5 h-5 rounded-full border-2 transition-all duration-300 ease-out
                            ${dayOffset === 1 
                              ? 'border-primary bg-primary shadow-[0_0_0_4px_rgba(255,255,255,0.08),0_0_12px_rgba(255,255,255,0.15)] scale-100' 
                              : 'border-border bg-surfaceHighlight group-hover:border-primary/60 group-hover:bg-surfaceHighlight/90 group-active:scale-95'
                            }
                          `}>
                            {dayOffset === 1 && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-black shadow-sm transition-all duration-200 scale-100" />
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`
                          text-xs transition-all duration-200
                          ${dayOffset === 1 
                            ? 'text-primary font-semibold' 
                            : 'text-secondary group-hover:text-primary/90'
                          }
                        `}>
                          Giorno dopo
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Day Selection */}
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <label className="text-xs uppercase text-secondary font-semibold tracking-wider">
                    Repeat On
                  </label>
                  <button 
                    onClick={selectAllDays} 
                    className="text-[10px] uppercase font-semibold text-primary/80 hover:text-primary transition-colors tracking-wider px-2 py-0.5 rounded hover:bg-primary/5"
                  >
                    {selectedDays.length === 7 ? 'Clear' : 'All'}
                  </button>
                </div>
                <div className="flex justify-between gap-1.5">
                  {WEEKDAYS.map((day, index) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(index)}
                        className={`
                          flex-1 aspect-square rounded-lg text-xs font-semibold transition-all
                          flex items-center justify-center border
                          ${isSelected
                            ? 'bg-primary text-black border-primary shadow-[0_0_0_1px_rgba(255,255,255,0.1)] scale-[1.02]'
                            : 'bg-surfaceHighlight/50 border-border text-secondary hover:bg-surfaceHighlight hover:border-border/80 hover:text-primary/80'
                          }
                        `}
                        title={day}
                      >
                        {SHORT_DAYS[index]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-center text-xs text-secondary/70 mt-2.5 h-4">
                  {selectedDays.length === 7 ? 'Daily' : selectedDays.length > 0 ? `${selectedDays.length} selected` : 'Select days'}
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-4 border-t border-border/50">
              <button
                onClick={handleSaveItem}
                disabled={selectedDays.length === 0}
                className={`
                  w-full py-3 rounded-lg font-semibold transition-all
                  flex items-center justify-center gap-2
                  ${selectedDays.length === 0
                    ? 'bg-surfaceHighlight/50 text-secondary/50 cursor-not-allowed'
                    : 'bg-primary text-black hover:bg-white shadow-lg shadow-primary/10 active:scale-[0.98]'
                  }
                `}
              >
                {editingId ? <Check size={16} /> : <Plus size={16} />}
                {editingId ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: List */}
        <div className="lg:col-span-8 h-full flex flex-col">
          <div className={`
            bg-surface border border-border rounded-xl overflow-hidden 
            backdrop-blur-sm bg-opacity-80 flex flex-col transition-all duration-300 h-full
            ${editingId ? 'opacity-50 pointer-events-none grayscale-[0.5]' : 'opacity-100'}
          `}>
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-border/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                    <Calendar size={16} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-primary">
                      {editingId ? 'Editing Selection...' : 'Active Schedules'}
                    </h3>
                    {!editingId && schedule.length > 0 && (
                      <p className="text-xs text-secondary mt-0.5">
                        {schedule.length} {schedule.length === 1 ? 'task' : 'tasks'} scheduled
                      </p>
                    )}
                  </div>
                </div>
                {schedule.length > 0 && (
                  <span className="bg-surfaceHighlight/80 px-2.5 py-1 rounded-md text-xs font-medium text-secondary border border-border/50">
                    {schedule.length} {schedule.length === 1 ? 'task' : 'tasks'}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0">
            {schedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-16">
                <div className="w-20 h-20 rounded-2xl bg-surfaceHighlight/50 flex items-center justify-center mb-5 border border-border/50">
                  <Clock size={28} className="text-secondary/50" />
                </div>
                <p className="text-base font-medium text-primary mb-1">No scheduled tasks</p>
                <p className="text-xs text-secondary/70 text-center max-w-xs">
                  Create your first scheduled task using the panel on the left
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50 overflow-y-auto custom-scrollbar flex-1">
                {schedule.map((item) => {
                  const isDaily = item.day === 'Daily';
                  return (
                    <div 
                      key={item.id} 
                      className={`
                        px-5 py-4 flex items-center justify-between group
                        transition-all duration-200
                        ${editingId === item.id 
                          ? 'bg-primary/10 border-l-2 border-primary' 
                          : 'hover:bg-surfaceHighlight/30'
                        }
                        ${!item.enabled ? 'opacity-60' : ''}
                      `}
                    >
                      <div className="flex items-center gap-5 flex-1 min-w-0">
                        {/* 1. Toggle Switch */}
                        <div
                          onClick={() => !editingId && toggleEnabled(item.id)}
                          className={`
                            w-10 h-6 shrink-0 rounded-full cursor-pointer relative transition-all duration-200
                            ${item.enabled 
                              ? 'bg-primary shadow-[0_0_0_2px_rgba(255,255,255,0.1)]' 
                              : 'bg-surfaceHighlight border border-border/50'
                            }
                            ${editingId ? 'cursor-not-allowed opacity-50' : 'hover:scale-105'}
                          `}
                        >
                          <div className={`
                            absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-200
                            shadow-sm flex items-center justify-center
                            ${item.enabled 
                              ? 'translate-x-[18px] bg-black' 
                              : 'translate-x-0 bg-secondary/40'
                            }
                          `}>
                            {item.enabled && (
                              <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                            )}
                          </div>
                        </div>

                        {/* 2. Time & Day Info */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-baseline gap-2.5 flex-wrap">
                            <span className="text-xl font-mono text-primary tracking-tight leading-none">
                              {item.time}
                            </span>
                            <span className={`
                              text-[10px] px-2 py-0.5 rounded-md uppercase font-semibold tracking-wider shrink-0
                              ${isDaily
                                ? 'bg-purple-500/10 text-purple-400/90 border border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-400/90 border border-blue-500/20'
                              }
                            `}>
                              {item.day}
                            </span>
                            {(() => {
                              const [hour] = item.time.split(':').map(Number);
                              const isItemNightTime = hour >= 0 && hour <= 5;
                              if (isItemNightTime && item.dayOffset !== undefined) {
                                return (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-surfaceHighlight/60 text-secondary/80 border border-border/40 shrink-0">
                                    {item.dayOffset === 0 ? 'Stesso' : 'Dopo'}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-secondary/80 mt-2">
                            <Power size={11} className="text-secondary/60" />
                            <span className="font-medium">{item.action}</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Actions */}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0 ml-4">
                        <button
                          onClick={() => startEditing(item)}
                          disabled={!!editingId}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-surfaceHighlight transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit Task"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => removeScheduleItem(item.id)}
                          disabled={!!editingId}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove Task"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Scheduler;