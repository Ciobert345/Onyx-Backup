import { useEffect, useState } from 'react'
import { api } from '../api'

type Node = { name: string, is_dir?: boolean, size?: number, mtime?: number }

type FsTreeResponse = {
  entries?: Node[]
}

export default function TreeView({root, onSelect}:{root?:string,onSelect:(path:string)=>void}){
  const [path, setPath] = useState(root)
  const [entries, setEntries] = useState<Node[]>([])

  useEffect(()=>{ (async()=>{
    const data: FsTreeResponse = await api.fsTree(path)
    setEntries(Array.isArray(data?.entries) ? data.entries : [])
  })() }, [path])

  const handleSelect = (path: string) => onSelect(path)

  return (
    <div>
      <div className="text-sm text-text-secondary mb-2 break-all">{path||'~'}</div>
      <div className="grid gap-1">
        {entries.map((e: Node)=> (
          <button key={e.name} className="text-left px-2 py-1 rounded hover:bg-white/5 border border-transparent hover:border-border" onClick={()=> e.is_dir ? setPath(`${path?path+'/':''}${e.name}`) : handleSelect(`${path?path+'/':''}${e.name}`)}>
            {e.is_dir? '📁':'📄'} {e.name}
          </button>
        ))}
      </div>
    </div>
  )
}
