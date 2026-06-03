import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchAudits } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import {
  GitPullRequest, GitCommit, ArrowRight,
  AlertTriangle, ChevronLeft, ChevronRight, Search,
} from 'lucide-react';
import type { Audit, PaginatedResponse } from '../types';

/* ── Skeleton Row ── */
const SkeletonRow: React.FC = () => (
  <tr>
    <td className="px-5 py-4"><div className="skeleton h-4 w-24" /></td>
    <td className="px-5 py-4"><div className="skeleton h-4 w-20" /></td>
    <td className="px-5 py-4"><div className="skeleton h-5 w-28 rounded-full" /></td>
    <td className="px-5 py-4"><div className="skeleton h-4 w-32" /></td>
    <td className="px-5 py-4 text-right"><div className="skeleton h-8 w-24 rounded-lg ml-auto" /></td>
  </tr>
);

export const AuditsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;
  const currentPage = Number(searchParams.get('page') || '1');

  const [result, setResult] = useState<PaginatedResponse<Audit> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAudits(projectId, currentPage, 15)
      .then(setResult)
      .catch((err: any) => setError(err.message || 'Failed to fetch audits'))
      .finally(() => setLoading(false));
  }, [projectId, currentPage]);

  useEffect(() => { loadData(); }, [loadData]);

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
  };

  const audits = result?.data || [];
  const pagination = result?.pagination;
  const projectName = audits.length > 0 ? audits[0].project.name : 'All Projects';

  /* ── Error State ── */
  if (error && !result) return (
    <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(248,113,113,0.1)' }}>
        <AlertTriangle size={28} style={{ color: 'var(--danger)' }} />
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Failed to load audits</h3>
      <p className="text-sm mb-8" style={{ color: 'var(--text-tertiary)' }}>{error}</p>
      <button onClick={loadData} className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        Try Again
      </button>
    </div>
  );

  return (
    <div className="animate-fade-in-up">
      {/* Breadcrumb & Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium mb-3"
          style={{ color: 'var(--text-muted)' }}>
          <Link to="/" className="transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
            Dashboard
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-secondary)' }}>{projectName}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Audit History
            </h1>
            {pagination && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {pagination.total} total record{pagination.total !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <table className="w-full text-left">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['Event', 'Reference', 'Status', 'Detected', ''].map((h) => (
                <th key={h} className={`px-5 py-4 text-[10px] font-bold uppercase tracking-[0.15em] ${h === '' ? 'text-right' : ''}`}
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)
            ) : audits.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-24 text-center">
                  <Search size={36} className="mx-auto mb-4 opacity-15" style={{ color: 'var(--text-muted)' }} />
                  <p className="font-medium text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    No audit records found.
                  </p>
                </td>
              </tr>
            ) : (
              audits.map((audit, idx) => (
                <tr
                  key={audit.id}
                  className="transition-colors animate-fade-in"
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    animationDelay: `${idx * 30}ms`,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: audit.event === 'pull_request'
                            ? 'rgba(129,140,248,0.1)' : 'rgba(52,211,153,0.1)',
                          color: audit.event === 'pull_request' ? 'var(--accent)' : 'var(--success)',
                        }}>
                        {audit.event === 'pull_request'
                          ? <GitPullRequest size={15} />
                          : <GitCommit size={15} />}
                      </div>
                      <span className="text-sm font-semibold capitalize"
                        style={{ color: 'var(--text-primary)' }}>
                        {audit.event.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {audit.event === 'pull_request' ? `PR #${audit.ref}` : audit.commitHash.substring(0, 8)}
                    </span>
                    {audit.event === 'push' && (
                      <span className="block text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {audit.ref}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={audit.status} />
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(audit.createdAt).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/audits/${audit.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99,102,241,0.12)';
                        e.currentTarget.style.borderColor = 'var(--border-accent)';
                        e.currentTarget.style.color = 'var(--accent-bright)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-surface)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      View <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 animate-fade-in">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-25"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
            let pageNum: number;
            const total = pagination.totalPages;
            if (total <= 7) {
              pageNum = i + 1;
            } else if (currentPage <= 4) {
              pageNum = i + 1;
            } else if (currentPage >= total - 3) {
              pageNum = total - 6 + i;
            } else {
              pageNum = currentPage - 3 + i;
            }
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                onClick={() => goToPage(pageNum)}
                className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: isActive ? 'var(--accent-dim)' : 'var(--bg-card)',
                  border: `1px solid ${isActive ? 'transparent' : 'var(--border-subtle)'}`,
                  color: isActive ? '#fff' : 'var(--text-tertiary)',
                  boxShadow: isActive ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                }}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= pagination.totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-25"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
