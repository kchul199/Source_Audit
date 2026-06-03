import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects } from '../api/client';
import { FolderCode, ArrowRight, ExternalLink } from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
      <div className="w-12 h-12 bg-slate-700 rounded-full mb-4"></div>
      <div className="h-4 w-32 bg-slate-700 rounded"></div>
    </div>
  );

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Project Dashboard</h1>
        <p className="text-slate-400">Manage and monitor your automated code audits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
          <p className="text-slate-400 text-sm font-medium mb-1">Total Projects</p>
          <p className="text-3xl font-bold text-indigo-400">{projects.length}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
          <p className="text-slate-400 text-sm font-medium mb-1">Active Monitoring</p>
          <p className="text-3xl font-bold text-emerald-400">Live</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
          <p className="text-slate-400 text-sm font-medium mb-1">System Status</p>
          <p className="text-3xl font-bold text-blue-400">Healthy</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-slate-800/30 rounded-3xl border border-dashed border-slate-700">
            <FolderCode size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-500">No projects registered yet. Send a GitHub webhook to get started!</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-indigo-500/10 p-3 rounded-xl text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <FolderCode size={24} />
                </div>
                <a 
                  href={project.repoUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={18} />
                </a>
              </div>
              <h2 className="text-xl font-bold mb-1 group-hover:text-indigo-300 transition-colors">{project.name}</h2>
              <p className="text-slate-500 text-xs font-mono mb-6 truncate">{project.repoUrl}</p>
              <Link 
                to={`/audits?projectId=${project.id}`} 
                className="flex items-center justify-between w-full p-3 bg-slate-700/50 rounded-xl text-indigo-300 font-semibold group-hover:bg-indigo-600 group-hover:text-white transition-all"
              >
                <span>View Audits</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
