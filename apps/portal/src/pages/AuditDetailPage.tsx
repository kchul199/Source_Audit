import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAuditDetail, retryAudit } from '../api/client';
import { 
  ArrowLeft, RefreshCw, ShieldAlert, Zap, Settings, 
  Code2, Terminal, AlertTriangle, CheckCircle2, History,
  Activity, Clock, Loader2, XCircle, CheckCircle
} from 'lucide-react';

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

export const AuditDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'tests'>('analysis');

  const loadData = () => {
    if (!id) return;
    fetchAuditDetail(id)
      .then(setAudit)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();

    const handleStatusChange = (e: any) => {
      const { auditId, status } = e.detail;
      if (auditId === id) {
        setAudit((prev: any) => prev ? { ...prev, status } : prev);
        // If it completed or failed, reload full data to get findings/tests
        if (status === 'COMPLETED' || status === 'FAILED') {
          loadData();
        }
      }
    };

    window.addEventListener('audit_status_change', handleStatusChange);
    return () => window.removeEventListener('audit_status_change', handleStatusChange);
  }, [id]);

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      await retryAudit(id);
      loadData();
    } catch (error) {
      alert('Failed to retry audit');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <div className="text-center py-20">Loading audit details...</div>;
  if (!audit) return <div className="text-center py-20">Audit not found.</div>;

  const findings = audit.analysisResults || [];
  const testResults = audit.testResults || [];
  const latestTest = testResults[0]; // Assuming most recent first

  const groupedFindings = findings.reduce((acc: any, f: any) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'HIGH': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'LOW': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const categoryIcon = (category: string) => {
    switch (category) {
      case 'SECURITY': return <ShieldAlert size={20} className="text-rose-400" />;
      case 'PERFORMANCE': return <Zap size={20} className="text-yellow-400" />;
      case 'MAINTAINABILITY': return <Settings size={20} className="text-blue-400" />;
      default: return <AlertTriangle size={20} />;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="sticky top-16 z-10 -mx-8 px-8 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={`/audits?projectId=${audit.projectId}`} className="p-2 bg-slate-800 rounded-xl hover:bg-indigo-600 text-white transition-all shadow-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold">{audit.project.name}</h1>
              <span className="text-slate-500 font-mono text-sm">#{audit.ref}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500">{audit.commitHash.substring(0, 12)}</span>
              <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
              <span className="text-xs text-slate-500">{new Date(audit.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <StatusBadge status={audit.status} />
          </div>
          <button 
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 text-white"
          >
            <RefreshCw size={18} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Retrying...' : 'Re-run Audit'}
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 p-1.5 rounded-2xl flex w-fit border border-slate-700">
        <button 
          onClick={() => setActiveTab('analysis')}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <div className="flex items-center gap-2">
            <Activity size={18} />
            Analysis Results
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('tests')}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'tests' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <div className="flex items-center gap-2">
            <Code2 size={18} />
            Automated Tests
          </div>
        </button>
      </div>

      {activeTab === 'analysis' ? (
        <div className="grid grid-cols-1 gap-10">
          {Object.keys(groupedFindings).length === 0 && (
            <div className="bg-slate-800/30 rounded-3xl p-32 text-center border-2 border-slate-700 border-dashed">
              <div className="bg-emerald-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Clean Audit!</h3>
              <p className="text-slate-500 max-w-md mx-auto">AI analysis didn't find any critical issues in this change. You're good to go.</p>
            </div>
          )}
          {Object.entries(groupedFindings).map(([category, items]: [string, any]) => (
            <section key={category}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                  {categoryIcon(category)}
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{category}</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{items.length} Issue{items.length > 1 ? 's' : ''} Identified</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {items.map((finding: any) => (
                  <div key={finding.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden hover:border-slate-500 transition-all shadow-lg">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-lg border text-[11px] font-black tracking-widest uppercase shadow-sm ${severityColor(finding.severity)}`}>
                            {finding.severity}
                          </span>
                        </div>
                        <span className="text-slate-500 text-xs font-mono bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
                          {finding.filePath}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-100 mb-3">{finding.description}</h4>
                      {finding.suggestion && (
                        <div className="mt-6 bg-indigo-500/5 rounded-2xl p-6 border border-indigo-500/20 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap size={64} className="text-indigo-400" />
                          </div>
                          <div className="text-indigo-400 text-xs font-black uppercase mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                            Proposed Fix
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed relative z-10">{finding.suggestion}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {!latestTest ? (
            <div className="bg-slate-800 rounded-xl p-20 text-center border border-slate-700 border-dashed">
              <Code2 size={48} className="mx-auto text-slate-600 mb-4 opacity-50" />
              <p className="text-slate-400">No tests generated yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                  <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <Code2 size={14} /> generated_test_spec.ts
                    </div>
                  </div>
                  <pre className="p-6 overflow-x-auto text-sm font-mono text-indigo-200 leading-relaxed bg-[#0d1117]">
                    <code>{latestTest.testCode}</code>
                  </pre>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <History size={18} className="text-indigo-400" />
                    Execution Stats
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-slate-400 text-sm">Status</span>
                      <span className={`text-sm font-bold ${latestTest.status === 'PASSED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {latestTest.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-slate-400 text-sm">Iterations</span>
                      <span className="text-sm font-bold text-slate-200">{latestTest.iterationCount} / 3</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-400 text-sm">Exit Code</span>
                      <span className="text-sm font-bold font-mono text-slate-200">{latestTest.exitCode ?? 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl border border-slate-700">
                  <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2 text-xs text-slate-400">
                    <Terminal size={14} /> Console Output
                  </div>
                  <div className="p-4 h-64 overflow-y-auto font-mono text-[11px] text-slate-300 leading-tight">
                    {latestTest.stderr || latestTest.stdout || 'No logs available.'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
