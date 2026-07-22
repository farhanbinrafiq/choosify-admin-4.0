import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, ExternalLink, Plus, RefreshCw, Search, X } from 'lucide-react';
import {
  operationsApi,
  type OpsJobApplication,
  type OpsJobEmploymentType,
  type OpsJobPosting,
  type OpsJobStatus,
} from '../../services/operationsApi';

const EMPLOYMENT_OPTIONS: OpsJobEmploymentType[] = ['full_time', 'part_time', 'internship', 'contract'];
const JOB_STATUS_OPTIONS: OpsJobStatus[] = ['open', 'closed', 'draft'];
const APP_STATUS_OPTIONS: OpsJobApplication['status'][] = [
  'new',
  'reviewed',
  'interviewing',
  'rejected',
  'hired',
];

const emptyForm = (): Omit<OpsJobPosting, 'id' | 'createdAt' | 'updatedAt' | 'postedAt'> => ({
  slug: '',
  title: '',
  department: '',
  location: '',
  employmentType: 'full_time',
  summary: '',
  description: '',
  responsibilities: '',
  requirements: '',
  status: 'open',
});

function employmentLabel(type: OpsJobEmploymentType) {
  return type.replace(/_/g, ' ');
}

export default function JobPostingsPage() {
  const [tab, setTab] = useState<'postings' | 'applications'>('postings');
  const [jobs, setJobs] = useState<OpsJobPosting[]>([]);
  const [applications, setApplications] = useState<OpsJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OpsJobPosting | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selectedApp, setSelectedApp] = useState<OpsJobApplication | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobRows, appRows] = await Promise.all([
        operationsApi.listJobs(),
        operationsApi.listJobApplications(),
      ]);
      setJobs(jobRows);
      setApplications(appRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load careers data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.department.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q),
    );
  }, [jobs, query]);

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter(
      (app) =>
        app.name.toLowerCase().includes(q) ||
        app.email.toLowerCase().includes(q) ||
        app.jobTitle.toLowerCase().includes(q),
    );
  }, [applications, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const openEdit = (job: OpsJobPosting) => {
    setEditing(job);
    setForm({
      slug: job.slug,
      title: job.title,
      department: job.department,
      location: job.location,
      employmentType: job.employmentType,
      summary: job.summary,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      status: job.status,
    });
  };

  const saveJob = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.department.trim() || !form.location.trim()) {
      setError('Title, department, and location are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const saved = await operationsApi.updateJob(editing.id, form);
        setJobs((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      } else {
        const saved = await operationsApi.createJob(form);
        setJobs((prev) => [saved, ...prev]);
      }
      setEditing(null);
      setForm(emptyForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save job posting');
    } finally {
      setSaving(false);
    }
  };

  const setJobStatus = async (job: OpsJobPosting, status: OpsJobStatus) => {
    try {
      const saved = await operationsApi.updateJob(job.id, { status });
      setJobs((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job status');
    }
  };

  const setAppStatus = async (app: OpsJobApplication, status: OpsJobApplication['status']) => {
    try {
      const saved = await operationsApi.updateJobApplication(app.id, { status });
      setApplications((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      setSelectedApp((prev) => (prev?.id === saved.id ? saved : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update application');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-app-accent" />
            Job Postings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage open roles and review Careers page applications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {tab === 'postings' && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-app-accent text-white font-semibold"
            >
              <Plus className="w-4 h-4" />
              New posting
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {(['postings', 'applications'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${
              tab === key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === 'postings' ? 'Search title, team, location...' : 'Search applicant or role...'}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {tab === 'postings' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Team</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{job.title}</div>
                      <div className="text-xs text-slate-500">
                        {job.location} · {employmentLabel(job.employmentType)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{job.department}</td>
                    <td className="px-4 py-3">
                      <select
                        value={job.status}
                        onChange={(event) => setJobStatus(job, event.target.value as OpsJobStatus)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs capitalize"
                      >
                        {JOB_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(job)}
                        className="text-app-accent font-semibold text-xs"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No job postings yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={saveJob} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">{editing ? 'Edit posting' : 'Create posting'}</h2>
              {editing && (
                <button type="button" onClick={openCreate} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {(
              [
                ['title', 'Title'],
                ['department', 'Department / team'],
                ['location', 'Location'],
                ['slug', 'Slug (optional)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {label}
                <input
                  value={form[key]}
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 normal-case font-normal"
                />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Employment type
                <select
                  value={form.employmentType}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      employmentType: event.target.value as OpsJobEmploymentType,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 normal-case font-normal capitalize"
                >
                  {EMPLOYMENT_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {employmentLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value as OpsJobStatus }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 normal-case font-normal capitalize"
                >
                  {JOB_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {(
              [
                ['summary', 'Summary'],
                ['description', 'Description'],
                ['responsibilities', 'Responsibilities'],
                ['requirements', 'Requirements'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {label}
                <textarea
                  value={form[key]}
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  rows={key === 'summary' ? 2 : 4}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 normal-case font-normal"
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-app-accent text-white font-bold py-2.5 disabled:opacity-60"
            >
              {saving ? 'Saving…' : editing ? 'Update posting' : 'Create posting'}
            </button>
          </form>
        </div>
      )}

      {tab === 'applications' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Applicant</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app) => (
                  <tr
                    key={app.id}
                    className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                    onClick={() => setSelectedApp(app)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{app.name}</div>
                      <div className="text-xs text-slate-500">{app.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{app.jobTitle}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(app.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 capitalize text-xs font-semibold">{app.status}</td>
                  </tr>
                ))}
                {!loading && filteredApps.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No applications yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 min-h-[280px]">
            {!selectedApp ? (
              <p className="text-sm text-slate-500">Select an application to view details.</p>
            ) : (
              <>
                <h2 className="font-bold text-slate-900 text-lg">{selectedApp.name}</h2>
                <p className="text-sm text-slate-600">
                  {selectedApp.email}
                  {selectedApp.phone ? ` · ${selectedApp.phone}` : ''}
                </p>
                <p className="text-sm text-slate-700">
                  Applied for <span className="font-semibold">{selectedApp.jobTitle}</span>
                </p>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                  <select
                    value={selectedApp.status}
                    onChange={(event) =>
                      setAppStatus(selectedApp, event.target.value as OpsJobApplication['status'])
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 normal-case font-normal capitalize"
                  >
                    {APP_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <a
                  href={selectedApp.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-app-accent"
                >
                  <ExternalLink className="w-4 h-4" />
                  Download resume{selectedApp.resumeFileName ? ` (${selectedApp.resumeFileName})` : ''}
                </a>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Cover letter
                  </h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-100 p-3 min-h-[120px]">
                    {selectedApp.coverLetter || '—'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
