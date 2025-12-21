type Props = { currentPath: string, onNavigate: (path:string)=>void }

const items = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/backup', label: 'Backup', icon: '💾' },
  { path: '/scheduler', label: 'Scheduler', icon: '⏰' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
  { path: '/logs', label: 'Logs', icon: '🗒️' },
]

export default function NavSidebar({currentPath, onNavigate}: Props){
  return (
    <aside className="w-16 md:w-20 border-r border-border bg-surface-1 flex flex-col items-center py-4 gap-3">
      {items.map(it=> (
        <button key={it.path} title={it.label} onClick={()=>onNavigate(it.path)} className={`w-10 h-10 rounded-md border border-border flex items-center justify-center hover:shadow-glow ${currentPath===it.path?'bg-surface-3':'bg-surface-2'}`}>
          <span aria-hidden>{it.icon}</span>
        </button>
      ))}
    </aside>
  )
}
