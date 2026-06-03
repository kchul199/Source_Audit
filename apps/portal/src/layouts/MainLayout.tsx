import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Shield, LayoutDashboard, Database, Activity } from 'lucide-react';

export const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <nav className="bg-slate-800 border-b border-slate-700 h-16 flex items-center px-6 sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-indigo-400">
          <Shield size={28} />
          <span>Src-Audit</span>
        </Link>
        <div className="ml-10 flex gap-6">
          <Link to="/" className="flex items-center gap-2 hover:text-indigo-300 transition-colors">
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link to="/audits" className="flex items-center gap-2 hover:text-indigo-300 transition-colors">
            <Activity size={20} />
            Recent Audits
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};
