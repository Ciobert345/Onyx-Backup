import Card from '../components/Card'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { notificationsWS } from '../ws'

export default function Scheduler() {
  const [action, setAction] = useState('hibernate')
  const [days, setDays] = useState<string[]>(['Mon', 'Wed', 'Fri'])
  const [time, setTime] = useState('02:30')
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    const ws = notificationsWS()
    const unsub = ws.subscribe((e) => setEvents(ev => [...ev.slice(-50), e]))
    return () => { unsub() }
  }, [])

  async function addJob() {
    const id = `${action}-${time}-${Math.random().toString(36).slice(2, 8)}`
    await api.scheduleCreate({ id, action, days, time })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4">Nuovo job</h2>
        <div className="grid gap-3">
          <div className="flex gap-2 items-center">
            <label>Action</label>
            <select className="bg-surface-2 border border-border rounded p-2" value={action} onChange={e => setAction(e.target.value)}>
              <option value="hibernate">Hibernate</option>
              <option value="shutdown">Shutdown</option>
              <option value="restart">Restart</option>
            </select>
          </div>
          <div>
            <label>Giorni</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <button key={d} onClick={() => setDays(x => x.includes(d) ? x.filter(i => i !== d) : [...x, d])} className={`px-3 py-1 rounded border ${days.includes(d) ? 'bg-white/20 border-border' : 'bg-surface-2 border-border'}`}>{d}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <label>Ora</label>
            <input className="bg-surface-2 border border-border rounded p-2" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={addJob} className="px-4 py-2 rounded border border-border bg-surface-2 hover:shadow-glow">Aggiungi</button>
          </div>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4">Eventi</h2>
        <div className="h-64 overflow-auto text-sm">
          {events.map((e, i) => (<div key={i} className="border-b border-border/50 py-1 opacity-80">{e.type} {e.job_id || ''} {e.seconds ? `in ${e.seconds}s` : ''}</div>))}
        </div>
      </Card>
    </div>
  )
}
