import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAuditDetail, retryAudit } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { useAuditContext } from '../context/AuditContext';
import {
  ArrowLeft, RefreshCw, ShieldAlert, Zap, Settings,
  Code2, Terminal, AlertTriangle, CheckCircle2, History,
  Activity, Loader2, Beaker, Sliders, Puzzle, Bug, Download
} from 'lucide-react';
import type { Audit, AnalysisResult, TestResult, HealingIteration } from '../types';

/* ── Pure SVG Radar Chart Component ── */
const RadarChart: React.FC<{ findings: AnalysisResult[] }> = ({ findings }) => {
  const categories = [
    { key: 'SECURITY', label: 'Security' },
    { key: 'PERFORMANCE', label: 'Performance' },
    { key: 'MAINTAINABILITY', label: 'Maintainability' },
    { key: 'STABILITY', label: 'Stability' },
    { key: 'FLEXIBILITY', label: 'Flexibility' },
    { key: 'EXTENSIBILITY', label: 'Extensibility' },
    { key: 'ERROR_PRONE', label: 'Error Prone' },
  ];

  const counts = categories.map(cat => ({
    label: cat.label,
    count: findings.filter(f => f.category === cat.key).length,
  }));

  const maxCount = Math.max(...counts.map(c => c.count), 1);
  const size = 300;
  const center = size / 2;
  const radius = size * 0.35;

  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 / 7) * index - Math.PI / 2;
    const r = (value / maxCount) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const gridPaths = gridLevels.map(level => {
    const points = Array.from({ length: 7 }, (_, i) => {
      const angle = (Math.PI * 2 / 7) * i - Math.PI / 2;
      const x = center + (radius * level) * Math.cos(angle);
      const y = center + (radius * level) * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
    return points;
  });

  const dataPoints = counts.map((c, i) => getCoordinates(i, c.count));
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border" style={{ borderColor: 'rgba(15, 23, 42, 0.06)' }}>
      <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#475569' }}>Quality Radar Analysis</h3>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible" xmlns="http://www.w3.org/2000/svg">
          {gridPaths.map((path, idx) => (
            <polygon
              key={idx}
              points={path}
              fill="none"
              stroke="rgba(15, 23, 42, 0.06)"
              strokeWidth="1"
              strokeDasharray={idx < 3 ? "2 2" : "none"}
            />
          ))}
          {Array.from({ length: 7 }).map((_, i) => {
            const end = getCoordinates(i, maxCount);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={end.x}
                y2={end.y}
                stroke="rgba(15, 23, 42, 0.06)"
                strokeWidth="1"
              />
            );
          })}
          {findings.length > 0 && (
            <polygon
              points={dataPath}
              fill="rgba(99,102,241,0.12)"
              stroke="#4f46e5"
              strokeWidth="2"
            />
          )}
          {counts.map((c, i) => {
            const labelPos = getCoordinates(i, maxCount + 0.35);
            return (
              <g key={i}>
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  className="text-[10px] font-bold"
                  style={{ fill: '#475569' }}
                >
                  {c.label} ({c.count})
                </text>
                {findings.length > 0 && (
                  <circle
                    cx={dataPoints[i].x}
                    cy={dataPoints[i].y}
                    r="3.5"
                    fill="#4f46e5"
                    stroke="#fff"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const AuditDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { subscribe } = useAuditContext();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'tests'>('analysis');

  const loadData = useCallback(() => {
    if (!id) return;
    setError(null);
    fetchAuditDetail(id)
      .then(setAudit)
      .catch((err: any) => setError(err.message || 'Failed to fetch audit detail'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to real-time status updates via Context
  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribe(id, (status) => {
      setAudit((prev) => (prev ? { ...prev, status: status as Audit['status'] } : prev));
      // Reload full data when completed or failed
      if (status === 'COMPLETED' || status === 'FAILED') {
        loadData();
      }
    });
    return unsubscribe;
  }, [id, subscribe, loadData]);

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      await retryAudit(id);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to retry audit');
    } finally {
      setRetrying(false);
    }
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('audit-report-content');
    if (!element) return;
    
    const button = document.getElementById('export-pdf-btn');
    if (button) {
      button.innerText = 'Exporting...';
      button.setAttribute('disabled', 'true');
    }

    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      
      const jspdfModule = await import('jspdf');
      const jsPDFClass = jspdfModule.jsPDF || jspdfModule.default;
      if (!jsPDFClass) {
        throw new Error('jsPDF could not be resolved from imports');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDFClass('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `src_audit_${audit?.project.name.toLowerCase()}_pr_${audit?.ref}.pdf`;
      pdf.save(filename);
    } catch (err: any) {
      console.error('Failed to export PDF', err);
      setError('PDF export failed. Please try again.');
    } finally {
      if (button) {
        button.innerText = 'Export Report';
        button.removeAttribute('disabled');
      }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
      <p className="text-slate-400">Loading audit details...</p>
    </div>
  );

  if (error && !audit) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="bg-rose-500/10 p-4 rounded-2xl mb-4">
        <AlertTriangle size={32} className="text-rose-400" />
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Failed to load audit</h3>
      <p className="text-slate-400 text-sm mb-6">{error}</p>
      <button onClick={loadData} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all">
        Retry
      </button>
    </div>
  );

  if (!audit) return <div className="text-center py-20 text-slate-400">Audit not found.</div>;

  const findings: AnalysisResult[] = audit.analysisResults || [];
  const testResults: TestResult[] = audit.testResults || [];
  const latestTest: TestResult | undefined = testResults[0];

  const groupedFindings = findings.reduce<Record<string, AnalysisResult[]>>((acc, f) => {
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
      case 'SECURITY': return <ShieldAlert size={20} className="text-rose-500" />;
      case 'PERFORMANCE': return <Zap size={20} className="text-amber-500" />;
      case 'MAINTAINABILITY': return <Settings size={20} className="text-blue-500" />;
      case 'STABILITY': return <Activity size={20} className="text-emerald-500" />;
      case 'FLEXIBILITY': return <Sliders size={20} className="text-purple-500" />;
      case 'EXTENSIBILITY': return <Puzzle size={20} className="text-cyan-500" />;
      case 'ERROR_PRONE': return <Bug size={20} className="text-rose-600" />;
      default: return <AlertTriangle size={20} className="text-slate-400" />;
    }
  };

  const testStatusColor = (status: string) => {
    switch (status) {
      case 'PASSED': return 'text-emerald-400';
      case 'HEALED': return 'text-indigo-400';
      case 'FAILED': return 'text-rose-400';
      case 'TIMEOUT': return 'text-orange-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Sticky Header */}
      <div
        className="sticky top-16 z-10 -mx-8 px-8 py-4 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{
          background: 'var(--bg-glass)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-4">
          <Link
            to={`/audits?projectId=${audit.projectId}`}
            className="p-2 rounded-xl transition-all shadow-sm"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-card)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{audit.project.name}</h1>
              <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>#{audit.ref}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{audit.commitHash.substring(0, 12)}</span>
              <div className="w-1 h-1 rounded-full" style={{ background: 'var(--border-medium)' }}></div>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(audit.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <StatusBadge status={audit.status} />
          </div>
          <button
            id="export-pdf-btn"
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <Download size={14} /> Export Report
          </button>
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

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-rose-400 shrink-0" />
          <p className="text-rose-600 text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Tab Selector */}
      <div className="p-1.5 rounded-2xl flex w-fit" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <div className="flex items-center gap-2">
            <Activity size={18} />
            Analysis Results ({findings.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('tests')}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'tests' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <div className="flex items-center gap-2">
            <Code2 size={18} />
            Automated Tests {latestTest ? `(${latestTest.status})` : ''}
          </div>
        </button>
      </div>

      {/* Analysis Results Tab */}
      {activeTab === 'analysis' ? (
        <div id="audit-report-content" className="grid grid-cols-1 gap-10 bg-white p-6 rounded-3xl border border-slate-100">
          {findings.length > 0 && (
            <div className="flex justify-center">
              <RadarChart findings={findings} />
            </div>
          )}
          {Object.keys(groupedFindings).length === 0 && (
            <div className="rounded-3xl p-32 text-center border-2 border-dashed" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-medium)' }}>
              <div className="bg-emerald-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Clean Audit!</h3>
              <p className="max-w-md mx-auto" style={{ color: 'var(--text-tertiary)' }}>AI analysis didn't find any critical issues in this change. You're good to go.</p>
            </div>
          )}
          {Object.entries(groupedFindings).map(([category, items]) => (
            <section key={category}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                  {categoryIcon(category)}
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{category}</h2>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{items.length} Issue{items.length > 1 ? 's' : ''} Identified</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {items.map((finding) => (
                  <div
                    key={finding.id}
                    className="rounded-2xl overflow-hidden hover-glow transition-all shadow-md"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-lg border text-[11px] font-black tracking-widest uppercase shadow-sm ${severityColor(finding.severity)}`}>
                            {finding.severity}
                          </span>
                        </div>
                        <span className="text-xs font-mono px-3 py-1 rounded-full border"
                          style={{
                            background: 'var(--bg-secondary)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {finding.filePath}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{finding.description}</h4>
                      {finding.suggestion && (
                        <div className="mt-6 bg-indigo-500/5 rounded-2xl p-6 border border-indigo-500/10 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap size={64} className="text-indigo-400" />
                          </div>
                          <div className="text-indigo-600 text-xs font-black uppercase mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                            Proposed Fix
                          </div>
                          <p className="text-sm leading-relaxed relative z-10 font-medium" style={{ color: 'var(--text-secondary)' }}>{finding.suggestion}</p>
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
        /* Tests Tab */
        <div className="space-y-6">
          {!latestTest ? (
            <div className="rounded-xl p-20 text-center border border-dashed animate-fade-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-medium)' }}>
              <Code2 size={48} className="mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No tests generated yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Test Code Panel */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-xl overflow-hidden shadow-md" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div className="px-4 py-2 flex justify-between items-center" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2 text-xs font-semibold font-mono" style={{ color: 'var(--text-secondary)' }}>
                      <Code2 size={14} /> generated_test_spec.ts
                    </div>
                    <span className={`text-xs font-bold ${testStatusColor(latestTest.status)}`}>
                      {latestTest.status}
                    </span>
                  </div>
                  <pre className="p-6 overflow-x-auto text-sm font-mono text-indigo-200 leading-relaxed bg-[#0d1117] max-h-[600px] overflow-y-auto">
                    <code>{latestTest.testCode}</code>
                  </pre>
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                {/* Execution Stats */}
                <div className="rounded-xl p-6 shadow-md" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <History size={18} className="text-indigo-500" />
                    Execution Stats
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Status</span>
                      <span className={`text-sm font-bold ${testStatusColor(latestTest.status)}`}>
                        {latestTest.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Iterations</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{latestTest.iterationCount} / 3</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Exit Code</span>
                      <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{latestTest.exitCode ?? 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Error Analysis */}
                {latestTest.errorAnalysis && (
                  <div className="bg-orange-500/5 rounded-xl p-6 border border-orange-500/10">
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-orange-600 text-sm">
                      <AlertTriangle size={16} />
                      AI Error Analysis
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{latestTest.errorAnalysis}</p>
                  </div>
                )}

                {/* Console Output */}
                <div className="rounded-xl overflow-hidden shadow-md" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div className="px-4 py-2 flex items-center gap-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <Terminal size={14} /> Console Output
                  </div>
                  <div className="p-4 h-64 overflow-y-auto font-mono text-[11px] leading-tight whitespace-pre-wrap bg-slate-950 text-slate-300">
                    {latestTest.stderr || latestTest.stdout || 'No logs available.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Healing Iterations Timeline */}
          {latestTest && latestTest.healingIterations && latestTest.healingIterations.length > 1 && (
            <div className="mt-8">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Beaker size={20} className="text-indigo-500" />
                Self-Healing Timeline
              </h3>
              <div className="space-y-4">
                {latestTest.healingIterations.map((iter: HealingIteration) => (
                  <details
                    key={iter.id}
                    className="rounded-xl overflow-hidden shadow-sm transition-all"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                  >
                    <summary
                      className="px-6 py-4 cursor-pointer transition-colors flex items-center justify-between"
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          iter.exitCode === 0
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : 'bg-rose-500/20 text-rose-600'
                        }`}>
                          {iter.iteration}
                        </div>
                        <div>
                          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                            Iteration {iter.iteration}
                          </span>
                          <span className={`ml-3 text-xs font-bold ${iter.exitCode === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {iter.exitCode === 0 ? 'PASSED' : `EXIT ${iter.exitCode}`}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(iter.createdAt).toLocaleTimeString()}</span>
                    </summary>
                    <div className="px-6 py-4 space-y-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      {iter.errorAnalysis && (
                        <div className="bg-orange-500/5 rounded-lg p-4 border border-orange-500/10">
                          <p className="text-xs font-bold text-orange-600 mb-2">AI Analysis</p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{iter.errorAnalysis}</p>
                        </div>
                      )}
                      <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="px-4 py-2 text-xs font-semibold font-mono" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                          Test Code (Iteration {iter.iteration})
                        </div>
                        <pre className="p-4 overflow-x-auto text-xs font-mono text-indigo-200 leading-relaxed bg-[#0d1117] max-h-64 overflow-y-auto">
                          <code>{iter.testCode}</code>
                        </pre>
                      </div>
                      {(iter.stdout || iter.stderr) && (
                        <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                          <div className="px-4 py-2 text-xs font-semibold flex items-center gap-2" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            <Terminal size={12} /> Output
                          </div>
                          <pre className="p-4 overflow-x-auto text-[11px] font-mono leading-tight max-h-48 overflow-y-auto whitespace-pre-wrap bg-slate-950 text-slate-300">
                            {iter.stderr || iter.stdout}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
