export default function ProgressBar({value}:{value:number}){
  return (
    <div className="w-full h-2 bg-surface-2 rounded">
      <div className="h-2 bg-white/30 rounded" style={{width:`${Math.min(100,Math.max(0,value))}%`}} />
    </div>
  )
}
