import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchAuditCompare } from '../api/client';
import { ArrowLeftRight, Check, AlertOctagon, HelpCircle, Code2 } from 'lucide-react';
import type { AuditCompareResult, AnalysisResult } from '../types';

export const AuditComparePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const leftId = searchParams.get('left');
  const rightId = searchParams.get('right');

  const [result, setResult] = useState<AuditCompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!leftId || !rightId) {
      setError('Please provide two audit IDs to compare');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchAuditCompare(leftId, rightId)
      .then(setResult)
      .catch((err: any) => setError(err.message || 'Failed to compare audits'))
      .finally(() => setLoading(false));
  }, [leftId, rightId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getFindingRow = (type: 'RESOLVED' | 'NEW' | 'UNCHANGED', finding: AnalysisResult) => {
    const isResolved = type === 'RESOLVED';
    const isNew = type === 'NEW';
    
    let borderClass = 'border-l-slate-300';
    let badgeClass = 'bg-slate-100 text-slate-700';
    if (isResolved) {
      borderClass = 'border-l-emerald-500';
      badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (isNew) {
      borderClass = 'border-l-rose-500';
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    }

    return (
      <div
        key={finding.id}
        className={`grid grid-cols-1 md:grid-cols-2 border border-y border-r rounded-r-xl border-l-4 ${borderClass} mb-4 p-4 transition-all`}
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        {/* Left Audit column */}
        <div className="pr-4 border-r md:border-b-0 border-b pb-4 md:pb-0" style={{ borderColor: 'var(--border-subtle)' }}>
          {isResolved ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
                  RESOLVED
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getSeverityBadgeClass(finding.severity)}`}>
                  {finding.severity}
                </span>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {finding.category}
                </span>
              </div>
              <div className="text-xs font-mono mb-1 truncate" style={{ color: 'var(--text-muted)' }}>
                {finding.filePath}
              </div>
              <p className="text-sm line-through" style={{ color: 'var(--text-muted)' }}>
                {finding.description}
              </p>
            </div>
          ) : isNew ? (
            <div className="flex items-center justify-center h-full text-xs italic" style={{ color: 'var(--text-muted)' }}>
              (Not present in old audit)
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getSeverityBadgeClass(finding.severity)}`}>
                  {finding.severity}
                </span>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {finding.category}
                </span>
              </div>
              <div className="text-xs font-mono mb-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                {finding.filePath}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {finding.description}
              </p>
            </div>
          )}
        </div>

        {/* Right Audit column */}
        <div className="pl-0 md:pl-4 pt-4 md:pt-0">
          {isResolved ? (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 h-full justify-center md:justify-start">
              <Check size={14} /> Resolved in latest code.
            </div>
          ) : isNew ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
                  NEW
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getSeverityBadgeClass(finding.severity)}`}>
                  {finding.severity}
                </span>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {finding.category}
                </span>
              </div>
              <div className="text-xs font-mono mb-1 truncate" style={{ color: 'var(--text-primary)' }}>
                📂 {finding.filePath}{finding.lineRange && <span className="text-indigo-500 ml-1">L{finding.lineRange}</span>}
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {finding.description}
              </p>
              {finding.sourceSnippet && (
                <details className="mt-2">
                  <summary className="cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest py-1 select-none" style={{ color: 'var(--text-muted)' }}>
                    <Code2 size={11} className="text-indigo-500" /> 소스코드 보기
                  </summary>
                  <div className="mt-1.5 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                    <pre className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed bg-[#0d1117] max-h-48 overflow-y-auto">
                      <code className="text-indigo-200">{finding.sourceSnippet}</code>
                    </pre>
                  </div>
                </details>
              )}
              {finding.suggestion && (
                <div className="mt-2.5 p-2.5 rounded-lg text-xs font-mono border"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <div className="font-semibold mb-1 text-[10px] uppercase text-indigo-600">AI 제안:</div>
                  {finding.suggestion}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getSeverityBadgeClass(finding.severity)}`}>
                  {finding.severity}
                </span>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {finding.category}
                </span>
              </div>
              <div className="text-xs font-mono mb-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                {finding.filePath}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {finding.description}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4" />
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Comparing audit reports...</span>
    </div>
  );

  if (error || !result) return (
    <div className="flex flex-col items-center justify-center py-32">
      <AlertOctagon size={48} className="text-rose-500 mb-4" />
      <h3 className="text-lg font-bold mb-2">Comparison Failed</h3>
      <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>{error}</p>
      <Link to="/audits" className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
        Back to History
      </Link>
    </div>
  );

  const { left, right, comparison } = result;

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link to="/" className="transition-colors" style={{ color: 'var(--text-muted)' }}>Dashboard</Link>
          <span>/</span>
          <Link to="/audits" className="transition-colors" style={{ color: 'var(--text-muted)' }}>Audits</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-secondary)' }}>Compare</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
            <ArrowLeftRight size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Audit Report Comparison
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Analyze differences in code quality, security issues and bug findings across two revision runs.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="p-5 rounded-2xl border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            New Issues Introduced
          </div>
          <div className="text-3xl font-extrabold text-rose-600">
            {comparison.summary.newCount}
          </div>
        </div>
        <div className="p-5 rounded-2xl border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Issues Resolved
          </div>
          <div className="text-3xl font-extrabold text-emerald-600">
            {comparison.summary.resolvedCount}
          </div>
        </div>
        <div className="p-5 rounded-2xl border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Unchanged Issues
          </div>
          <div className="text-3xl font-extrabold" style={{ color: 'var(--text-secondary)' }}>
            {comparison.summary.unchangedCount}
          </div>
        </div>
      </div>

      {/* Side-by-Side Metadata Headers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Left Side (Old Audit) */}
        <div className="p-4 rounded-xl border flex items-center justify-between"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-500">Left Audit (Old)</span>
            <div className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {left.event === 'pull_request' ? `PR #${left.ref}` : 'Push Commit'}
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {left.commitHash.substring(0, 8)}
            </div>
          </div>
          <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(left.createdAt).toLocaleString()}
          </div>
        </div>

        {/* Right Side (New Audit) */}
        <div className="p-4 rounded-xl border flex items-center justify-between"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
          <div>
            <span className="text-[10px] font-bold uppercase text-indigo-500">Right Audit (New)</span>
            <div className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {right.event === 'pull_request' ? `PR #${right.ref}` : 'Push Commit'}
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {right.commitHash.substring(0, 8)}
            </div>
          </div>
          <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(right.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Compare Listings */}
      <div className="mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
          Comparison Findings
        </h3>

        {/* New Issues */}
        {comparison.added.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-3">Introduced ({comparison.added.length})</h4>
            {comparison.added.map(f => getFindingRow('NEW', f))}
          </div>
        )}

        {/* Resolved Issues */}
        {comparison.resolved.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">Resolved ({comparison.resolved.length})</h4>
            {comparison.resolved.map(f => getFindingRow('RESOLVED', f))}
          </div>
        )}

        {/* Unchanged Issues */}
        {comparison.unchanged.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Unchanged ({comparison.unchanged.length})</h4>
            {comparison.unchanged.map(f => getFindingRow('UNCHANGED', f))}
          </div>
        )}

        {comparison.added.length === 0 && comparison.resolved.length === 0 && comparison.unchanged.length === 0 && (
          <div className="p-12 text-center rounded-xl border border-dashed" style={{ borderColor: 'var(--border-subtle)' }}>
            <HelpCircle size={32} className="mx-auto mb-3 opacity-15" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No findings available for comparison.</p>
          </div>
        )}
      </div>
    </div>
  );
};
