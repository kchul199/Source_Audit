import React, { useEffect, useState } from 'react';
import {
  Settings, Plus, Edit, Trash2, FileJson, RefreshCw,
  Download, GitPullRequest, GitCommit, Check,
  AlertTriangle, X, Shield, Globe, ExternalLink, ShieldCheck,
} from 'lucide-react';
import {
  fetchProjects, createProject, updateProject, deleteProject,
  fetchConfigFile, syncConfigFromConfigFile, exportConfigToConfigFile
} from '../api/client';
import type { Project } from '../types';

export const SettingsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [configFile, setConfigFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'repos' | 'json'>('repos');

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formRepoUrl, setFormRepoUrl] = useState('');
  const [formGithubToken, setFormGithubToken] = useState('');
  const [formWebhookSecret, setFormWebhookSecret] = useState('');
  const [formAllowPRs, setFormAllowPRs] = useState(true);
  const [formAllowPush, setFormAllowPush] = useState(true);
  const [formAdminUsers, setFormAdminUsers] = useState('');
  const [formBranchFilter, setFormBranchFilter] = useState('*');
  const [formActive, setFormActive] = useState(true);
  const [formCustomPromptRules, setFormCustomPromptRules] = useState('');
  const [formLlmModel, setFormLlmModel] = useState('gpt-4o');
  const [formEnablePRComments, setFormEnablePRComments] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const projData = await fetchProjects();
      setProjects(projData);

      const configData = await fetchConfigFile();
      setConfigFile(configData);
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingProject(null);
    setFormName('');
    setFormRepoUrl('');
    setFormGithubToken('');
    setFormWebhookSecret('');
    setFormAllowPRs(true);
    setFormAllowPush(true);
    setFormAdminUsers('');
    setFormBranchFilter('*');
    setFormActive(true);
    setFormCustomPromptRules('');
    setFormLlmModel('gpt-4o');
    setFormEnablePRComments(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (proj: Project) => {
    setEditingProject(proj);
    setFormName(proj.name);
    setFormRepoUrl(proj.repoUrl);
    setFormGithubToken(proj.githubToken || '');
    setFormWebhookSecret(proj.webhookSecret || '');
    setFormAllowPRs(proj.allowPRs ?? true);
    setFormAllowPush(proj.allowPush ?? true);
    setFormAdminUsers(proj.adminUsers || '');
    setFormBranchFilter(proj.branchFilter || '*');
    setFormActive(proj.active ?? true);
    setFormCustomPromptRules(proj.customPromptRules || '');
    setFormLlmModel(proj.llmModel || 'gpt-4o');
    setFormEnablePRComments(proj.enablePRComments ?? false);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this repository configuration? This will also delete all associated audit records.')) {
      return;
    }
    setLoading(true);
    try {
      await deleteProject(id);
      showSuccess('Repository configuration deleted successfully');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete repository');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRepoUrl.trim()) {
      alert('Repository Name and Repository URL are required');
      return;
    }

    setLoading(true);
    setIsModalOpen(false);

    const payload = {
      name: formName.trim(),
      repoUrl: formRepoUrl.trim(),
      githubToken: formGithubToken.trim() || null,
      webhookSecret: formWebhookSecret.trim() || null,
      allowPRs: formAllowPRs,
      allowPush: formAllowPush,
      adminUsers: formAdminUsers.trim(),
      branchFilter: formBranchFilter.trim() || '*',
      active: formActive,
      customPromptRules: formCustomPromptRules.trim() || null,
      llmModel: formLlmModel,
      enablePRComments: formEnablePRComments,
    };

    try {
      if (editingProject) {
        await updateProject(editingProject.id, payload);
        showSuccess('Repository configuration updated successfully');
      } else {
        await createProject(payload);
        showSuccess('New repository configuration created successfully');
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save repository configuration');
      setLoading(false);
    }
  };

  const handleSyncFromFile = async () => {
    setLoading(true);
    try {
      await syncConfigFromConfigFile();
      showSuccess('Database settings synchronized with local file');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to sync from config file');
      setLoading(false);
    }
  };

  const handleExportToFile = async () => {
    setLoading(true);
    try {
      await exportConfigToConfigFile();
      showSuccess('Database settings exported to configuration file');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to export to config file');
      setLoading(false);
    }
  };

  const handleDownloadJson = () => {
    if (!configFile) return;
    const blob = new Blob([JSON.stringify(configFile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'src-audit.config.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-20 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Settings className={`text-indigo-500 ${loading ? 'animate-spin' : ''}`} />
            System Settings
          </h1>
          <p className="text-sm text-slate-500">
            Manage registered repositories, credentials, webhook secrets, and execution permissions.
          </p>
        </div>

        {/* Global Success / Error Toast */}
        {success && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs font-bold animate-fade-in">
            <Check size={14} />
            {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-bold animate-fade-in">
            <AlertTriangle size={14} />
            {error}
            <button onClick={() => setError(null)} className="ml-1 text-rose-400 hover:text-rose-600">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b pb-1" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          onClick={() => setActiveTab('repos')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'repos'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Repositories ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'json'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <FileJson size={14} />
            JSON Config File
          </span>
        </button>
      </div>

      {/* ── Repositories Settings Tab ── */}
      {activeTab === 'repos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Target Repositories</h3>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-indigo-600/10 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Plus size={14} />
              Add Repository
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-16 text-center text-slate-400 space-y-4" style={{ borderColor: 'var(--border-medium)' }}>
              <Globe size={40} className="mx-auto text-slate-300 animate-pulse" />
              <div>
                <p className="text-sm font-bold">No repositories registered yet</p>
                <p className="text-xs text-slate-400 mt-1">Add your first repository or sync from a configuration file.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className={`rounded-2xl p-6 glass relative flex flex-col justify-between hover-glow ${
                    !proj.active ? 'opacity-60 bg-slate-50/50' : ''
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                          <Shield size={16} />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold truncate max-w-[200px]" style={{ color: 'var(--text-primary)' }}>
                            {proj.name}
                          </h4>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            proj.active
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-500/20'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}>
                            {proj.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEdit(proj)}
                          className="p-2 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors border"
                          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(proj.id)}
                          className="p-2 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors border"
                          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* URL */}
                    <div className="text-xs font-mono mb-6 truncate flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      {proj.repoUrl}
                      <a href={proj.repoUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-500 ml-1">
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    {/* Permissions grid */}
                    <div className="grid grid-cols-2 gap-3 py-3 border-t border-b text-[11px] font-semibold" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center gap-1.5" style={{ color: proj.allowPRs ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        <GitPullRequest size={12} className={proj.allowPRs ? 'text-indigo-500' : 'text-slate-300'} />
                        PR Audits: <span className={proj.allowPRs ? 'text-emerald-500' : 'text-slate-400'}>{proj.allowPRs ? 'ON' : 'OFF'}</span>
                      </div>
                      <div className="flex items-center gap-1.5" style={{ color: proj.allowPush ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        <GitCommit size={12} className={proj.allowPush ? 'text-indigo-500' : 'text-slate-300'} />
                        Push Audits: <span className={proj.allowPush ? 'text-emerald-500' : 'text-slate-400'}>{proj.allowPush ? 'ON' : 'OFF'}</span>
                      </div>
                    </div>

                    {/* Filters & Token Info */}
                    <div className="space-y-2 mt-4 text-[11px]">
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-tertiary)' }}>Branch Filter:</span>
                        <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{proj.branchFilter || '*'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-tertiary)' }}>LLM Model:</span>
                        <span className="font-mono font-bold text-indigo-600">{proj.llmModel || 'gpt-4o'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-tertiary)' }}>PR Comments:</span>
                        <span className="font-mono font-bold" style={{ color: proj.enablePRComments ? 'var(--success)' : 'var(--text-muted)' }}>
                          {proj.enablePRComments ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-tertiary)' }}>GitHub Key:</span>
                        <span className="font-mono font-bold text-slate-500 flex items-center gap-1">
                          {proj.githubToken ? (
                            <>
                              <ShieldCheck size={12} className="text-emerald-500" />
                              Registered
                            </>
                          ) : (
                            <span className="text-rose-400">Not Configured</span>
                          )}
                        </span>
                      </div>
                      {proj.adminUsers && (
                        <div className="flex flex-col gap-1 pt-1">
                          <span style={{ color: 'var(--text-tertiary)' }}>Allowed Triggering Users:</span>
                          <span className="font-mono px-2 py-1 rounded bg-slate-100 text-slate-700 max-w-full overflow-hidden truncate">
                            {proj.adminUsers}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── JSON Config File Tab ── */}
      {activeTab === 'json' && (
        <div className="rounded-2xl p-6 glass space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>src-audit.config.json</h3>
              <p className="text-xs text-slate-400 mt-1">This configuration file at the monorepo root synchronizes with your workspace environment.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSyncFromFile}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
              >
                <RefreshCw size={12} />
                Sync to Database
              </button>
              <button
                onClick={handleExportToFile}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
              >
                <Download size={12} />
                Export DB to File
              </button>
              <button
                onClick={handleDownloadJson}
                disabled={!configFile}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <Download size={12} />
                Download JSON
              </button>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="bg-slate-800 text-slate-400 px-4 py-2 text-xs font-bold flex items-center justify-between">
              <span>src-audit.config.json</span>
              <span className="text-[10px] uppercase font-mono tracking-wider">ReadOnly Viewer</span>
            </div>
            <pre className="p-4 bg-slate-900 overflow-x-auto text-[13px] leading-relaxed" style={{ fontFamily: 'var(--font-mono)' }}>
              <code className="text-emerald-400">
                {configFile ? JSON.stringify(configFile, null, 2) : '// No configuration loaded.'}
              </code>
            </pre>
          </div>
        </div>
      )}

      {/* ── Add / Edit Config Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up border" style={{ borderColor: 'var(--border-medium)' }}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Settings size={18} className="text-indigo-500" />
                {editingProject ? 'Edit Repository Configuration' : 'Add New Repository'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Repository Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. test-repo"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-indigo-500 text-slate-800"
                    style={{ borderColor: 'var(--border-medium)' }}
                  />
                </div>

                {/* Repo URL */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Repository GitHub URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/owner/repo"
                    value={formRepoUrl}
                    onChange={(e) => setFormRepoUrl(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-indigo-500 text-slate-800"
                    style={{ borderColor: 'var(--border-medium)' }}
                  />
                </div>

                {/* GitHub Token / Key */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">GitHub Access Key (Token)</label>
                    {editingProject && editingProject.githubToken && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-500/10 px-1.5 py-0.5 rounded">Token Configured</span>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder={editingProject ? 'Leave blank to keep current token...' : 'ghp_xxxxxxxxxxxx'}
                    value={formGithubToken}
                    onChange={(e) => setFormGithubToken(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-indigo-500 text-slate-800 font-mono"
                    style={{ borderColor: 'var(--border-medium)' }}
                  />
                  <p className="text-[10px] text-slate-400">Required to checkout private repos and post PR audit reviews.</p>
                </div>

                {/* Webhook Secret */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Webhook Signature Secret</label>
                  <input
                    type="text"
                    placeholder="Signature verification token"
                    value={formWebhookSecret}
                    onChange={(e) => setFormWebhookSecret(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-indigo-500 text-slate-800 font-mono"
                    style={{ borderColor: 'var(--border-medium)' }}
                  />
                  <p className="text-[10px] text-slate-400">Used to securely verify incoming GitHub webhooks.</p>
                </div>

                {/* AI Configuration Section */}
                <div className="p-4 rounded-xl border space-y-4 bg-indigo-50/20" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
                  <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={14} /> 3. AI Configuration
                  </h4>
                  
                  {/* LLM Model */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">LLM Model</label>
                    <select
                      value={formLlmModel}
                      onChange={(e) => setFormLlmModel(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-indigo-500 text-slate-800 bg-white"
                      style={{ borderColor: 'var(--border-medium)' }}
                    >
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="o1-pro">o1-pro</option>
                    </select>
                  </div>

                  {/* Custom Prompt Rules */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Custom Prompt Rules</label>
                    <textarea
                      placeholder="Enter team-specific coding conventions and analysis rules..."
                      value={formCustomPromptRules}
                      onChange={(e) => setFormCustomPromptRules(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-indigo-500 text-slate-800"
                      style={{ borderColor: 'var(--border-medium)' }}
                    />
                  </div>

                  {/* Enable PR Comments */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Enable PR Review Comments</span>
                      <span className="text-[9px] text-slate-400">Automatically post review comments on GitHub Pull Requests.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formEnablePRComments}
                      onChange={(e) => setFormEnablePRComments(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Branch Filter & Trigger Users */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Branch Filter</label>
                    <input
                      type="text"
                      placeholder="e.g. main,develop"
                      value={formBranchFilter}
                      onChange={(e) => setFormBranchFilter(e.target.value)}
                      className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-indigo-500 text-slate-800 font-mono"
                      style={{ borderColor: 'var(--border-medium)' }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Allowed Trigger Users</label>
                    <input
                      type="text"
                      placeholder="e.g. kchul199,user2"
                      value={formAdminUsers}
                      onChange={(e) => setFormAdminUsers(e.target.value)}
                      className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-indigo-500 text-slate-800 font-mono"
                      style={{ borderColor: 'var(--border-medium)' }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-[-8px]">Use commas to list multiple. Set to * or leave empty to allow all.</p>

                {/* Toggles */}
                <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Allow Pull Request Audits</span>
                      <span className="text-[10px] text-slate-400">Run code audit on pull request events.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formAllowPRs}
                      onChange={(e) => setFormAllowPRs(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Allow Push Audits</span>
                      <span className="text-[10px] text-slate-400">Run code audit on direct branch pushes.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formAllowPush}
                      onChange={(e) => setFormAllowPush(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Enable Repository Integration</span>
                      <span className="text-[10px] text-slate-400">Uncheck to temporarily ignore all incoming webhooks for this project.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                  style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
