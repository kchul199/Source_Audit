import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchAudits } from '../api/client';
import { GitPullRequest, GitCommit, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, { color: string, icon: any }> = {
    PENDING: { color: 'bg-slate-700 text-slate-300', icon: Clock },
    ANALYZING: { color: 'bg-blue-900 text-blue-300', icon: Loader2 },
    GENERATING_TESTS: { color: 'bg-indigo-900 text-indigo-300', icon: Loader2 },
    EXECUTING_SANDBOX: { color: 'bg-purple-900 text-purple-300', icon: Loader2 },
    COMPLETED: { color: 'bg-emerald-900 text-emerald-300', icon: CheckCircle },
    FAILED: { color: 'bg-rose-900 text-rose-300', icon: XCircle },
  };

  const config = configs[status] || configs.PENDING;
  const Icon = config.icon;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${config.color}`}>
      <Icon size={14} className={status.includes('ING') ? 'animate-spin' : ''} />
      {status}
    </span>
  );
};

export const AuditsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAudits(projectId)
      .then(setAudits)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
      <p className="text-slate-400">Loading audit history...</p>
    </div>
  );

  const projectName = audits.length > 0 ? audits[0].project.name : 'All Projects';

  return (
    <div>
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link to="/" className="hover:text-indigo-400">Projects</Link>
          <span>/</span>
          <span className="text-slate-300">{projectName}</span>
        </div>
        <h1 className="text-3xl font-bold">Audit History</h1>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-700/30 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-widest font-bold">
              <th className="px-6 py-5">Event Type</th>
              <th className="px-6 py-5">Reference</th>
              <th className="px-6 py-5">Status</th>
              <th className="px-6 py-5">Detected At</th>
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {audits.map((audit) => (
              <tr key={audit.id} className="hover:bg-indigo-500/5 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${audit.event === 'pull_request' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {audit.event === 'pull_request' ? <GitPullRequest size={18} /> : <GitCommit size={18} />}
                    </div>
                    <span className="font-semibold text-slate-200 capitalize">{audit.event.replace('_', ' ')}</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-mono text-sm">
                      {audit.event === 'pull_request' ? `PR #${audit.ref}` : audit.commitHash.substring(0, 8)}
                    </span>
                    {audit.event === 'push' && <span className="text-slate-500 text-xs">{audit.ref}</span>}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <StatusBadge status={audit.status} />
                </td>
                <td className="px-6 py-5 text-slate-400 text-sm">
                  {new Date(audit.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-5 text-right">
                  <Link 
                    to={`/audits/${audit.id}`} 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-all"
                  >
                    View Report
                    <ArrowRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {audits.length === 0 && (
          <div className="py-24 text-center">
            <Activity size={48} className="mx-auto text-slate-600 mb-4 opacity-20" />
            <p className="text-slate-500 font-medium">No audit records found for this project.</p>
          </div>
        )}
      </div>
    </div>
  );
};
