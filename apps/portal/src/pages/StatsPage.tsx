import React, { useEffect, useState, useCallback } from 'react';
import { fetchStats, fetchStatsTrend } from '../api/client';
import type { DashboardStats, ProjectStats, TrendData } from '../types';
import {
  BarChart3, ShieldAlert, Zap, Settings, AlertTriangle,
  RotateCw, Beaker, CheckCircle2, ChevronDown, FolderOpen,
  ArrowUpRight, Info, Activity, Sliders, Puzzle, Bug,
  TrendingUp, ActivitySquare
} from 'lucide-react';

/* ── Progress Bar Component ── */
const ProgressBar: React.FC<{
  label: string;
  count: number;
  total: number;
  color: string;
  percentage: number;
}> = ({ label, count, total, color, percentage }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-xs font-semibold">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>
        {count} <span style={{ color: 'var(--text-muted)' }}>/ {total} ({percentage}%)</span>
      </span>
    </div>
    <div className="h-2 w-full rounded-full overflow-hidden border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${percentage}%`,
          background: color,
          boxShadow: `0 0 10px ${color}40`,
        }}
      />
    </div>
  </div>
);

export const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Trend Chart States
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [trendRange, setTrendRange] = useState<string>('30d');
  const [trendLoading, setTrendLoading] = useState<boolean>(false);

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchStats()
      .then((data) => {
        setStats(data);
        if (data.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data.projects[0].id);
        }
      })
      .catch((err: any) => setError(err.message || 'Failed to load statistics'))
      .finally(() => setLoading(false));
  };

  const loadTrend = useCallback(() => {
    setTrendLoading(true);
    fetchStatsTrend(selectedProjectId || undefined, trendRange)
      .then(setTrendData)
      .catch((err) => console.error('Failed to load trend stats', err))
      .finally(() => setTrendLoading(false));
  }, [selectedProjectId, trendRange]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <RotateCw size={40} className="text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400">Loading system statistics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'rgba(248,113,113,0.1)' }}>
          <AlertTriangle size={28} style={{ color: 'var(--danger)' }} />
        </div>
        <h3 className="text-lg font-bold mb-2">Failed to load statistics</h3>
        <p className="text-sm mb-8 text-slate-400">{error || 'No statistics available.'}</p>
        <button
          onClick={loadData}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  const { global, projects } = stats;
  const selectedProject = projects.find((p) => p.id === selectedProjectId) as ProjectStats | undefined;

  // Helper to calculate percentages safely
  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  // Global Finding Aggregates
  const totalFindings = Object.values(global.findingCategoryCounts).reduce((a, b) => a + b, 0);

  const categoriesConfig = [
    { key: 'SECURITY', label: 'Security', color: '#f43f5e', icon: ShieldAlert },
    { key: 'PERFORMANCE', label: 'Performance', color: '#fb923c', icon: Zap },
    { key: 'MAINTAINABILITY', label: 'Maintainability', color: '#3b82f6', icon: Settings },
    { key: 'STABILITY', label: 'Stability', color: '#10b981', icon: Activity },
    { key: 'FLEXIBILITY', label: 'Flexibility', color: '#a855f7', icon: Sliders },
    { key: 'EXTENSIBILITY', label: 'Extensibility', color: '#06b6d4', icon: Puzzle },
    { key: 'ERROR_PRONE', label: 'Error Prone', color: '#ef4444', icon: Bug },
  ];

  // Global Test Aggregates
  const totalTests = Object.values(global.testStatusCounts).reduce((a, b) => a + b, 0);
  const passedTests = global.testStatusCounts.PASSED || 0;
  const healedTests = global.testStatusCounts.HEALED || 0;
  const failedTests = global.testStatusCounts.FAILED || 0;
  const timeoutTests = global.testStatusCounts.TIMEOUT || 0;
  const successTests = passedTests + healedTests;

  return (
    <div className="space-y-10 pb-20 animate-fade-in-up">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <BarChart3 className="text-indigo-500" />
          Analytics Dashboard
        </h1>
        <p className="text-sm text-slate-400">
          Analyze code vulnerabilities, test success rates, and AI healing effectiveness across all repositories.
        </p>
      </div>

      {/* ── Global Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="rounded-2xl p-6 glass hover-glow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><FolderOpen size={72} /></div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Repositories</p>
          <p className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{global.totalProjects}</p>
        </div>
        <div className="rounded-2xl p-6 glass hover-glow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><Beaker size={72} /></div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Code Audits</p>
          <p className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{global.totalAudits}</p>
        </div>
        <div className="rounded-2xl p-6 glass hover-glow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><ShieldAlert size={72} /></div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Detected Issues</p>
          <p className="text-3xl font-extrabold text-rose-400">{totalFindings}</p>
        </div>
        <div className="rounded-2xl p-6 glass hover-glow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><Beaker size={72} /></div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Avg Healing Loops</p>
          <p className="text-3xl font-extrabold text-indigo-400">{global.avgHealingIterations} <span className="text-xs font-bold text-slate-400">/ 3</span></p>
        </div>
      </div>

      {/* ── Global Visual Analytics Section ── */}
      <div className="space-y-6">
        {/* Category Share (SVG Ring Charts) - Full Width */}
        <div className="rounded-2xl p-6 glass flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Info size={16} className="text-indigo-500" />
              Issue Category Breakdown
            </h3>
            {totalFindings === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No issues detected to display.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-6 py-4 justify-items-center">
                {categoriesConfig.map((cat) => {
                  const count = global.findingCategoryCounts[cat.key] || 0;
                  const percent = getPercentage(count, totalFindings);
                  const CatIcon = cat.icon;
                  const dashArray = 2 * Math.PI * 32;
                  const dashOffset = dashArray - (percent / 100) * dashArray;

                  return (
                    <div key={cat.key} className="flex flex-col items-center space-y-2">
                      <div className="relative w-20 h-20">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="40" cy="40" r="32" className="stroke-slate-100 fill-none" strokeWidth="6" style={{ stroke: 'var(--bg-secondary)' }} />
                          <circle cx="40" cy="40" r="32" className="fill-none" stroke={cat.color} strokeWidth="6"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: cat.color }}>{percent}%</span>
                      </div>
                      <span className="text-[11px] font-bold flex items-center gap-1 text-center" style={{ color: 'var(--text-secondary)' }}>
                        <CatIcon size={12} style={{ color: cat.color }} />
                        {cat.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">({count}건)</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="pt-4 mt-4 flex justify-between text-xs" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <span>Critical Security flaws:</span>
            <span className="font-bold text-rose-500">{global.findingSeverityCounts.CRITICAL || 0} found</span>
          </div>
        </div>

        {/* Severity Metrics & Test Suite Health - 2 Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Severity Metrics (Custom Bars) */}
          <div className="rounded-2xl p-6 glass space-y-6">
            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <ShieldAlert size={16} className="text-rose-500" />
              Vulnerability Severity Distribution
            </h3>
            {totalFindings === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No issues detected to display.</div>
            ) : (
              <div className="space-y-4">
                <ProgressBar
                  label="CRITICAL"
                  count={global.findingSeverityCounts.CRITICAL || 0}
                  total={totalFindings}
                  color="linear-gradient(90deg, #ef4444, #f43f5e)"
                  percentage={getPercentage(global.findingSeverityCounts.CRITICAL || 0, totalFindings)}
                />
                <ProgressBar
                  label="HIGH"
                  count={global.findingSeverityCounts.HIGH || 0}
                  total={totalFindings}
                  color="linear-gradient(90deg, #f97316, #fb923c)"
                  percentage={getPercentage(global.findingSeverityCounts.HIGH || 0, totalFindings)}
                />
                <ProgressBar
                  label="MEDIUM"
                  count={global.findingSeverityCounts.MEDIUM || 0}
                  total={totalFindings}
                  color="linear-gradient(90deg, #eab308, #facc15)"
                  percentage={getPercentage(global.findingSeverityCounts.MEDIUM || 0, totalFindings)}
                />
                <ProgressBar
                  label="LOW"
                  count={global.findingSeverityCounts.LOW || 0}
                  total={totalFindings}
                  color="linear-gradient(90deg, #3b82f6, #60a5fa)"
                  percentage={getPercentage(global.findingSeverityCounts.LOW || 0, totalFindings)}
                />
              </div>
            )}
          </div>

          {/* Automated Testing Success (Gauge Chart) */}
          <div className="rounded-2xl p-6 glass flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <CheckCircle2 size={16} className="text-emerald-500" />
                Automated Test Success Rate
              </h3>
              {totalTests === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No test executions recorded.</div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-20 overflow-hidden flex items-end justify-center">
                    <svg className="w-32 h-32 absolute top-0">
                      <circle cx="64" cy="64" r="48" className="stroke-slate-100 fill-none" strokeWidth="8" style={{ stroke: 'var(--bg-secondary)' }}
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={Math.PI * 48}
                      />
                      <circle cx="64" cy="64" r="48" className="stroke-emerald-400 fill-none" strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={2 * Math.PI * 48 - (getPercentage(successTests, totalTests) / 100) * (Math.PI * 48)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="text-center z-10 pb-1">
                      <span className="text-2xl font-black text-slate-800" style={{ color: 'var(--text-primary)' }}>{getPercentage(successTests, totalTests)}%</span>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>SUCCESS</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 w-full px-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Passed:</span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{passedTests}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Healed:</span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{healedTests}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Failed:</span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{failedTests}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> Timeout:</span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{timeoutTests}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quality Trend Analysis Section (NEW) ── */}
      <div className="space-y-6">
        <div className="rounded-2xl p-6 glass flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <TrendingUp size={16} className="text-indigo-500" />
              Quality Trend Analysis (Security, Performance, Maintainability)
            </h3>
            {/* Range Selectors */}
            <div className="flex gap-1.5 p-1 rounded-xl border text-xs font-semibold" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              {['7d', '30d', '90d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setTrendRange(r)}
                  className={`px-3 py-1.5 rounded-lg transition-all capitalize ${
                    trendRange === r
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {trendLoading ? (
            <div className="flex items-center justify-center py-20">
              <RotateCw size={24} className="text-indigo-500 animate-spin mr-2" />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading trend data...</span>
            </div>
          ) : trendData.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">No trend data found.</div>
          ) : (
            <div className="w-full">
              {/* SVG Area/Line Chart */}
              <div className="h-64 relative w-full border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                {(() => {
                  const width = 800;
                  const height = 240;
                  
                  // Find max value in data to scale properly
                  const maxVal = Math.max(
                    ...trendData.map(d => Math.max(d.Security, d.Performance, d.Maintainability, 1))
                  ) + 2;

                  const getPath = (key: 'Security' | 'Performance' | 'Maintainability') => {
                    if (trendData.length < 2) return `0,${height} L ${width},${height}`;
                    return trendData.map((d, i) => {
                      const x = (i / (trendData.length - 1)) * width;
                      const y = height - (d[key] / maxVal) * height;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    }).join(' L ');
                  };

                  const getAreaPath = (key: 'Security' | 'Performance' | 'Maintainability') => {
                    const linePath = getPath(key);
                    return `${linePath} L ${width},${height} L 0,${height} Z`;
                  };

                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                      {/* Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                        <line
                          key={i}
                          x1="0"
                          y1={height * r}
                          x2={width}
                          y2={height * r}
                          stroke="var(--border-subtle)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      ))}

                      {/* Security Area & Line (Rose) */}
                      <path d={`M ${getAreaPath('Security')}`} fill="rgba(244,63,94,0.04)" />
                      <path d={`M ${getPath('Security')}`} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Performance Area & Line (Blue) */}
                      <path d={`M ${getAreaPath('Performance')}`} fill="rgba(59,130,246,0.04)" />
                      <path d={`M ${getPath('Performance')}`} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Maintainability Area & Line (Amber) */}
                      <path d={`M ${getAreaPath('Maintainability')}`} fill="rgba(245,158,11,0.04)" />
                      <path d={`M ${getPath('Maintainability')}`} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Interactive Dots for Data Points (Last point) */}
                      {trendData.length > 0 && (() => {
                        const lastIdx = trendData.length - 1;
                        const secY = height - (trendData[lastIdx].Security / maxVal) * height;
                        const perfY = height - (trendData[lastIdx].Performance / maxVal) * height;
                        const maintY = height - (trendData[lastIdx].Maintainability / maxVal) * height;
                        return (
                          <>
                            <circle cx={width} cy={secY} r="4" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                            <circle cx={width} cy={perfY} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
                            <circle cx={width} cy={maintY} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                          </>
                        );
                      })()}
                    </svg>
                  );
                })()}
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <span>Security Flaws</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Performance Issues</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Maintainability Debts</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Mini Trends (Test Success & Healing Iterations) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Success Rate Trend */}
          <div className="rounded-2xl p-6 glass flex flex-col justify-between">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <ActivitySquare size={16} className="text-emerald-500" />
              Test Success Rate Trend
            </h3>
            {trendLoading ? (
              <div className="h-32 flex items-center justify-center"><RotateCw size={20} className="animate-spin text-emerald-500" /></div>
            ) : trendData.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">No data.</div>
            ) : (
              <div className="h-32 w-full relative">
                {(() => {
                  const width = 400;
                  const height = 120;
                  if (trendData.length < 2) return <div className="text-center text-xs py-10">Waiting for more data points</div>;
                  const points = trendData.map((d, i) => {
                    const x = (i / (trendData.length - 1)) * width;
                    const y = height - (d.testSuccessRate / 100) * height;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  }).join(' L ');
                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                      <path d={`M ${points}`} fill="none" stroke="#10b981" strokeWidth="2.5" />
                      {trendData.length > 0 && (
                        <circle cx={width} cy={height - (trendData[trendData.length - 1].testSuccessRate / 100) * height} r="4" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                      )}
                    </svg>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Average Healing Iterations */}
          <div className="rounded-2xl p-6 glass flex flex-col justify-between">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Activity size={16} className="text-indigo-500" />
              Average Healing Iterations
            </h3>
            {trendLoading ? (
              <div className="h-32 flex items-center justify-center"><RotateCw size={20} className="animate-spin text-indigo-500" /></div>
            ) : trendData.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">No data.</div>
            ) : (
              <div className="h-32 w-full flex items-end justify-between gap-1 pt-2">
                {trendData.map((d, idx) => {
                  const pct = Math.min(100, (d.avgHealingIterations / 3) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full rounded-t-sm transition-all duration-500 bg-indigo-500 hover:bg-indigo-600"
                        style={{ height: `${pct}%`, minHeight: '4px' }}
                      />
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {d.avgHealingIterations.toFixed(2)} loops
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Repository-wise Statistics Section ── */}
      <section className="space-y-6 pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Repository Statistics</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Select a repository to inspect its individual code health metrics.</p>
          </div>

          {/* Repo Selection Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-between w-64 px-4 py-2.5 rounded-xl border text-sm font-semibold hover:border-slate-400 transition-all focus:outline-none"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-medium)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="truncate">{selectedProject?.name || 'Select Repository'}</span>
              <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border shadow-2xl z-20 overflow-hidden py-1"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-medium)',
                }}
              >
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-xs transition-colors hover:bg-slate-100 flex items-center justify-between ${
                      p.id === selectedProjectId ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-600'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      {p.totalAudits} audits
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Repo Stats View */}
        {selectedProject ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Repo Summary Info Card */}
            <div className="rounded-2xl p-6 glass flex flex-col justify-between h-fit lg:col-span-1">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-50/10 text-indigo-600 border border-indigo-500/20">
                    Repository Info
                  </span>
                  <a href={selectedProject.repoUrl} target="_blank" rel="noreferrer" className="transition-colors" style={{ color: 'var(--text-secondary)' }}>
                    <ArrowUpRight size={18} />
                  </a>
                </div>
                <h3 className="text-lg font-bold mb-1 truncate" style={{ color: 'var(--text-primary)' }}>{selectedProject.name}</h3>
                <p className="text-xs font-mono truncate mb-6" style={{ color: 'var(--text-secondary)' }}>{selectedProject.repoUrl}</p>

                <div className="space-y-4 pt-4 text-xs" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Total Audits Run:</span>
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{selectedProject.totalAudits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Average Healing Loops:</span>
                    <span className="font-bold text-indigo-600">{selectedProject.avgHealingIterations} / 3</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Repo Issues and Tests Stats */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Findings Breakdown */}
              <div className="rounded-2xl p-6 glass space-y-6">
                <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <ShieldAlert size={15} className="text-rose-500" />
                  Code Issue Categories
                </h4>
                {selectedProject.totalAudits === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">No audits have run for this project.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categoriesConfig.map((cat) => {
                      const count = selectedProject.findingCategoryCounts[cat.key] || 0;
                      const CatIcon = cat.icon;
                      return (
                        <div key={cat.key} className="flex items-center justify-between p-2.5 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${cat.color}15`, color: cat.color }}><CatIcon size={14} /></div>
                            <span className="text-[11px] font-bold truncate max-w-[90px] sm:max-w-none" style={{ color: 'var(--text-secondary)' }}>{cat.label}</span>
                          </div>
                          <span className="text-xs font-black shrink-0" style={{ color: cat.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Automated Tests Success */}
              <div className="rounded-2xl p-6 glass space-y-6">
                <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Beaker size={15} className="text-emerald-500" />
                  Test Suite Health
                </h4>
                {selectedProject.totalAudits === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">No test results recorded.</div>
                ) : (
                  <div className="space-y-4">
                    {/* Passed / Healed Success */}
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex justify-between items-center">
                      <div>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>PASSED & HEALED</p>
                        <p className="text-lg font-black text-emerald-500">
                          {((selectedProject.testStatusCounts.PASSED || 0) + (selectedProject.testStatusCounts.HEALED || 0))}
                          <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}> tests</span>
                        </p>
                      </div>
                      <CheckCircle2 size={24} className="text-emerald-500" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Failed */}
                      <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/10">
                        <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>Failed</p>
                        <p className="text-base font-black text-rose-500">{selectedProject.testStatusCounts.FAILED || 0}</p>
                      </div>
                      {/* Timeout */}
                      <div className="p-3.5 rounded-xl bg-orange-500/5 border border-orange-500/10">
                        <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>Timeout</p>
                        <p className="text-base font-black text-orange-500">{selectedProject.testStatusCounts.TIMEOUT || 0}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-400">No project data available.</div>
        )}
      </section>
    </div>
  );
};
