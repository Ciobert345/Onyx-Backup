import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, Clock, Server, LogOut, History } from 'lucide-react';
import { ipcService } from '../services/ipcService.ts';

const Sidebar: React.FC = () => {
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Server, label: 'Backup Config', path: '/config' },
    { icon: Clock, label: 'Power Schedule', path: '/scheduler' },
    { icon: History, label: 'History', path: '/history' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-border h-screen flex flex-col fixed left-0 top-0 z-10">
      <div className="p-8 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Server size={20} className="text-black" />
        </div>
        <span className="text-xl font-semibold tracking-tight text-white">Onyx</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                ? 'bg-neutral-100 text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={() => ipcService.quitApp()}
          className="flex items-center gap-3 w-full px-4 py-3 text-neutral-500 hover:text-red-400 transition-colors text-sm font-medium rounded-lg hover:bg-neutral-900/50"
        >
          <LogOut size={18} />
          Quit App
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
