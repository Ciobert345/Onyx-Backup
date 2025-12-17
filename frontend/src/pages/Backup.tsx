import Card from '../components/Card'
import TreeView from '../components/TreeView'
import Toggle from '../components/Toggle'
import ProgressBar from '../components/ProgressBar'
import { useState } from 'react'
import { api } from '../api'

export default function Backup(){
  const [selected, setSelected] = useState<string[]>([])
  const [excl, setExcl] = useState<string>('**/*.tmp')
  const [mode, setMode] = useState<'oneway'|'twoway'>('oneway')
  const [progress, setProgress] = useState(0)

  async function start(){
    await api.syncStart({ mode, paths: selected, exclusions: excl.split(/\n+/).filter(Boolean), options:{ keep_both: mode==='twoway' } })
    const iv = setInterval(async()=>{
      const st: any = await api.syncStatus(); setProgress(Number(st?.progress||0))
      if(!st?.running) clearInterval(iv)
    }, 1000)
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <h2 className="mb-4">Seleziona cartelle / file</h2>
        <TreeView onSelect={(p: string)=> setSelected((s: string[])=> Array.from(new Set([...s, p])))} />
        <div className="mt-3 text-sm text-text-secondary">Selezionati: {selected.length}</div>
      </Card>
      <Card>
        <h2 className="mb-4">Opzioni</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-text-secondary">Esclusioni (una per riga)</label>
            <textarea value={excl} onChange={(e)=>setExcl(e.target.value)} className="mt-1 w-full h-28 bg-surface-2 border border-border rounded p-2" />
          </div>
          <div className="flex items-center gap-3">
            <span>Modo:</span>
            <select className="bg-surface-2 border border-border rounded p-2" value={mode} onChange={(e)=> setMode(e.target.value as 'oneway'|'twoway')}>
              <option value="oneway">One-way</option>
              <option value="twoway">Two-way</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={start} className="px-4 py-2 rounded border border-border bg-surface-2 hover:shadow-glow">Start</button>
            <button onClick={()=>api.syncStop()} className="px-4 py-2 rounded border border-border bg-surface-2">Stop</button>
          </div>
          <ProgressBar value={progress} />
        </div>
      </Card>
    </div>
  )
}
