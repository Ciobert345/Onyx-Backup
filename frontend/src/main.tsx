import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Backup from './pages/Backup'
import Scheduler from './pages/Scheduler'
import Settings from './pages/Settings'
import Logs from './pages/Logs'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'backup', element: <Backup /> },
      { path: 'scheduler', element: <Scheduler /> },
      { path: 'settings', element: <Settings /> },
      { path: 'logs', element: <Logs /> },
    ],
  },
  { path: '/login', element: <Login /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
