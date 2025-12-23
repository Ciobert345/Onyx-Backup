import { useEffect, useRef } from 'react'

type P = { values: number[] }
export default function Sparkline({values}: P){
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const w = canvas.width = canvas.clientWidth
    const h = canvas.height = canvas.clientHeight
    ctx.clearRect(0,0,w,h)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    const max = Math.max(1, ...values)
    values.forEach((v,i)=>{
      const x = (i/(values.length-1||1))*w
      const y = h - (v/max)*h
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
    })
    ctx.stroke()
  }, [values])
  return <canvas ref={ref} className="w-full h-8"/>
}
