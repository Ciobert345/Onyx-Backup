import Card from '../components/Card'
import { metricsWS } from '../ws'
import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend,
  ArcElement
} from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement)

export default function Dashboard(){
  const [points, setPoints] = useState<any[]>([])
  useEffect(()=>{
    const ws = metricsWS()
    const unsub = ws.subscribe((d: any)=> setPoints((p: any[])=> [...p.slice(-120), d]))
    return () => unsub()
  }, [])

  const labels = points.map((p: any)=> new Date(p.ts).toLocaleTimeString())
  const cpu = points.map((p: any)=> p.cpu)
  const ram = points.map((p: any)=> Math.round((p.ram.used/p.ram.total)*100))

  const lineData = { labels, datasets: [
    { label: 'CPU %', data: cpu, borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.2)' },
    { label: 'RAM %', data: ram, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.1)' },
  ]}

  const pieData = {
    labels: ['Usato', 'Libero'],
    datasets: [{ data: points.length? [(points as any).at(-1).disk.used, (points as any).at(-1).disk.total - (points as any).at(-1).disk.used] : [0,1], backgroundColor: ['rgba(255,255,255,0.6)','rgba(255,255,255,0.15)']}]
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      <Card>
        <h2 className="mb-2">CPU / RAM</h2>
        <Line data={lineData} options={{plugins:{legend:{labels:{color:'#bdbdbd'}}}, scales:{x:{ticks:{color:'#bdbdbd'}}, y:{ticks:{color:'#bdbdbd'}}}}} />
      </Card>
      <Card>
        <h2 className="mb-2">Disco</h2>
        <div className="max-w-sm">
          <Line data={{labels, datasets:[{label:'Rete RX', data: points.map((p:any)=>p.net.rx), borderColor:'rgba(255,255,255,0.7)'}]}} options={{plugins:{legend:{labels:{color:'#bdbdbd'}}}, scales:{x:{ticks:{display:false}}, y:{ticks:{color:'#bdbdbd'}}}}} />
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <h2 className="mb-2">Uso Disco</h2>
        <div className="max-w-xs">
          <canvas id="pie"></canvas>
        </div>
      </Card>
    </div>
  )
}
