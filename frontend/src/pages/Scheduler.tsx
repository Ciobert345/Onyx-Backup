import Card from '../components/Card'
import { useEffect, useState, useMemo } from 'react'
import { api } from '../api' // Uses new IPC API
import { notificationsWS } from '../ws' // Uses new IPC listener

// Helper for day shifting
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const getNextDay = (day: string) => {
  const idx = DAYS.indexOf(day);
  return DAYS[(idx + 1) % 7];
};

export default function Scheduler() {
  const [action, setAction] = useState('hibernate')
  const [days, setDays] = useState<string[]>(['Mon', 'Wed', 'Fri'])
  const [time, setTime] = useState('02:30')
  const [events, setEvents] = useState<any[]>([])

  // Ambiguity State - Inline
  const [ambiguityChoice, setAmbiguityChoice] = useState<'same' | 'next'>('next'); // Default to next mostly

  // Derived state to check if we are in "Night Mode" (00:00 - 05:00)
  const isNightTime = useMemo(() => {
    const [h] = time.split(':').map(Number);
    return h >= 0 && h <= 5;
  }, [time]);

  useEffect(() => {
    // Listen for backend notifications
    const unsubscribe = window.electronAPI.onNotification((e: any) => {
      setEvents(ev => [...ev.slice(-50), e]);
    });
    // Load initial history or events if needed
    return () => { if (unsubscribe) (unsubscribe as any)() }; // clean up if possible
  }, [])

  async function handleAddClick() {
    let finalDays = [...days];

    // Apply Shift Logic if Night Time and "Next Day" is selected
    if (isNightTime && ambiguityChoice === 'next') {
      finalDays = finalDays.map(d => getNextDay(d));
    }

    const job = {
      id: `${action}-${time}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      days: finalDays,
      time
    };

    await submitJob(job);
  }

  async function submitJob(job: any) {
    try {
      await api.scheduleCreate(job);
      // Optional: Trigger a refresh or notification success locally
      setEvents(ev => [...ev, { type: 'INFO', job_id: job.id, message: 'Created' }]);
    } catch (err: any) {
      setEvents(ev => [...ev, { type: 'ERROR', message: err.message }]);
    }
  }

  console.log('[DEBUG] Rendering Scheduler. isNightTime:', isNightTime);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="mb-2 text-xl font-bold">Nuovo job</h2>
        <div className="grid gap-2">
          <div className="flex gap-2 items-center">
            <label className="w-20">Action</label>
            <select className="bg-surface-2 border border-border rounded p-2 flex-1" value={action} onChange={e => setAction(e.target.value)}>
              <option value="hibernate">Hibernate</option>
              <option value="shutdown">Shutdown</option>
              <option value="restart">Restart</option>
            </select>
          </div>
          <div>
            <label className="block mb-1">Giorni</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => (
                <button key={d} onClick={() => setDays(x => x.includes(d) ? x.filter(i => i !== d) : [...x, d])}
                  className={`px-3 py-1 rounded border transition-colors ${days.includes(d) ? 'bg-primary/20 border-primary text-primary' : 'bg-surface-2 border-border hover:border-primary/50'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <label className="w-20">Ora</label>
            <input className="bg-surface-2 border border-border rounded p-2" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>

          {/* Inline Ambiguity UI */}
          {isNightTime && (
            <div className="bg-surface-2/50 border border-yellow-500/30 p-2 rounded mt-1">
              <p className="text-xs text-yellow-500 font-bold mb-1">⚠ Orario Notturno (00:00 - 05:00)</p>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="ambiguity" checked={ambiguityChoice === 'same'} onChange={() => setAmbiguityChoice('same')} />
                  <span className="text-xs">Mattina Stesso Giorno (es. Venerdì Mattina)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="ambiguity" checked={ambiguityChoice === 'next'} onChange={() => setAmbiguityChoice('next')} />
                  <span className="text-xs">Notte (Giorno Dopo) (es. Notte Ven-Sab)</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button onClick={handleAddClick} className="px-5 py-1.5 rounded bg-primary text-black font-semibold hover:opacity-90 transition-opacity">
              Aggiungi
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-xl font-bold">Eventi Recenti</h2>
        <div className="h-48 overflow-auto text-sm font-mono bg-surface-1 p-2 rounded">
          {events.length === 0 && <div className="text-gray-500 italic">Nessun evento recente</div>}
          {events.map((e, i) => (
            <div key={i} className="border-b border-white/10 py-0.5 opacity-80">
              <span className="text-[10px] text-gray-400">[{new Date().toLocaleTimeString()}]</span> {e.type} {e.job_id || ''} {e.message || ''}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
