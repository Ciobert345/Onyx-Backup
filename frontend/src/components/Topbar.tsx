export default function Topbar(){
  return (
    <header className="border-b border-border bg-surface-1/70 backdrop-blur-xs flex items-center justify-between px-4 md:px-6 h-14">
      <input aria-label="Cerca" placeholder="Search" className="bg-surface-2 border border-border rounded-md px-3 py-2 w-64 text-sm outline-none" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white/10" aria-label="User avatar" />
      </div>
    </header>
  )
}
