export default function Toggle({checked, onChange, label}:{checked:boolean,onChange:(v:boolean)=>void,label?:string}){
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={`w-12 h-6 rounded-full border border-border relative transition-colors ${checked?'bg-accent':'bg-surface-2'}`} onClick={()=>onChange(!checked)}>
        <span className={`absolute top-0.5 ${checked?'left-6':'left-1'} w-5 h-5 rounded-full bg-white/20`}></span>
      </span>
    </label>
  )
}
