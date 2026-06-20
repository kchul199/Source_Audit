import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects, getErrorMessage } from '../api/client';
import {
  FolderCode, ArrowRight, ExternalLink, AlertTriangle,
  GitPullRequest, Shield, TrendingUp, Boxes,
} from 'lucide-react';
import type { Project } from '../types';

/* ── Skeleton Card ── */
const SkeletonCard: React.FC = () => (
  <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
    <div className="flex justify-between mb-6">
      <div className="skeleton w-12 h-12 rounded-xl" />
      <div className="skeleton w-6 h-6 rounded-lg" />
    </div>
    <div className="skeleton h-5 w-32 mb-2" />
    <div className="skeleton h-3 w-48 mb-6" />
    <div className="skeleton h-10 w-full rounded-xl" />
  </div>
);

/* ── Stat Card ── */
const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  delay: number;
}> = ({ label, value, icon: Icon, gradient, delay }) => (
  <div
    className="rounded-2xl p-6 relative overflow-hidden animate-fade-in-up"
    style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      animationDelay: `${delay}ms`,
    }}
  >
    {/* Background gradient orb */}
    <div
      className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 blur-2xl"
      style={{ background: gradient }}
    />
    <div className="relative z-10">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: gradient, opacity: 0.15 }}
      >
        <Icon size={20} style={{ color: gradient.includes('99,102,241') ? 'var(--accent)' : gradient.includes('52,211,153') ? 'var(--success)' : 'var(--info)' }} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1"
        style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  </div>
);

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch((err: unknown) => setError(getErrorMessage(err, 'Failed to fetch projects')))
      .finally(() => setLoading(false));
  }, []);

  if (error) return (
    <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(248,113,113,0.1)' }}>
        <AlertTriangle size={28} style={{ color: 'var(--danger)' }} />
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Failed to load projects</h3>
      <p className="text-sm mb-8" style={{ color: 'var(--text-tertiary)' }}>{error}</p>
      <button
        onClick={() => {
          setError(null);
          setLoading(true);
          fetchProjects()
            .then(setProjects)
            .catch((err: unknown) => setError(getErrorMessage(err, 'Failed to fetch projects')))
            .finally(() => setLoading(false));
        }}
        className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div>
      {/* Page Header */}
      <div className="mb-10 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Dashboard
          </h1>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(52,211,153,0.1)', color: 'var(--success)' }}>
            <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--success)' }} />
            Live
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Monitor your repositories and automated code audits in real time.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12 stagger-children">
        <StatCard
          label="Projects"
          value={loading ? '—' : projects.length}
          icon={Boxes}
          gradient="rgba(99,102,241,0.8)"
          delay={0}
        />
        <StatCard
          label="Total Audits"
          value={loading ? '—' : projects.reduce((sum, p) => sum + (p._count?.audits || 0), 0)}
          icon={Shield}
          gradient="rgba(52,211,153,0.8)"
          delay={80}
        />
        <StatCard
          label="System"
          value="Healthy"
          icon={TrendingUp}
          gradient="rgba(96,165,250,0.8)"
          delay={160}
        />
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Repositories
        </h2>
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {projects.length} registered
        </span>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div
          className="rounded-3xl py-24 text-center animate-fade-in"
          style={{ background: 'var(--bg-card)', border: '2px dashed var(--border-medium)' }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'var(--bg-surface)' }}>
            <FolderCode size={28} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            No projects yet
          </h3>
          <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-tertiary)' }}>
            Send a GitHub webhook event to automatically register your first project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl p-6 transition-all group hover-glow"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex justify-between items-start mb-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    color: 'var(--accent)',
                  }}
                >
                  <FolderCode size={22} />
                </div>
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg transition-all"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.background = 'var(--bg-surface)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <ExternalLink size={16} />
                </a>
              </div>

              <h3 className="text-base font-bold mb-1 transition-colors"
                style={{ color: 'var(--text-primary)' }}>
                {project.name}
              </h3>
              <p className="text-xs font-mono mb-4 truncate" style={{ color: 'var(--text-muted)' }}>
                {project.repoUrl}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-4 mb-5">
                {project._count && (
                  <div className="flex items-center gap-1.5">
                    <GitPullRequest size={13} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {project._count.audits} audit{project._count.audits !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              <Link
                to={`/audits?projectId=${project.id}`}
                className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--accent)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.15)';
                  e.currentTarget.style.borderColor = 'var(--border-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <span>View Audits</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
