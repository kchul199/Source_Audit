import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchWebhookEvents, getErrorMessage } from '../api/client';
import {
  Webhook, CheckCircle, XCircle, AlertTriangle, ArrowRight,
  ChevronLeft, ChevronRight, RefreshCw, GitPullRequest, GitCommit
} from 'lucide-react';
import type { WebhookEvent, PaginatedResponse } from '../types';

export const WebhookEventsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get('page') || '1');

  const [result, setResult] = useState<PaginatedResponse<WebhookEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchWebhookEvents(currentPage, 15)
      .then(setResult)
      .catch((err: unknown) => setError(getErrorMessage(err, 'Failed to fetch webhook events')))
      .finally(() => setLoading(false));
  }, [currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
  };

  const events = result?.data || [];
  const pagination = result?.pagination;

  const getStatusIcon = (outcome: string) => {
    switch (outcome) {
      case 'ACCEPTED':
        return <CheckCircle size={16} className="text-emerald-500 shrink-0" />;
      case 'REJECTED':
        return <XCircle size={16} className="text-rose-500 shrink-0" />;
      default:
        return <AlertTriangle size={16} className="text-amber-500 shrink-0" />;
    }
  };

  const getOutcomeBadgeClass = (outcome: string) => {
    switch (outcome) {
      case 'ACCEPTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
            <Link to="/" className="transition-colors" style={{ color: 'var(--text-muted)' }}>Dashboard</Link>
            <span>/</span>
            <span style={{ color: 'var(--text-secondary)' }}>Webhook Events</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
              <Webhook size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Webhook Debug Console
              </h1>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Monitor and debug incoming GitHub webhook requests and audit outcomes.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Outcome Descriptions / Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="p-4 rounded-xl border flex gap-3 bg-slate-50/50 hover-glow transition-all" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 h-fit border border-emerald-100">
            <CheckCircle size={16} />
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>ACCEPTED (수락됨)</div>
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              웹훅의 서명이 정상 검증되고 모니터링 대상 브랜치/레포지토리 규칙을 만족하여 AI 감사 진단 및 자동화 테스트 파이프라인이 정상 작동했습니다.
            </p>
          </div>
        </div>
        <div className="p-4 rounded-xl border flex gap-3 bg-slate-50/50 hover-glow transition-all" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0 h-fit border border-amber-100">
            <AlertTriangle size={16} />
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>FILTERED (필터링됨)</div>
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              웹훅 서명은 유효하나 감시 대상 제외 브랜치(예: 피처/임시 브랜치) 등으로 분석 대상 규칙을 만족하지 않아 작업을 유보/생략했습니다.
            </p>
          </div>
        </div>
        <div className="p-4 rounded-xl border flex gap-3 bg-slate-50/50 hover-glow transition-all" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0 h-fit border border-rose-100">
            <XCircle size={16} />
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>REJECTED (거절됨)</div>
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              서명 검증 실패, 권한이 없는 발송 사용자, 혹은 비활성화된 프로젝트에 대한 요청으로 보안/구성 규칙에 따라 거부 처리되었습니다.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="rounded-2xl overflow-visible border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <table className="w-full text-left">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['Status', 'Event', 'Repository / Branch', 'Sender', 'Outcome', 'Received At', ''].map((h) => (
                <th key={h} className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td colSpan={7} className="px-5 py-6"><div className="skeleton h-5 w-full rounded" /></td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={7} className="py-24 text-center">
                  <AlertTriangle size={36} className="mx-auto mb-4 text-rose-500" />
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{error}</p>
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-24 text-center">
                  <Webhook size={36} className="mx-auto mb-4 opacity-15" style={{ color: 'var(--text-muted)' }} />
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-tertiary)' }}>No webhook events found.</p>
                </td>
              </tr>
            ) : (
              events.map((event, idx) => (
                <tr
                  key={event.id}
                  className="transition-colors border-b"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    animationDelay: `${idx * 20}ms`,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-5 py-4">
                    {getStatusIcon(event.outcome)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                        style={{
                          background: event.event === 'pull_request' ? 'rgba(129,140,248,0.1)' : 'rgba(52,211,153,0.1)',
                          color: event.event === 'pull_request' ? 'var(--accent)' : 'var(--success)'
                        }}>
                        {event.event === 'pull_request' ? <GitPullRequest size={12} /> : <GitCommit size={12} />}
                      </div>
                      <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                        {event.event.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {event.repo}
                    </div>
                    {event.branch && (
                      <span className="inline-block px-1.5 py-0.5 mt-1 rounded text-[10px] font-mono border"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                        {event.branch}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {event.sender}
                    </span>
                  </td>
                  <td className="px-5 py-4 overflow-visible">
                    <div className="group relative inline-block">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border cursor-help ${getOutcomeBadgeClass(event.outcome)}`}>
                        {event.outcome}
                      </span>
                      
                      {/* Tooltip speech bubble */}
                      <div className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible absolute z-50 left-full top-1/2 transform -translate-y-1/2 ml-2 p-3 text-[11px] text-white bg-slate-900 rounded-xl shadow-xl w-64 transition-all duration-200 leading-relaxed">
                        <div className="font-bold border-b border-slate-700 pb-1 mb-1.5 flex items-center gap-1.5 text-xs text-indigo-300">
                          {event.outcome === 'ACCEPTED' ? <CheckCircle size={12} className="text-emerald-400" />
                            : event.outcome === 'REJECTED' ? <XCircle size={12} className="text-rose-400" />
                            : <AlertTriangle size={12} className="text-amber-400" />}
                          <span>{event.outcome} 상세 사유</span>
                        </div>
                        <p className="text-slate-300 text-[10px]">
                          {event.outcome === 'ACCEPTED' && (event.auditId ? `서명이 성공적으로 검증되었으며 감사 작업이 정상 등록되었습니다. (Audit ID: ${event.auditId.substring(0, 8)}...)` : '이벤트가 수락되었으며 감사 프로세스를 대기 중입니다.')}
                          {event.outcome === 'FILTERED' && `필터 제외: ${event.rejectReason || '브랜치 모니터링 제외 대상'}`}
                          {event.outcome === 'REJECTED' && `거절 사유: ${event.rejectReason || '유효하지 않은 보안 서명'}`}
                        </p>
                        {/* Triangle arrow pointing left */}
                        <div className="absolute right-full top-1/2 transform -translate-y-1/2 -mr-1 w-2 h-2 rotate-45 bg-slate-900"></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(event.receivedAt).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {event.auditId && (
                      <Link
                        to={`/audits/${event.auditId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-all"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(99,102,241,0.1)';
                          e.currentTarget.style.borderColor = 'var(--border-accent)';
                          e.currentTarget.style.color = 'var(--accent-bright)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-surface)';
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                      >
                        Audit <ArrowRight size={10} />
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-25"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
            const pageNum = i + 1;
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
