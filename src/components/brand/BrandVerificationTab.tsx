import React from 'react';
import { ShieldCheck, FileCheck, RefreshCw, XCircle, AlertTriangle, FileText, Upload } from 'lucide-react';

interface BrandVerificationTabProps {
  kycChecks: any;
  setKycChecks: React.Dispatch<React.SetStateAction<any>>;
  documentItems: any[];
  setDocumentItems: React.Dispatch<React.SetStateAction<any[]>>;
  reviewNotes: string;
  setReviewNotes: (notes: string) => void;
  brandProfile: any;
  updateProfile: (profileId: string, updates: any) => void;
  updateChecklistStatus: (key: any, newStatus: string) => void;
  updateDocStatus: (index: number, newStatus: string) => void;
  showToast: (msg: string) => void;
}

export const BrandVerificationTab: React.FC<BrandVerificationTabProps> = ({
  kycChecks,
  setKycChecks,
  documentItems,
  setDocumentItems,
  reviewNotes,
  setReviewNotes,
  brandProfile,
  updateProfile,
  updateChecklistStatus,
  updateDocStatus,
  showToast
}) => {

  const handleVerifyAllKYC = () => {
    // Approve every checklist item
    setKycChecks({
      nid: 'Approved',
      kyc: 'Approved',
      tradeLicense: 'Approved',
      vat: 'Approved',
      tin: 'Approved',
      bank: 'Approved'
    });
    // Approve all document items
    setDocumentItems(prev => prev.map(doc => ({ ...doc, status: 'Approved' })));
    showToast('✓ Verified all critical KYC filings & structural background check systems.');
  };

  const handleForceReReview = () => {
    // Reset checklist items to 'Pending'
    setKycChecks({
      nid: 'Pending',
      kyc: 'Pending',
      tradeLicense: 'Pending',
      vat: 'Pending',
      tin: 'Pending',
      bank: 'Pending'
    });
    // Reset document items to 'Pending'
    setDocumentItems(prev => prev.map(doc => ({ ...doc, status: 'Pending' })));
    showToast('🔄 Force re-review initiated. Background filings reset.');
  };

  return (
    <div className="space-y-6 text-left" id="verification_center_panel">
      {/* Tab subtitle & header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">🧾 Verification Center & KYC</h2>
          <p className="text-slate-500 text-xs mt-1">Review official representative document filings, license records, tax validations, and signature certifications.</p>
        </div>
        
        {/* Verification Tab Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyAllKYC}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <ShieldCheck className="w-4 h-4" /> Verify All KYC
          </button>
          <button
            onClick={handleForceReReview}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white border border-slate-300 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> Reset / Re-Review
          </button>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Verification Checklist</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-medium">
          {[
            { key: 'nid', label: 'NID Verification', value: kycChecks.nid },
            { key: 'kyc', label: 'KYC Handshake Check', value: kycChecks.kyc },
            { key: 'tradeLicense', label: 'Trade License Authenticity', value: kycChecks.tradeLicense },
            { key: 'vat', label: 'VAT Registration NBR Cert', value: kycChecks.vat },
            { key: 'tin', label: 'NBR TIN Verification', value: kycChecks.tin },
            { key: 'bank', label: 'Bank Routing Attestation', value: kycChecks.bank },
          ].map((item) => (
            <div key={item.key} className="bg-slate-50 border border-slate-205 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-sm">
              <span className="font-bold text-slate-800">{item.label}</span>
              
              <div className="mt-3 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  item.value === 'Approved' ? 'bg-green-50 text-green-600' :
                  item.value === 'Pending' ? 'bg-yellow-50 text-yellow-600 animate-pulse' :
                  item.value === 'Rejected' ? 'bg-red-50 text-red-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {item.value}
                </span>
                
                <select
                  value={item.value}
                  onChange={(e) => updateChecklistStatus(item.key, e.target.value)}
                  className="text-[10px] bg-white hover:bg-slate-50 border border-slate-250 rounded p-1 font-bold font-sans cursor-pointer focus:outline-none"
                >
                  <option>Approved</option>
                  <option>Pending</option>
                  <option>Rejected</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submitted documents list */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Filed Government Documents</h3>
        
        <div className="overflow-hidden border border-slate-200 rounded-xl divide-y divide-slate-200 text-xs">
          {documentItems.map((doc, idx) => (
            <div key={idx} className="p-4 bg-slate-50/20 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{doc.name}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Filed Date: {doc.date} &middot; Size: {doc.size} &middot; Type: <span className="font-mono">{doc.type}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full ${
                  doc.status === 'Approved' ? 'bg-green-50 text-green-600 border border-green-100' :
                  doc.status === 'Pending' ? 'bg-yellow-55 text-yellow-600 border border-yellow-200' :
                  'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {doc.status}
                </span>

                <div className="flex gap-1">
                  <button 
                    onClick={() => updateDocStatus(idx, 'Approved')}
                    className="p-1 px-2.5 bg-white border border-slate-200 hover:bg-green-50 text-green-600 rounded-md text-[10px] font-bold"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => updateDocStatus(idx, 'Rejected')}
                    className="p-1 px-2.5 bg-white border border-slate-200 hover:bg-red-50 text-red-600 rounded-md text-[10px] font-bold"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Notes block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Internal Review Notes & Signatures</h3>
        <textarea
          rows={3}
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          className="w-full bg-slate-50/50 border border-slate-300 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:bg-white resize-none"
        />
        <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
          <span>Last modified by: Admin Overlord</span>
          <button 
            onClick={() => showToast('✓ Review logs updated.')}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all"
          >
            Post Review Log
          </button>
        </div>
      </div>
    </div>
  );
};
