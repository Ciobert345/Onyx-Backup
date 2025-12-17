import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import TitleBar from './components/TitleBar.tsx';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import BackupConfiguration from './components/BackupConfig.tsx';
import Scheduler from './components/Scheduler.tsx';
import Settings from './components/Settings.tsx';
import HistoryPage from './components/History.tsx';

const App: React.FC = () => {
  return (
    <Router>
      <div className="flex flex-col h-screen bg-background text-primary font-sans antialiased overflow-hidden selection:bg-neutral-800 selection:text-white">
        <TitleBar />
        <Sidebar />

        <main className="flex-1 ml-64 h-full overflow-y-auto relative">
          {/* Subtle ambient light effect at top right */}
          <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-gradient-to-b from-neutral-800/10 to-transparent pointer-events-none blur-3xl" />

          <div className="p-10 max-w-7xl mx-auto relative z-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/config" element={<BackupConfiguration />} />
              <Route path="/scheduler" element={<Scheduler />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<Settings />} /> // New route
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;