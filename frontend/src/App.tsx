import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import NavSidebar from './components/NavSidebar'
import Topbar from './components/Topbar'

export default function App() {
  const navigate = useNavigate()
  const loc = useLocation()
  return (
    <div className="min-h-screen bg-bg text-text-primary flex">
      <NavSidebar currentPath={loc.pathname} onNavigate={(p)=>navigate(p)} />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 grid gap-6" style={{background:'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))'}}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
