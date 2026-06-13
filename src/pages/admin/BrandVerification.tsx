import React, { useState, useMemo } from 'react';
import { useTrust, VerificationRequest, VerificationDocument, DocumentType } from '../../contexts/TrustContext';
import { 
  ShieldCheck, 
  Clock, 
  FileCheck, 
  FileText, 
  Building2, 
  ThumbsUp, 
  ThumbsDown, 
  AlertTriangle, 
  User, 
  FileSignature, 
  Compass, 
  Database,
  CornerDownRight, 
  Check, 
  X, 
  Eye, 
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';

export default function BrandVerification() {
  const {
    verificationRequests,
    submitVerificationRequest,
    updateDocumentStatus,
    reviewVerificationRequest,
    createVerificationRequest
  } = useTrust();

  // Selected Brand Request for Detail view
  const [selectedRequestId, setSelectedRequestId] = useState<string>('vr_002');
  
  // Tab filters
  const [activeQueueTab, setActiveQueueTab] = useState<'All' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Draft'>('All');
  
  // Document Review Popup Modal states
  const [showDocModal, setShowDocModal] = useState(false);
  const [activeDocForModal, setActiveDocForModal] = useState<VerificationDocument | null>(null);
  
  // Review final states
  const [reviewerFeedback, setReviewerFeedback] = useState('');
  const [resubmissionNotes, setResubmissionNotes] = useState<Record<string, string>>({});

  // Simulation brands
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100');

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

  // Launch simulated brand registration draft
  const triggerBrandCreation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    const fakeBrandId = 'brand_' + newBrandName.toLowerCase().replace(/\s+/g, '_');
    createVerificationRequest(fakeBrandId, newBrandName, newBrandLogo);
    setNewBrandName('');
    setActiveQueueTab('Draft');
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
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" /> Enterprise Brand Verification System
          </h1>
          <p className="text-app-text-secondary text-[12px]">
            Formal compliance audit node enabling multi-tiered corporate document verifications, identity validation, and secure auditing tracks.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-app-border rounded-[4px] p-2 text-[10px] font-bold uppercase tracking-widest text-[#8E9BAE] font-mono select-none">
          <span>Verification Queue: {verificationRequests.length} Brands</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: BRAND VERIFICATION QUEUE & REGISTRATION SIMULATOR (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* QUEUE CARD */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
            <div className="border-b border-white/[0.04] pb-2 flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Verification Queue</h3>
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
                    className={`px-2 py-1 text-[9px] font-extrabold uppercase rounded-[2px] border cursor-pointer ${
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
              {filteredQueue.length > 0 ? (
                filteredQueue.map(req => (
                  <div 
                    key={req.id}
                    onClick={() => setSelectedRequestId(req.id)}
                    className={`p-3 bg-white/[0.01] border rounded-[4px] cursor-pointer transition-all flex gap-3 text-left relative ${
                      selectedRequestId === req.id 
                        ? 'border-app-accent bg-white/[0.03]' 
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                    }`}
                  >
                    <img 
                      src={req.logo_url} 
                      alt={req.brand_name} 
                      className="w-10 h-10 rounded-full border border-white/10 object-cover bg-white"
                      referrerPolicy="no-referrer"
                    />

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-white text-xs truncate">{req.brand_name}</h4>
                        <span className={`px-1.5 py-0.5 rounded-[2px] text-[8px] tracking-wider uppercase border ${getStatusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </div>

                      <p className="text-[10px] text-app-text-secondary truncate">By {req.submitted_by}</p>
                      
                      <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                        <span>Documents: {req.documents.length}</span>
                        <span>{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-app-text-secondary border border-dashed border-app-border rounded-[4px]">
                  <FileText className="w-8 h-8 opacity-25 mx-auto mb-2" />
                  <p className="text-xs font-bold text-white">Queue completely clear</p>
                  <p className="text-[10px]">No brand requests match the filter criteria.</p>
                </div>
              )}
            </div>
          </div>

          {/* SIMULATE CORPORATE APPLICATION INITIATION */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
            <div className="border-b border-white/[0.04] pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
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
                  className="w-full bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-white focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Public Logo URL Asset</label>
                <input
                  type="text"
                  value={newBrandLogo}
                  onChange={(e) => setNewBrandLogo(e.target.value)}
                  className="w-full bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-white font-mono focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-550 text-white font-bold py-2 rounded-[3px] cursor-pointer transition-colors"
              >
                Assemble Compliance Draft dossier
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: REVIEWS DETAIL PANEL & VERIFICATION WORKFLOWS (7 COLS) */}
        <div className="lg:col-span-7 bg-app-card border border-app-border rounded-[4px] p-6 shadow-2xl space-y-6">
          
          {selectedRequest ? (
            <div className="space-y-6">
              
              {/* BRAND META HEADER */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-white/[0.04] pb-4">
                <div className="flex gap-4">
                  <img 
                    src={selectedRequest.logo_url} 
                    alt={selectedRequest.brand_name} 
                    className="w-14 h-14 rounded-[4px] border border-white/10 object-cover bg-white"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h2 className="text-base font-black text-white">{selectedRequest.brand_name}</h2>
                    <p className="text-[11px] text-app-text-secondary font-mono">System Request Register: {selectedRequest.id}</p>
                    <p className="text-[11px] text-slate-500">Submitted by: <strong className="text-white">{selectedRequest.submitted_by}</strong></p>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2 items-end self-end sm:self-auto">
                  <span className={`px-2.5 py-0.5 rounded-[2px] text-xs font-bold uppercase tracking-widest border ${getStatusBadge(selectedRequest.status)}`}>
                    {selectedRequest.status}
                  </span>
                  
                  {selectedRequest.status === 'Draft' && (
                    <button
                      onClick={() => submitVerificationRequest(selectedRequest.id)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-550 text-white font-bold text-[9px] uppercase tracking-wider rounded-[2px] cursor-pointer"
                    >
                      Process Submission
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
                  {selectedRequest.documents.map(doc => (
                    <div 
                      key={doc.id} 
                      className={`p-3 bg-white/[0.01] rounded-[4px] border shadow-md flex flex-col justify-between space-y-3 ${
                        doc.status === 'approved' ? 'border-green-500/20 bg-green-500/[0.01]' :
                        doc.status === 'rejected' ? 'border-red-500/20 bg-red-500/[0.01]' : 'border-white/[0.04]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-extrabold text-white text-[11px] uppercase tracking-wide truncate">{doc.type}</span>
                          <span className="flex items-center gap-1">
                            {getDocStatusIcon(doc.status)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-sans truncate">{doc.name}</p>
                      </div>

                      {doc.notes && (
                        <div className="p-2 bg-slate-900/50 rounded-[2px] text-[10px] text-[#8E9BAE] leading-relaxed border border-white/[0.02]">
                          <strong>Audit details:</strong> {doc.notes}
                        </div>
                      )}

                      {/* Interactive doc status buttons */}
                      <div className="flex gap-2 pt-1 border-t border-white/[0.03]">
                        <button
                          onClick={() => {
                            setActiveDocForModal(doc);
                            setShowDocModal(true);
                          }}
                          className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] py-1 rounded-[2px] cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> Audit Details
                        </button>
                        
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateDocumentStatus(selectedRequest.id, doc.id, 'approved', 'Document verified successfully by Lead Auditor.')}
                            className="p-1 px-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-[2px] border border-green-500/15 cursor-pointer"
                            title="Quick Approve Document"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const notesInput = prompt('Enter rejection notes for this document:') || 'Invalid format';
                              updateDocumentStatus(selectedRequest.id, doc.id, 'rejected', notesInput);
                            }}
                            className="p-1 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-[2px] border border-red-500/15 cursor-pointer"
                            title="Flag Document"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* QUICK APPROVE ACTIONS BLOCK & COMPLIANCE FEEDBACK */}
              <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-[4px] space-y-4">
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
                    className="w-full bg-white/[0.01] border border-app-border rounded-[3px] p-2 bg-slate-900 text-white focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!reviewerFeedback.trim()) {
                        alert('Please provide compliance feedback first.');
                        return;
                      }
                      reviewVerificationRequest(selectedRequest.id, 'usr_admin_101', 'Administrative lead auditor', 'approved', reviewerFeedback);
                      setReviewerFeedback('');
                    }}
                    className="flex-1 bg-green-650 hover:bg-green-600 text-white font-extrabold uppercase text-[10px] tracking-wider py-2.5 rounded-[3px] cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Approve Enterprise Brand
                  </button>

                  <button
                    onClick={() => {
                      if (!reviewerFeedback.trim()) {
                        alert('Please provide compliance feedback notes.');
                        return;
                      }
                      reviewVerificationRequest(selectedRequest.id, 'usr_admin_101', 'Administrative lead auditor', 'rejected', reviewerFeedback);
                      setReviewerFeedback('');
                    }}
                    className="flex-1 bg-red-650 hover:bg-red-600 text-white font-extrabold uppercase text-[10px] tracking-wider py-2.5 rounded-[3px] cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> Flag and Deny Application
                  </button>
                </div>
              </div>

              {/* VERIFICATION AUDIT TRAIL TIMELINE (PHASE 3 REQUIRED) */}
              <div className="space-y-3.5 pt-2">
                <h3 className="text-[11px] font-bold text-[#8E9BAE] uppercase tracking-widest flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-app-accent" /> Verification Audit Trail & Timeline
                </h3>

                <div className="relative border-l border-white/[0.06] pl-4.5 ml-2.5 space-y-4">
                  {selectedRequest.audit_trail.map((trail, index) => (
                    <div key={index} className="relative text-xs font-mono">
                      
                      {/* Circle on timeline */}
                      <div className="absolute -left-[24.5px] top-1 w-3 h-3 rounded-full bg-app-accent border border-app-card" />

                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-bold">{trail.action}</span>
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
          ) : (
            <div className="text-center py-20 text-app-text-secondary border border-dashed border-app-border rounded-[4px]">
              <Building2 className="w-12 h-12 opacity-20 mx-auto mb-3" />
              <p className="text-sm font-bold text-white">No active requests selected</p>
              <p className="text-xs">Choose folders or submissions from the queue list to audit.</p>
            </div>
          )}

        </div>

      </div>

      {/* DOCUMENT AUDIT VIEW POPUP MODAL */}
      {showDocModal && activeDocForModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-app-card border border-app-border rounded-[6px] max-w-lg w-full p-5 space-y-4 shadow-2xl text-xs animate-in zoom-in-95 duration-200 text-app-text-primary">
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
              <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-app-accent-light" /> Auditing Corporate Certificate
              </h3>
              <button 
                onClick={() => {
                  setShowDocModal(false);
                  setActiveDocForModal(null);
                }}
                className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono">
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-white/[0.02]">
                <span className="text-slate-400">Class Type:</span>
                <span className="col-span-2 text-white font-bold">{activeDocForModal.type}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-white/[0.02]">
                <span className="text-slate-400">File Name:</span>
                <span className="col-span-2 text-slate-350 truncate">{activeDocForModal.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-white/[0.02]">
                <span className="text-slate-400">Ledger Status:</span>
                <span className="col-span-2 text-white uppercase font-bold">{activeDocForModal.status}</span>
              </div>
            </div>

            {/* Document Verification Checklist Mock Representation */}
            <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-[3px] space-y-2">
              <span className="text-white font-bold block text-[10px] uppercase">Corporate Audit Checklists:</span>
              <ul className="space-y-1.5 text-[10.5px] leading-relaxed text-[#8E9BAE]">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-400" /> Matches registered business trade license ID.
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-400" /> Active tax clearance seal by National Board of Revenue BDT.
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-400" /> Intellectual property brand names domain matches registrar.
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-white/[0.03] flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDocModal(false);
                  setActiveDocForModal(null);
                }}
                className="px-4 py-1.5 bg-white/5 rounded-[3px] text-slate-300 hover:bg-white/10"
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
