import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { operationsApi } from '../../services/operationsApi';
import {
  ShieldCheck,
  Clock,
  FileCheck,
  FileText,
  Building2,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  FileSignature,
  Compass,
  Database,
  Check,
  X,
  Eye,
  ExternalLink,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// Local types mirroring server/operations/types.ts OpsVerificationRequest —
// this component talks to the real /operations/verifications endpoints
// directly (see src/services/operationsApi.ts), not TrustContext.
// ============================================================================

type DocumentType =
  | 'Trade License'
  | 'Business Registration'
  | 'Tax Certificate'
  | 'Brand Ownership Proof'
  | 'Identity Verification';

type DocumentStatus = 'pending' | 'approved' | 'rejected';

interface VerificationDocument {
  id: string;
  type: DocumentType;
  name: string;
  doc_url: string;
  status: DocumentStatus;
  notes?: string;
}

interface VerificationReview {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  status: 'approved' | 'rejected';
  feedback: string;
  reviewed_at: string;
}

interface VerificationAuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

type VerificationStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';

interface VerificationRequest {
  id: string;
  entityType: 'brand' | 'creator';
  entityId: string;
  entityName: string;
  brand_id: string;
  brand_name: string;
  logo_url: string;
  submitted_by: string;
  submitted_by_name?: string;
  status: VerificationStatus;
  documents: VerificationDocument[];
  reviews: VerificationReview[];
  audit_trail: VerificationAuditEntry[];
  created_at: string;
  updated_at: string;
}

function normalizeRow(row: unknown): VerificationRequest {
  const r = row as Partial<VerificationRequest> & Record<string, unknown>;
  return {
    id: String(r.id || ''),
    entityType: r.entityType === 'creator' ? 'creator' : 'brand',
    entityId: String(r.entityId || r.brand_id || ''),
    entityName: String(r.entityName || r.brand_name || ''),
    brand_id: String(r.brand_id || r.entityId || ''),
    brand_name: String(r.brand_name || r.entityName || ''),
    logo_url: String(r.logo_url || ''),
    submitted_by: String(r.submitted_by || ''),
    submitted_by_name: r.submitted_by_name as string | undefined,
    status: (r.status as VerificationStatus) || 'Draft',
    documents: Array.isArray(r.documents) ? (r.documents as VerificationDocument[]) : [],
    reviews: Array.isArray(r.reviews) ? (r.reviews as VerificationReview[]) : [],
    audit_trail: Array.isArray(r.audit_trail) ? (r.audit_trail as VerificationAuditEntry[]) : [],
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  };
}

export default function BrandVerification() {
  const { profile, loading: authLoading } = useAuth();

  // ------------------------------------------------------------------------
  // List state — loaded from GET /operations/verifications
  // ------------------------------------------------------------------------
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const fetchVerifications = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const rows = await operationsApi.listVerifications();
      setVerificationRequests(rows.map(normalizeRow));
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load verification requests.');
    } finally {
      setListLoading(false);
    }
  }, []);

  // Wait for the auth session to resolve before fetching — an unconditional
  // fetch on mount races AuthContext's async bootstrap and produces a
  // spurious first-paint 401.
  useEffect(() => {
    if (authLoading || !profile) return;
    fetchVerifications();
  }, [authLoading, profile, fetchVerifications]);

  const applyUpdatedRow = (row: unknown) => {
    const updated = normalizeRow(row);
    setVerificationRequests((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx < 0) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    return updated;
  };

  // Selected Brand Request for Detail view
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');

  // Tab filters
  const [activeQueueTab, setActiveQueueTab] = useState<'All' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Draft'>('All');

  useEffect(() => {
    if (!selectedRequestId && verificationRequests[0]) {
      setSelectedRequestId(verificationRequests[0].id);
    }
  }, [verificationRequests, selectedRequestId]);

  // Document Review Popup Modal states
  const [showDocModal, setShowDocModal] = useState(false);
  const [activeDocForModal, setActiveDocForModal] = useState<VerificationDocument | null>(null);

  // Review final states
  const [reviewerFeedback, setReviewerFeedback] = useState('');
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectNotesInput, setRejectNotesInput] = useState('Doesn\'t match trade registration certificate requirements');

  // Per-action loading/error state — no optimistic updates, no silent failures.
  const [submitLoadingId, setSubmitLoadingId] = useState<string | null>(null);
  const [docActionLoadingId, setDocActionLoadingId] = useState<string | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = useState<'approved' | 'rejected' | 'request_info' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Simulate a corporate brand claim draft
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Request trace mapping
  const selectedRequest = useMemo(() => {
    return verificationRequests.find(r => r.id === selectedRequestId) || verificationRequests[0];
  }, [verificationRequests, selectedRequestId]);

  const filteredQueue = useMemo(() => {
    if (activeQueueTab === 'All') return verificationRequests;
    return verificationRequests.filter(r => r.status === activeQueueTab);
  }, [verificationRequests, activeQueueTab]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'Under Review':
        return 'bg-blue-500/10 text-blue-450 border-blue-500/25';
      case 'Submitted':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Rejected':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getDocStatusIcon = (status: string) => {
    switch(status) {
      case 'approved': return <Check className="w-3.5 h-3.5 text-green-400" />;
      case 'rejected': return <X className="w-3.5 h-3.5 text-red-400" />;
      default: return <Clock className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />;
    }
  };

  // Launch simulated brand registration draft — real POST /operations/verifications
  const triggerBrandCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    const fakeBrandId = 'brand_' + newBrandName.toLowerCase().replace(/\s+/g, '_');
    setCreateLoading(true);
    setCreateError(null);
    try {
      const saved = await operationsApi.createVerification({
        entityType: 'brand',
        entityId: fakeBrandId,
        entityName: newBrandName.trim(),
        brand_id: fakeBrandId,
        brand_name: newBrandName.trim(),
        logo_url: newBrandLogo,
        status: 'Draft',
        documents: [
          { id: `doc_u_${Date.now()}_1`, type: 'Trade License', name: 'Trade_License_Upload.pdf', doc_url: newBrandLogo || '#', status: 'pending' },
          { id: `doc_u_${Date.now()}_2`, type: 'Business Registration', name: 'Registration_Cert.pdf', doc_url: newBrandLogo || '#', status: 'pending' },
        ],
      });
      const created = applyUpdatedRow(saved);
      setSelectedRequestId(created.id);
      setNewBrandName('');
      setActiveQueueTab('Draft');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create draft verification.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleProcessSubmission = async (requestId: string) => {
    setSubmitLoadingId(requestId);
    setActionError(null);
    try {
      const saved = await operationsApi.submitVerification(requestId);
      applyUpdatedRow(saved);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit verification.');
    } finally {
      setSubmitLoadingId(null);
    }
  };

  const handleDocumentDecision = async (requestId: string, docId: string, status: 'approved' | 'rejected', notes?: string) => {
    setDocActionLoadingId(docId);
    setActionError(null);
    try {
      const saved = await operationsApi.updateVerificationDocument(requestId, docId, { status, notes });
      applyUpdatedRow(saved);
      if (status === 'rejected') setRejectingDocId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update document status.');
    } finally {
      setDocActionLoadingId(null);
    }
  };

  const handleFinalReview = async (requestId: string, status: 'approved' | 'rejected' | 'request_info') => {
    if (!reviewerFeedback.trim()) {
      setActionError(
        status === 'request_info'
          ? 'Describe what additional information is needed before requesting it.'
          : 'Please provide compliance feedback first.',
      );
      return;
    }
    setReviewActionLoading(status);
    setActionError(null);
    try {
      const result = await operationsApi.reviewVerification(requestId, {
        status,
        feedback: reviewerFeedback.trim(),
        reviewer_name: profile?.displayName,
      });
      applyUpdatedRow(result.data);
      setReviewerFeedback('');
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : status === 'request_info'
            ? 'Failed to request additional information.'
            : 'Failed to finalize review.',
      );
    } finally {
      setReviewActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 transition-all animate-in fade-in duration-300 text-app-text-primary">

      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <span>Corporate Governance</span>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">Corporate Verification Pipeline</span>
          </div>
          <h1 className="text-xl font-bold text-app-text-primary tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" /> Enterprise Brand Verification System
          </h1>
          <p className="text-app-text-secondary text-[12px]">
            Formal compliance audit node enabling multi-tiered corporate document verifications, identity validation, and secure auditing tracks.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-app-card border border-app-border rounded-[4px] p-2 text-[10px] font-bold uppercase tracking-widest text-[#8E9BAE] font-mono select-none">
          {listLoading ? (
            <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading queue…</span>
          ) : (
            <span>Verification Queue: {verificationRequests.length} requests (brands + creators)</span>
          )}
          <button
            onClick={() => fetchVerifications()}
            disabled={listLoading}
            className="p-1 hover:bg-white/10 rounded-[2px] disabled:opacity-40 cursor-pointer"
            title="Refresh queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${listLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {listError && (
        <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-[4px] flex items-center justify-between gap-3 text-xs text-red-300">
          <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {listError}</span>
          <button
            onClick={() => fetchVerifications()}
            className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-[2px] font-bold uppercase tracking-wider text-[10px] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-[4px] flex items-center justify-between gap-3 text-xs text-red-300">
          <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="p-1 hover:bg-white/10 rounded-[2px] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: BRAND VERIFICATION QUEUE & REGISTRATION SIMULATOR (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">

          {/* QUEUE CARD */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
            <div className="border-b border-app-border pb-2 flex justify-between items-center">
              <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Verification Queue</h3>
              <Compass className="w-4 h-4 text-app-text-secondary/60" />
            </div>

            {/* Queue Filter states tabs */}
            <div className="flex flex-wrap gap-1.5">
              {(['All', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Draft'] as const).map(tab => {
                const count = tab === 'All'
                  ? verificationRequests.length
                  : verificationRequests.filter(r => r.status === tab).length;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveQueueTab(tab)}
                    className={`px-2 py-1 text-[9px] font-extrabold uppercase rounded-[2px] border cursor-pointer${
                      activeQueueTab === tab
                        ? 'bg-app-accent border-app-accent text-white'
                        : 'bg-white/5 border-transparent text-app-text-secondary hover:text-white'
                    }`}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>

            {/* List queue rows */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-2">
              {listLoading ? (
                <div className="text-center py-12 text-app-text-secondary">
                  <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-xs">Loading verification queue…</p>
                </div>
              ) : filteredQueue.length > 0 ? (
                filteredQueue.map(req => (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequestId(req.id)}
                    className={`p-3 bg-white/[0.01] border rounded-[4px] cursor-pointer transition-all flex gap-3 text-left relative${
                      selectedRequestId === req.id
                        ? 'border-app-accent bg-white/[0.03]'
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                    }`}
                  >
                    <img
                      src={req.logo_url}
                      alt={req.brand_name}
                      className="w-10 h-10 rounded-full border border-app-border object-cover bg-white"
                      referrerPolicy="no-referrer"
                    />

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-app-text-primary text-xs truncate">{req.brand_name || req.entityName}</h4>
                        <span className={`px-1.5 py-0.5 rounded-[2px] text-[8px] tracking-wider uppercase border${getStatusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </div>

                      <p className="text-[10px] text-app-text-secondary truncate">
                        {(req.entityType || 'brand').toUpperCase()} · By {req.submitted_by_name || req.submitted_by}
                      </p>

                      <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                        <span>Documents: {req.documents.length}</span>
                        <span>{req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-app-text-secondary border border-dashed border-app-border rounded-[4px]">
                  <FileText className="w-8 h-8 opacity-25 mx-auto mb-2" />
                  <p className="text-xs font-bold text-app-text-primary">Queue completely clear</p>
                  <p className="text-[10px]">No brand requests match the filter criteria.</p>
                </div>
              )}
            </div>
          </div>

          {/* SIMULATE CORPORATE APPLICATION INITIATION */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
            <div className="border-b border-app-border pb-2">
              <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-emerald-400" /> Initiate Brand Prospect Profile
              </h3>
              <p className="text-[10px] text-app-text-secondary">Simulate a local corporate brand submitting compliance credentials.</p>
            </div>

            <form onSubmit={triggerBrandCreation} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Brand Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Walton Mobile BD..."
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="w-full bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-app-text-primary focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Public Logo URL Asset</label>
                <input
                  type="text"
                  value={newBrandLogo}
                  onChange={(e) => setNewBrandLogo(e.target.value)}
                  className="w-full bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-app-text-primary font-mono focus:outline-none"
                />
              </div>

              {createError && (
                <p className="text-[10px] text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {createError}</p>
              )}

              <button
                type="submit"
                disabled={createLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-550 text-white font-bold py-2 rounded-[3px] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {createLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {createLoading ? 'Assembling…' : 'Assemble Compliance Draft dossier'}
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: REVIEWS DETAIL PANEL & VERIFICATION WORKFLOWS (7 COLS) */}
        <div className="lg:col-span-7 bg-app-card border border-app-border rounded-[4px] p-6 shadow-2xl space-y-6">

          {selectedRequest ? (
            <div className="space-y-6">

              {/* BRAND META HEADER */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-app-border pb-4">
                <div className="flex gap-4">
                  <img
                    src={selectedRequest.logo_url}
                    alt={selectedRequest.brand_name}
                    className="w-14 h-14 rounded-[4px] border border-app-border object-cover bg-white"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h2 className="text-base font-black text-app-text-primary">{selectedRequest.brand_name}</h2>
                    <p className="text-[11px] text-app-text-secondary font-mono">System Request Register: {selectedRequest.id}</p>
                    <p className="text-[11px] text-slate-500">Submitted by: <strong className="text-app-text-primary">{selectedRequest.submitted_by_name || selectedRequest.submitted_by}</strong></p>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2 items-end self-end sm:self-auto">
                  <span className={`px-2.5 py-0.5 rounded-[2px] text-xs font-bold uppercase tracking-widest border${getStatusBadge(selectedRequest.status)}`}>
                    {selectedRequest.status}
                  </span>

                  {selectedRequest.status === 'Draft' && (
                    <button
                      onClick={() => handleProcessSubmission(selectedRequest.id)}
                      disabled={submitLoadingId === selectedRequest.id}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-550 text-app-text-primary font-bold text-[9px] uppercase tracking-wider rounded-[2px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {submitLoadingId === selectedRequest.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {submitLoadingId === selectedRequest.id ? 'Submitting…' : 'Process Submission'}
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION 1: VERIFICATION DOCUMENTS REVIEW PANEL */}
              <div className="space-y-3.5">
                <h3 className="text-[11px] font-bold text-[#8E9BAE] uppercase tracking-widest flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-app-accent-light" /> Compliance Certificates Audit ({selectedRequest.documents.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  {selectedRequest.documents.map(doc => {
                    const docBusy = docActionLoadingId === doc.id;
                    return (
                    <div
                      key={doc.id}
                      className={`p-3 bg-white/[0.01] rounded-[4px] border shadow-md flex flex-col justify-between space-y-3${
                        doc.status === 'approved' ? 'border-green-500/20 bg-green-500/[0.01]' :
                        doc.status === 'rejected' ? 'border-red-500/20 bg-red-500/[0.01]' : 'border-white/[0.04]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-extrabold text-app-text-primary text-[11px] uppercase tracking-wide truncate">{doc.type}</span>
                          <span className="flex items-center gap-1">
                            {docBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-app-text-secondary" /> : getDocStatusIcon(doc.status)}
                          </span>
                        </div>
                        <p className="text-[10px] text-app-text-secondary font-sans truncate">{doc.name}</p>
                      </div>

                      {doc.notes && (
                        <div className="p-2 bg-app-bg/10 rounded-[2px] text-[10px] text-[#8E9BAE] leading-relaxed border border-app-border">
                          <strong>Audit details:</strong> {doc.notes}
                        </div>
                      )}

                      {/* Interactive doc status buttons */}
                      <div className="flex flex-col gap-1.5 pt-1 border-t border-app-border">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setActiveDocForModal(doc);
                              setShowDocModal(true);
                            }}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-app-text-secondary text-[10px] py-1 rounded-[2px] cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Audit Details
                          </button>

                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                handleDocumentDecision(selectedRequest.id, doc.id, 'approved', 'Document verified successfully by Lead Auditor.');
                                if (rejectingDocId === doc.id) setRejectingDocId(null);
                              }}
                              disabled={docBusy}
                              className="p-1 px-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-[2px] border border-green-500/15 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Quick Approve Document"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setRejectingDocId(prev => prev === doc.id ? null : doc.id);
                              }}
                              disabled={docBusy}
                              className="p-1 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-[2px] border border-red-500/15 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Flag Document"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {rejectingDocId === doc.id && (
                          <div className="p-2 bg-red-950/40 border border-red-500/30 rounded mt-1 flex flex-col gap-1.5 animate-fade-in text-[10px]">
                            <span className="font-bold text-red-400">Rejection Reason:</span>
                            <textarea
                              value={rejectNotesInput}
                              onChange={e => setRejectNotesInput(e.target.value)}
                              rows={2}
                              className="w-full bg-app-card/20 border border-app-border rounded p-1 text-[10px] outline-none focus:border-red-500 text-app-text-secondary"
                              placeholder="Notes for the merchant..."
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => handleDocumentDecision(selectedRequest.id, doc.id, 'rejected', rejectNotesInput)}
                                disabled={docBusy}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[9px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >{docBusy ? 'Rejecting…' : 'Reject'}</button>
                              <button
                                onClick={() => setRejectingDocId(null)}
                                disabled={docBusy}
                                className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-slate-350 rounded text-[9px] font-bold cursor-pointer disabled:opacity-40"
                              >Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* QUICK APPROVE ACTIONS BLOCK & COMPLIANCE FEEDBACK */}
              <div className="p-4 bg-white/[0.01] border border-app-border rounded-[4px] space-y-4">
                <h3 className="text-[11px] font-bold text-[#8E9BAE] uppercase tracking-widest flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4 text-emerald-400" /> Admin Compliance Determination
                </h3>

                <div className="space-y-2 text-xs">
                  <label className="text-[9px] text-[#8E9BAE] uppercase font-mono tracking-wider font-extrabold">Final Review Statement</label>
                  <textarea
                    rows={2}
                    value={reviewerFeedback}
                    onChange={(e) => setReviewerFeedback(e.target.value)}
                    placeholder="Enter official auditable compliance review ledger comment..."
                    className="w-full bg-white/[0.01] border border-app-border rounded-[3px] p-2 bg-app-card text-app-text-primary focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleFinalReview(selectedRequest.id, 'approved')}
                    disabled={reviewActionLoading !== null}
                    className="flex-1 min-w-[140px] bg-green-650 hover:bg-green-600 text-app-text-primary font-extrabold uppercase text-[10px] tracking-wider py-2.5 rounded-[3px] cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reviewActionLoading === 'approved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                    Approve Enterprise Brand
                  </button>

                  <button
                    onClick={() => handleFinalReview(selectedRequest.id, 'request_info')}
                    disabled={reviewActionLoading !== null}
                    className="flex-1 min-w-[140px] bg-amber-600 hover:bg-amber-550 text-app-text-primary font-extrabold uppercase text-[10px] tracking-wider py-2.5 rounded-[3px] cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reviewActionLoading === 'request_info' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Info className="w-3.5 h-3.5" />}
                    Request More Info
                  </button>

                  <button
                    onClick={() => handleFinalReview(selectedRequest.id, 'rejected')}
                    disabled={reviewActionLoading !== null}
                    className="flex-1 min-w-[140px] bg-red-650 hover:bg-red-600 text-white font-extrabold uppercase text-[10px] tracking-wider py-2.5 rounded-[3px] cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reviewActionLoading === 'rejected' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                    Flag and Deny Application
                  </button>
                </div>
              </div>

              {/* PRIOR REVIEWS (real audit-trail-backed decisions) */}
              {selectedRequest.reviews.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold text-[#8E9BAE] uppercase tracking-widest">Review Decisions</h3>
                  <div className="space-y-2">
                    {selectedRequest.reviews.map(rv => (
                      <div key={rv.id} className={`p-2.5 rounded-[3px] border text-[11px] ${rv.status === 'approved' ? 'border-green-500/20 bg-green-500/[0.03]' : 'border-red-500/20 bg-red-500/[0.03]'}`}>
                        <div className="flex justify-between gap-2">
                          <span className="font-bold text-app-text-primary uppercase text-[10px]">{rv.status} · {rv.reviewer_name}</span>
                          <span className="text-slate-500 text-[9px]">{new Date(rv.reviewed_at).toLocaleString()}</span>
                        </div>
                        <p className="text-app-text-secondary mt-1">{rv.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VERIFICATION AUDIT TRAIL TIMELINE (PHASE 3 REQUIRED) */}
              <div className="space-y-3.5 pt-2">
                <h3 className="text-[11px] font-bold text-[#8E9BAE] uppercase tracking-widest flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-app-accent" /> Verification Audit Trail & Timeline
                </h3>

                <div className="relative border-l border-app-border pl-4.5 ml-2.5 space-y-4">
                  {selectedRequest.audit_trail.map((trail, index) => (
                    <div key={index} className="relative text-xs font-mono">

                      {/* Circle on timeline */}
                      <div className="absolute -left-[24.5px] top-1 w-3 h-3 rounded-full bg-app-accent border border-app-card" />

                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-app-text-primary font-bold">{trail.action}</span>
                        <span className="text-[10px] text-slate-500">by {trail.actor}</span>
                      </div>

                      <p className="text-[#8E9BAE] text-[11px] leading-relaxed mb-0.5">{trail.details}</p>

                      <span className="text-[9px] text-slate-500 block">
                        {new Date(trail.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : listLoading ? (
            <div className="text-center py-20 text-app-text-secondary">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin opacity-30" />
              <p className="text-sm font-bold text-app-text-primary">Loading verification requests…</p>
            </div>
          ) : (
            <div className="text-center py-20 text-app-text-secondary border border-dashed border-app-border rounded-[4px]">
              <Building2 className="w-12 h-12 opacity-20 mx-auto mb-3" />
              <p className="text-sm font-bold text-app-text-primary">No active requests selected</p>
              <p className="text-xs">Choose folders or submissions from the queue list to audit.</p>
            </div>
          )}

        </div>

      </div>

      {/* DOCUMENT AUDIT VIEW POPUP MODAL */}
      {showDocModal && activeDocForModal && (
        <div className="fixed inset-0 bg-app-card/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-app-card border border-app-border rounded-[6px] max-w-lg w-full p-5 space-y-4 shadow-2xl text-xs animate-in zoom-in-95 duration-200 text-app-text-primary">
            <div className="flex justify-between items-center border-b border-app-border pb-3">
              <h3 className="font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-app-accent-light" /> Auditing Corporate Certificate
              </h3>
              <button
                onClick={() => {
                  setShowDocModal(false);
                  setActiveDocForModal(null);
                }}
                className="p-1 hover:bg-white/10 rounded-full text-app-text-secondary hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono">
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                <span className="text-app-text-secondary">Class Type:</span>
                <span className="col-span-2 text-app-text-primary font-bold">{activeDocForModal.type}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                <span className="text-app-text-secondary">File Name:</span>
                <span className="col-span-2 text-slate-350 truncate">{activeDocForModal.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                <span className="text-app-text-secondary">Ledger Status:</span>
                <span className="col-span-2 text-app-text-primary uppercase font-bold">{activeDocForModal.status}</span>
              </div>
              {activeDocForModal.notes && (
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                  <span className="text-app-text-secondary">Audit Notes:</span>
                  <span className="col-span-2 text-app-text-secondary">{activeDocForModal.notes}</span>
                </div>
              )}
            </div>

            {activeDocForModal.doc_url && activeDocForModal.doc_url !== '#' ? (
              <a
                href={activeDocForModal.doc_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 p-2 bg-white/5 hover:bg-white/10 border border-app-border rounded-[3px] text-app-text-secondary hover:text-white text-[11px] font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Uploaded Document
              </a>
            ) : (
              <p className="p-2 bg-white/[0.01] border border-dashed border-app-border rounded-[3px] text-[10px] text-app-text-secondary text-center">
                No document asset URL on file for this record.
              </p>
            )}

            <div className="pt-2 border-t border-app-border flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDocModal(false);
                  setActiveDocForModal(null);
                }}
                className="px-4 py-1.5 bg-white/5 rounded-[3px] text-app-text-secondary hover:bg-white/10"
              >
                Dismiss Modal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
