import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTrust, ModeratorReport, ContentFlag, ModerationRule, FlagType, SeverityType, ModeratableEntityType } from '../../contexts/TrustContext';
import { 
  ShieldAlert, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Sliders, 
  Eye, 
  Trash2, 
  UserX, 
  Ban, 
  HelpCircle, 
  Plus, 
  Play, 
  Check, 
  X,
  ChevronRight,
  Info
} from 'lucide-react';

export default function ModerationV2() {
  const {
    reports,
    contentFlags,
    moderationActions,
    moderationRules,
    submitReport,
    addContentFlag,
    takeModerationAction,
    toggleModerationRule
  } = useTrust();

  // Sub-tabs inside Moderation Engine
  const [activeTab, setActiveTab] = useState<'queue' | 'flags' | 'rules' | 'audit'>('queue');
  
  // Selected Report for Actioning
  const [selectedReportId, setSelectedReportId] = useState<string>('rep_001');

  // Input states for taking moderation actions
  const [actionNotes, setActionNotes] = useState('');
  
  // Interactive Simulation variables
  const [simReportType, setSimReportType] = useState<ModeratableEntityType>('products');
  const [simEntityId, setSimEntityId] = useState('prd_103');
  const [simEntityName, setSimEntityName] = useState('Samsung S25 Ultra Silicate Casing');
  const [simReporterName, setSimReporterName] = useState('Admins Automated Audit');
  const [simFlagType, setSimFlagType] = useState<FlagType>('Copyright Issue');
  const [simDetails, setSimDetails] = useState('Flagged duplicate brand intellectual patents registered on retail node.');

  const selectedReport = useMemo(() => {
    return reports.find(r => r.id === selectedReportId) || reports[0];
  }, [reports, selectedReportId]);

  const getFlagColor = (flag: FlagType) => {
    switch (flag) {
      case 'Fraud': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'Fake Product': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'Copyright Issue': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'Spam': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getSeverityBadge = (sev: SeverityType) => {
    switch (sev) {
      case 'Critical': return 'bg-red-650/15 text-red-400 border-red-500/25 font-bold';
      case 'High': return 'bg-[#EB4501]/10 text-app-accent-light border-[#EB4501]/20 font-bold';
      case 'Medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/15';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/15';
    }
  };

  const executeSimulationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitReport(simReportType, simEntityId, simEntityName, simReporterName, simFlagType, simDetails);
    alert(`Report filed! Automated rules audited. Node flagged with Medium severity: ${simFlagType}`);
  };

  const handleSimTypeChange = (type: ModeratableEntityType) => {
    setSimReportType(type);
    if (type === 'products') {
      setSimEntityId('prd_103');
      setSimEntityName('Samsung S25 Ultra Casing');
    } else if (type === 'reviews') {
      setSimEntityId('rev_bad_01');
      setSimEntityName('Apex formal leather reviews');
    } else if (type === 'sellers') {
      setSimEntityId('seller_techzone');
      setSimEntityName('TechZone BD');
    } else {
      setSimEntityId('rec_02');
      setSimEntityName('Rafsans shoe recommendation');
    }
  };

  return (
    <div className="space-y-6 pb-12 transition-all animate-in fade-in duration-300 text-app-text-primary">
      <div className="bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold px-4 py-2 rounded-lg mb-4">
        FRAUD DETECTION ENGINE — This module handles AI-assisted pattern detection and automated flagging. For manual content review, use the Moderation Center.
      </div>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <span>Risk Management</span>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">Moderation Center v2</span>
          </div>
          <h1 className="text-xl font-bold text-app-text-primary tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" /> Unified Moderation Engine V2
          </h1>
          <p className="text-app-text-secondary text-[12px]">
            Enterprise-grade content auditing logs, fraud analytics filters, and flexible policy warning action trails matching system rules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/reviews"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#F4631E]/15 border border-[#F4631E]/30 hover:bg-[#F4631E]/25 text-[#F4631E] rounded-[4px] text-[10.5px] font-black uppercase tracking-widest transition-all shadow-md cursor-pointer"
          >
            Review Moderation Console
          </Link>
          <div className="flex items-center gap-2 bg-app-card border border-app-border rounded-[4px] p-2 text-[10px] font-bold uppercase tracking-widest text-[#8E9BAE] font-mono select-none">
            <span>Active Flagged records: {reports.filter(r => r.status === 'Pending').length} pending</span>
          </div>
        </div>
      </div>

      {/* COMPACT MODERATION NAVIGATION MENU */}
      <div className="flex border-b border-app-border gap-2 font-mono text-[11px] font-extrabold uppercase select-none">
        <button
          onClick={() => setActiveTab('queue')}
          className={`pb-3 px-4 border-b-2 cursor-pointer transition-colors${
            activeTab === 'queue' ? 'border-app-accent text-white' : 'border-transparent text-app-text-secondary hover:text-white'
          }`}
        >
          Moderation Queue ({reports.filter(r => r.status === 'Pending').length})
        </button>
        <button
          onClick={() => setActiveTab('flags')}
          className={`pb-3 px-4 border-b-2 cursor-pointer transition-colors${
            activeTab === 'flags' ? 'border-app-accent text-white' : 'border-transparent text-app-text-secondary hover:text-white'
          }`}
        >
          Content Flags ({contentFlags.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 px-4 border-b-2 cursor-pointer transition-colors${
            activeTab === 'rules' ? 'border-app-accent text-white' : 'border-transparent text-app-text-secondary hover:text-white'
          }`}
        >
          Rules Automation Engine ({moderationRules.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 border-b-2 cursor-pointer transition-colors${
            activeTab === 'audit' ? 'border-app-accent text-white' : 'border-transparent text-app-text-secondary hover:text-white'
          }`}
        >
          Intel Audit History
        </button>
      </div>

      {/* RENDER ACTIVE VIEWS */}
      
      {/* Tab A: QUEUE PANEL */}
      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* QUEUE LIST (5 COLS) */}
          <div className="lg:col-span-5 bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider border-b border-app-border pb-2">Flagged content submissions</h3>
            
            <div className="space-y-3.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-2">
              {reports.map(rep => (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReportId(rep.id)}
                  className={`p-3 bg-white/[0.01] border rounded-[4px] cursor-pointer text-left transition-all relative${
                    selectedReportId === rep.id ? 'border-red-500 bg-white/[0.03]' : 'border-white/[0.04] hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-app-text-primary text-xs truncate max-w-[180px]">{rep.entity_name}</h4>
                      <span className="text-[9px] text-[#8E9BAE] uppercase font-mono block mb-1">{rep.entity_type}</span>
                    </div>

                    <span className={`px-1.5 py-0.5 rounded-[2px] text-[8.5px] font-bold border uppercase${getFlagColor(rep.flag_type)}`}>
                      {rep.flag_type}
                    </span>
                  </div>

                  <p className="text-[10.5px] text-app-text-secondary line-clamp-1">{rep.details}</p>

                  <div className="flex justify-between items-center text-[9px] text-slate-500 pt-1.5 border-t border-app-border mt-1.5 font-mono">
                    <span>Filer: {rep.reporter_name}</span>
                    <span className={`font-bold${rep.status === 'Pending' ? 'text-yellow-400' : 'text-green-500'}`}>{rep.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* QUEUE DETAIL PAGE & CORNER DECISIONS (7 COLS) */}
          <div className="lg:col-span-7 bg-app-card border border-app-border rounded-[4px] p-6 shadow-2xl space-y-5">
            {selectedReport ? (
              <div className="space-y-5">
                
                <div className="border-b border-app-border pb-3 flex justify-between items-start">
                  <div>
                    <h2 className="text-base font-black text-app-text-primary">{selectedReport.entity_name}</h2>
                    <p className="text-[11.5px] text-app-text-secondary font-mono">Incident reference register: {selectedReport.id}</p>
                    <p className="text-[11.5px] text-app-text-secondary">Class target: <strong className="text-app-text-primary uppercase">{selectedReport.entity_type}</strong></p>
                  </div>

                  <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold border uppercase tracking-wider${getFlagColor(selectedReport.flag_type)}`}>
                    {selectedReport.flag_type}
                  </span>
                </div>

                <div className="p-4 bg-white/[0.01] border border-app-border space-y-1.5 rounded-[4px]">
                  <span className="text-[9px] text-[#8E9BAE] uppercase tracking-wide font-extrabold font-mono block">Violation report details:</span>
                  <p className="text-xs text-app-text-primary leading-relaxed">{selectedReport.details}</p>
                  <span className="text-[9.5px] text-slate-500 font-mono block pt-1">Reporter source: {selectedReport.reporter_name} • submitted at {new Date(selectedReport.created_at).toLocaleString()}</span>
                </div>

                {/* DECISION ACTION ENFORCER BOX - PHASE 6 */}
                {selectedReport.status === 'Pending' ? (
                  <div className="p-4 bg-white/[0.01] rounded-[4px] border border-app-border space-y-4">
                    <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-1">
                      <Sliders className="w-4 h-4 text-app-accent-light" /> Enforce Administrative corrective action
                    </h3>

                    <div className="space-y-1.5 text-xs">
                      <label className="text-[9.5px] uppercase font-mono text-[#8E9BAE] font-extrabold block">Incident resolve statement notes</label>
                      <textarea
                        rows={2}
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        placeholder="Log reasoning factors for penalty trace records..."
                        className="w-full bg-app-card border border-app-border rounded-[3px] p-2 text-app-text-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold font-mono">
                      
                      <button
                        onClick={() => {
                          if (!actionNotes.trim()) return alert('Add resolve notes');
                          takeModerationAction(selectedReport.id, selectedReport.entity_type, selectedReport.entity_id, 'Remove Content', 'usr_admin_101', actionNotes);
                          setActionNotes('');
                          alert('Content item flagged and deactivated in store registries.');
                        }}
                        className="bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400 py-2.5 rounded-[3px] cursor-pointer uppercase flex items-center justify-center gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Content
                      </button>

                      <button
                        onClick={() => {
                          if (!actionNotes.trim()) return alert('Add resolve notes');
                          takeModerationAction(selectedReport.id, selectedReport.entity_type, selectedReport.entity_id, 'Suspend Account', 'usr_admin_101', actionNotes);
                          setActionNotes('');
                          alert('Target suspended. Severe reputation balance deduction ledger points created.');
                        }}
                        className="bg-red-650 hover:bg-red-600 border border-red-650 text-white py-2.5 rounded-[3px] cursor-pointer uppercase flex items-center justify-center gap-0.5"
                      >
                        <Ban className="w-3.5 h-3.5" /> Suspend profile
                      </button>

                      <button
                        onClick={() => {
                          if (!actionNotes.trim()) return alert('Add resolve notes');
                          takeModerationAction(selectedReport.id, selectedReport.entity_type, selectedReport.entity_id, 'Issue Warning', 'usr_admin_101', actionNotes);
                          setActionNotes('');
                          alert('Deport compliance warning warning sent.');
                        }}
                        className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/15 py-2.5 rounded-[3px] cursor-pointer uppercase flex items-center justify-center"
                      >
                        Issue Warning
                      </button>

                      <button
                        onClick={() => {
                          if (!actionNotes.trim()) return alert('Add resolve notes');
                          takeModerationAction(selectedReport.id, selectedReport.entity_type, selectedReport.entity_id, 'Dismiss Case', 'usr_admin_101', actionNotes);
                          setActionNotes('');
                          alert('Case fully dismissed.');
                        }}
                        className="bg-white/5 hover:bg-white/10 text-app-text-secondary py-2.5 rounded-[3px] cursor-pointer uppercase flex items-center justify-center"
                      >
                        Dismiss Case
                      </button>

                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-550/10 border border-emerald-555/20 p-3 rounded-[3px] text-emerald-400 leading-normal flex items-start gap-2 font-mono">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                    <div>
                      <strong>Incident resolved:</strong> Action has been enacted on this profile, and matching trust ledgers has been synchronized.
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="py-20 text-center text-app-text-secondary border border-dashed border-app-border rounded-[4px]">
                <HelpCircle className="w-10 h-10 mx-auto opacity-20 mb-2" />
                <p className="text-xs font-bold text-app-text-primary">Select report</p>
                <p className="text-[10px]">Review flagged content and take administrative actions immediately.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab B: FLAGS LIST */}
      {activeTab === 'flags' && (
        <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
          <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Active Content flags</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            {contentFlags.map(f => (
              <div key={f.id} className="p-4 bg-white/[0.01] border border-app-border rounded-[4px] space-y-2">
                <div className="flex justify-between items-start gap-1">
                  <div>
                    <h4 className="font-sans font-bold text-app-text-primary truncate max-w-[150px]">{f.entity_name}</h4>
                    <span className="text-[9px] text-[#8E9BAE] block uppercase">{f.entity_type} : {f.entity_id}</span>
                  </div>

                  <span className={`px-1.5 py-0.5 rounded-[2px] text-[8px] uppercase border${getSeverityBadge(f.severity)}`}>
                    {f.severity}
                  </span>
                </div>

                <div className="p-2 bg-app-card rounded-[2px] text-yellow-400/90 text-[10.5px]">
                  Flagged for: {f.flag_type}
                </div>

                <div className="flex justify-between text-[9px] text-slate-500 pt-1 border-t border-app-border">
                  <span>By {f.flagged_by}</span>
                  <span>{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab C: RULES ENGINE */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="bg-white/[0.01] border border-app-border p-4 rounded-[4px] flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wide font-sans">Automated policy rules</h3>
              <p className="text-[10px] text-app-text-secondary">Manage algorithmic filters triggers, fake review limits, and return rates warning alerts.</p>
            </div>
            
            <div className="text-xs font-mono text-green-400 bg-green-500/10 px-2.5 py-1 rounded border border-green-500/15">
              Active engine: 2 policy active
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {moderationRules.map(rule => (
              <div key={rule.id} className="bg-app-card border border-app-border rounded-[4px] p-5.5 shadow-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <h4 className="font-sans font-black text-app-text-primary text-xs">{rule.name}</h4>
                    
                    <button
                      onClick={() => toggleModerationRule(rule.id)}
                      className={`px-2 py-0.5 rounded-[2px] font-mono text-[9px] font-bold uppercase border cursor-pointer${
                        rule.active 
                          ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                          : 'bg-red-500/10 text-slate-400 border-transparent'
                      }`}
                    >
                      {rule.active ? 'Active' : 'Muted'}
                    </button>
                  </div>

                  <p className="text-[10px] text-app-text-secondary leading-normal">
                    Fires automatically on trigger context: <strong className="text-app-text-primary font-mono">{rule.trigger_event}</strong>
                  </p>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2 bg-app-card rounded-[2px] border border-app-border">
                    <span className="text-[8.5px] text-slate-500 block uppercase">Policy condition:</span>
                    <span className="text-app-text-primary text-[11px] font-bold">{rule.condition}</span>
                  </div>

                  <div className="p-2 bg-app-card rounded-[2px] border border-app-border">
                    <span className="text-[8.5px] text-slate-500 block uppercase">Auto Action consequence:</span>
                    <span className="text-[#EB4501] text-[11px] font-bold">{rule.auto_action}</span>
                  </div>
                </div>

                <span className="text-[8.5px] font-mono text-slate-500 block text-right">Rule reference ID: {rule.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab D: AUDIT HISTORY */}
      {activeTab === 'audit' && (
        <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
          <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Intel moderation audit history logs</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-app-border text-[10px] text-[#8E9BAE] uppercase tracking-wider">
                  <th className="py-2.5">Action ID</th>
                  <th>Target Entity</th>
                  <th>Action Applied</th>
                  <th>Enacted By Actor</th>
                  <th>Outcome Comments</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {moderationActions.map(act => (
                  <tr key={act.id} className="hover:bg-white/[0.01]">
                    <td className="py-3 text-[#8E9BAE] font-bold">{act.id}</td>
                    <td className="text-app-text-primary capitalize">{act.entity_type} ({act.entity_id})</td>
                    <td>
                      <span className="px-1.5 py-0.5 rounded-[2.5px] bg-[#EB4501]/10 border border-[#EB4501]/20 text-[#EB4501] font-bold text-[9px] uppercase tracking-wider">
                        {act.action_taken}
                      </span>
                    </td>
                    <td className="font-sans text-slate-350">{act.acted_by}</td>
                    <td className="text-app-text-secondary max-w-xs truncate">{act.notes}</td>
                    <td className="text-slate-500">{new Date(act.enacted_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE SIMULATION MODULE PANEL */}
      <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
        <div className="border-b border-app-border pb-2">
          <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Play className="w-4 h-4 text-emerald-400" /> Dynamic Incident Report Simulation Worktable
          </h3>
          <p className="text-[10px] text-app-text-secondary">Report duplicate listings or fake rating behavior to register a new alert. Policy checking runs automatically on submission.</p>
        </div>

        <form onSubmit={executeSimulationSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs font-mono">
          <div className="md:col-span-2 space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Class Target</label>
            <select
              value={simReportType}
              onChange={(e) => handleSimTypeChange(e.target.value as ModeratableEntityType)}
              className="w-full bg-app-card border border-app-border p-2 text-app-text-primary rounded-[3px] focus:outline-none"
            >
              <option value="products">Product (Inventory)</option>
              <option value="reviews">Review (Trust Ratings)</option>
              <option value="sellers">Seller profile</option>
              <option value="recommendations">Curated Guide</option>
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Target reference & name</label>
            <input
              type="text"
              value={simEntityName}
              onChange={(e) => setSimEntityName(e.target.value)}
              className="w-full bg-white/[0.02] border border-app-border p-2 text-app-text-primary rounded-[3px] h-9"
              required
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Violation core</label>
            <select
              value={simFlagType}
              onChange={(e) => setSimFlagType(e.target.value as FlagType)}
              className="w-full bg-app-card border border-app-border p-2 text-app-text-primary rounded-[3px] focus:outline-none"
            >
              <option value="Copyright Issue">Copyright Issue</option>
              <option value="Fake Product">Fake Product</option>
              <option value="Spam">Spam</option>
              <option value="Fraud">Fraud</option>
              <option value="Misleading Information">Misleading Information</option>
              <option value="Suspicious Activity">Suspicious Activity</option>
            </select>
          </div>

          <div className="md:col-span-5 space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Enact incident audit reasons details</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={simDetails}
                onChange={(e) => setSimDetails(e.target.value)}
                placeholder="Submit audit grounds or trademarks link..."
                className="flex-1 bg-white/[0.02] border border-app-border p-2 text-app-text-primary rounded-[3px] h-9"
                required
              />
              <button
                type="submit"
                className="bg-[#EB4501] hover:bg-app-accent-light text-app-text-primary font-bold px-4 rounded-[3px] cursor-pointer"
              >
                File Alert
              </button>
            </div>
          </div>
        </form>
      </div>

    </div>
  );
}
