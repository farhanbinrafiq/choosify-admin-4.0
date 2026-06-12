import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  FileText, 
  Download, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ArrowLeft,
  Clock,
  Eye,
  MessageSquare,
  AlertCircle,
  ExternalLink,
  Save,
  Send,
  MoreVertical,
  Check,
  X,
  Globe,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Store,
  Tag,
  ShoppingBag,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ApplicationStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Needs Resubmission';

interface Document {
  id: string;
  name: string;
  url: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  comment?: string;
}

interface TimelineItem {
  action: string;
  admin: string;
  date: string;
  note?: string;
  status: ApplicationStatus;
}

export default function SellerReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ApplicationStatus>('Under Review');
  const [activeTab, setActiveTab] = useState('Applicant Personal Info');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [resubmitReason, setResubmitReason] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const [documents, setDocuments] = useState<Document[]>([
    { id: '1', name: 'National ID (Front)', url: 'https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&q=80', status: 'Pending' },
    { id: '2', name: 'National ID (Back)', url: 'https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&q=80', status: 'Pending' },
    { id: '3', name: 'Trade License', url: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=800&q=80', status: 'Pending' },
    { id: '4', name: 'Bank Statement / Check', url: 'https://images.unsplash.com/photo-1554224155-169641357599?w=800&q=80', status: 'Pending' },
  ]);

  const [timeline, setTimeline] = useState<TimelineItem[]>([
    { action: 'Application Submitted', admin: 'System', date: 'May 14, 2026, 10:30 AM', status: 'Pending' },
    { action: 'Review Started', admin: 'Admin Farhan', date: 'May 15, 2026, 02:45 PM', status: 'Under Review' },
  ]);

  const handleDocStatusChange = (docId: string, newStatus: 'Verified' | 'Rejected') => {
    setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, status: newStatus } : doc));
  };

  const handleApprove = () => {
    setStatus('Approved');
    setTimeline(prev => [
      ...prev,
      { action: 'Seller Account Approved', admin: 'Admin Farhan', date: new Date().toLocaleString(), status: 'Approved' }
    ]);
    // Notification logic would go here
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    setStatus('Rejected');
    setTimeline(prev => [
      ...prev,
      { action: 'Application Rejected', admin: 'Admin Farhan', date: new Date().toLocaleString(), note: rejectionReason, status: 'Rejected' }
    ]);
    setIsRejectModalOpen(false);
  };

  const handleResubmit = () => {
    if (!resubmitReason.trim()) return;
    setStatus('Needs Resubmission');
    setTimeline(prev => [
      ...prev,
      { action: 'Resubmission Requested', admin: 'Admin Farhan', date: new Date().toLocaleString(), note: resubmitReason, status: 'Needs Resubmission' }
    ]);
    setIsResubmitModalOpen(false);
  };

  const statusColors: Record<ApplicationStatus, string> = {
    'Pending': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'Under Review': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Approved': 'bg-green-500/10 text-green-500 border-green-500/20',
    'Rejected': 'bg-red-500/10 text-red-500 border-red-500/20',
    'Needs Resubmission': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-app-card border border-app-border rounded-2xl text-app-text-secondary hover:text-white transition-all shadow-xl active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-app-sidebar border border-app-border flex items-center justify-center text-white overflow-hidden shadow-2xl">
              <User className="w-8 h-8 opacity-20" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Rahim Uddin</h1>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${statusColors[status]}`}>
                  {status}
                </span>
              </div>
              <p className="text-app-text-secondary text-sm mt-1">Aarong Digital · Application ID: <span className="font-mono text-app-accent-light">APP-{id?.slice(-4).toUpperCase() || '5492'}</span></p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
           <button 
             onClick={() => setIsResubmitModalOpen(true)}
             className="flex items-center gap-2 px-5 py-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-xl text-xs font-bold hover:bg-orange-500 hover:text-white transition-all"
           >
              <RotateCcw className="w-4 h-4" /> Request Resubmission
           </button>
           <button 
             onClick={() => setIsRejectModalOpen(true)}
             className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
           >
              <XCircle className="w-4 h-4" /> Reject Seller
           </button>
           <button 
             onClick={handleApprove}
             className="flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white border-transparent rounded-xl text-xs font-bold hover:bg-green-600 transition-all shadow-xl shadow-green-500/20 active:scale-95"
           >
              <CheckCircle2 className="w-4 h-4" /> Approve Seller
           </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-app-border scrollbar-hide overflow-x-auto">
        {['Applicant Personal Info', 'Documents', 'Business Info', 'Review History'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-4 text-[11px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab 
                ? 'active-tab-item text-app-accent-light border-b-2 border-app-accent bg-app-accent/5' 
                : 'text-app-text-secondary hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-8">
          {activeTab === 'Applicant Personal Info' && (
            <div className="space-y-8">
              {/* Basic Information */}
              <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                <h3 className="text-lg font-bold text-white tracking-tight mb-8">Applicant Personal Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                   <div className="space-y-1">
                      <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                        <User className="w-3 h-3" /> Full Name
                      </label>
                      <div className="text-sm font-bold text-white">Rahim Uddin Ahmed</div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                        <Building2 className="w-3 h-3" /> Business Name
                      </label>
                      <div className="text-sm font-bold text-white">Aarong Digital Solutions</div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                        <Phone className="w-3 h-3" /> Phone Number
                      </label>
                      <div className="text-sm font-bold text-white">01711-XXXXXX</div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                        <Mail className="w-3 h-3" /> Email Address
                      </label>
                      <div className="text-sm font-bold text-white">rahim@aarongdigital.com</div>
                   </div>
                   <div className="col-span-full space-y-1">
                      <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> Business Address
                      </label>
                      <div className="text-sm font-bold text-white leading-relaxed">
                        House 24, Road 18, Block D, Banani R/A, Dhaka-1213, Bangladesh
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" /> National ID / Bus. Reg
                      </label>
                      <div className="text-sm font-mono text-app-accent-light">5492817293021</div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Application Date
                      </label>
                      <div className="text-sm font-bold text-white">May 14, 2026</div>
                   </div>
                </div>
              </section>

              {/* Internal Review Notes */}
              <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                 <div className="flex items-center gap-3 mb-6">
                    <MessageSquare className="w-5 h-5 text-app-accent" />
                    <h3 className="text-lg font-bold text-white tracking-tight">Internal Admin Notes</h3>
                 </div>
                 <textarea 
                   value={adminNote}
                   onChange={(e) => setAdminNote(e.target.value)}
                   placeholder="Add internal notes about this seller review (not visible to seller)..."
                   className="w-full bg-app-sidebar border border-app-border rounded-2xl p-6 text-sm text-white outline-none focus:border-app-accent/40 transition-all font-medium min-h-[120px]"
                 />
                 <div className="mt-4 flex justify-end">
                    <button className="flex items-center gap-2 px-4 py-2 bg-app-accent/10 text-app-accent-light rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-app-accent/20 transition-all">
                       <Save className="w-4 h-4" /> Save Note
                    </button>
                 </div>
              </section>
            </div>
          )}

          {activeTab === 'Documents' && (
            <div className="space-y-6">
              {documents.map((doc) => (
                <div key={doc.id} className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                   <div className="flex flex-col md:flex-row gap-8">
                      {/* Doc Preview */}
                      <div className="w-full md:w-1/3 aspect-[4/3] bg-app-sidebar rounded-2xl border border-app-border overflow-hidden relative group">
                        <img src={doc.url} alt={doc.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                           <button className="p-3 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 transition-all">
                              <Eye className="w-6 h-6" />
                           </button>
                           <button className="p-3 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 transition-all">
                              <Download className="w-6 h-6" />
                           </button>
                        </div>
                      </div>

                      {/* Doc Details & Actions */}
                      <div className="flex-1 space-y-6">
                         <div className="flex items-start justify-between">
                            <div>
                               <h4 className="text-lg font-bold text-white tracking-tight">{doc.name}</h4>
                               <div className="flex items-center gap-2 mt-2">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                                    doc.status === 'Verified' ? 'bg-green-500/10 text-green-500' : 
                                    doc.status === 'Rejected' ? 'bg-red-500/10 text-red-500' : 
                                    'bg-yellow-500/10 text-yellow-500'
                                  }`}>
                                    {doc.status}
                                  </span>
                               </div>
                            </div>
                            <div className="flex gap-2">
                               <button 
                                 onClick={() => handleDocStatusChange(doc.id, 'Rejected')}
                                 className={`p-2 rounded-xl transition-all ${doc.status === 'Rejected' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'}`}
                               >
                                  <X className="w-5 h-5" />
                               </button>
                               <button 
                                 onClick={() => handleDocStatusChange(doc.id, 'Verified')}
                                 className={`p-2 rounded-xl transition-all ${doc.status === 'Verified' ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500 hover:text-white'}`}
                               >
                                  <Check className="w-5 h-5" />
                               </button>
                            </div>
                         </div>

                         <div className="space-y-2">
                            <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50">Admin Comment for this Document</label>
                            <input 
                              placeholder="Add reason if rejected..."
                              className="w-full bg-app-sidebar border border-app-border rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-app-accent/40"
                            />
                         </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Business Info' && (
            <div className="space-y-8">
               <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                  <div className="flex flex-col md:flex-row gap-10">
                     {/* Store Logo & Branding */}
                     <div className="w-full md:w-1/4 space-y-6">
                        <div className="space-y-3">
                           <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                             <ImageIcon className="w-3 h-3" /> Business Logo
                           </label>
                           <div className="w-32 h-32 md:w-full aspect-square bg-app-sidebar border border-app-border rounded-3xl flex items-center justify-center overflow-hidden group relative">
                              <img 
                                src="https://images.unsplash.com/photo-1541746972996-4e0b0f43e01a?w=400&q=80" 
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                alt="Store Logo"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <Eye className="w-6 h-6 text-white" />
                              </div>
                           </div>
                        </div>
                        <div className="p-4 bg-app-accent/5 border border-app-accent/10 rounded-2xl">
                           <div className="text-[9px] text-app-accent-light font-bold uppercase tracking-widest mb-1">Brand Tier</div>
                           <div className="text-sm text-white font-bold">Premium Seller-01</div>
                        </div>
                     </div>

                     {/* Detailed Info */}
                     <div className="flex-1 space-y-8">
                        <div>
                           <h3 className="text-lg font-bold text-white tracking-tight mb-6">Store & Business Details</h3>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                              <div className="space-y-1">
                                 <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                                   <Store className="w-3 h-3" /> Store Trading Name
                                 </label>
                                 <div className="text-sm font-bold text-white">Aarong Digital Official Store</div>
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                                   <Tag className="w-3 h-3" /> Business Category
                                 </label>
                                 <div className="text-sm font-bold text-white">Clothing, Lifestyle & Handicrafts</div>
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                                   <ShoppingBag className="w-3 h-3" /> Expected Product Range
                                 </label>
                                 <div className="text-sm font-bold text-white">50 - 200 Live SKUs</div>
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 flex items-center gap-2">
                                   <MapPin className="w-3 h-3" /> Physical Store Presence
                                 </label>
                                 <div className="text-sm font-bold text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Yes (14 Registered Locations)
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="pt-8 border-t border-app-border">
                           <h4 className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mb-6 opacity-60">Digital Presence & Links</h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                 <div className="space-y-2">
                                    <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-40">Official Website</label>
                                    <a href="#" className="flex items-center gap-2 text-sm text-app-accent-light hover:underline font-medium group">
                                       <Globe className="w-4 h-4" /> aarongdigital.com
                                       <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-40">Affiliate / Dealer Page</label>
                                    <a href="#" className="flex items-center gap-2 text-sm text-app-accent-light hover:underline font-medium group">
                                       <LinkIcon className="w-4 h-4" /> partner.aarongdigital.com/verify
                                       <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                 </div>
                              </div>

                              <div className="space-y-3">
                                 <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-40">Social Ecosystem</label>
                                 <div className="flex flex-wrap gap-4">
                                    <a href="#" className="p-2.5 bg-app-sidebar border border-app-border rounded-xl text-app-text-secondary hover:text-white hover:border-app-accent/30 transition-all">
                                       <Facebook className="w-4 h-4" />
                                    </a>
                                    <a href="#" className="p-2.5 bg-app-sidebar border border-app-border rounded-xl text-app-text-secondary hover:text-white hover:border-app-accent/30 transition-all">
                                       <Twitter className="w-4 h-4" />
                                    </a>
                                    <a href="#" className="p-2.5 bg-app-sidebar border border-app-border rounded-xl text-app-text-secondary hover:text-white hover:border-app-accent/30 transition-all">
                                       <Instagram className="w-4 h-4" />
                                    </a>
                                    <a href="#" className="p-2.5 bg-app-sidebar border border-app-border rounded-xl text-app-text-secondary hover:text-white hover:border-app-accent/30 transition-all">
                                       <Linkedin className="w-4 h-4" />
                                    </a>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="pt-8 border-t border-app-border">
                           <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50 mb-3 block">Store Mission & Description</label>
                           <p className="text-sm text-app-text-secondary leading-relaxed italic bg-app-sidebar/30 p-6 rounded-2xl border border-app-border/50">
                             "Premium digital marketplace for authentic Aarong products, focusing on bringing traditional craftsmanship to the modern digital consumer with seamless delivery and heritage appeal. Our goal is to expand the reach of local artisans to the global stage while maintaining strict quality controls and verified business practices."
                           </p>
                        </div>
                     </div>
                  </div>
               </section>
            </div>
          )}

          {activeTab === 'Review History' && (
            <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <h3 className="text-lg font-bold text-white tracking-tight mb-8">Application Timeline</h3>
               <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-app-border">
                  {timeline.map((item, i) => (
                    <div key={i} className="relative pl-10">
                       <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-app-card flex items-center justify-center ${
                         item.status === 'Approved' ? 'bg-green-500' : 
                         item.status === 'Rejected' ? 'bg-red-500' : 
                         item.status === 'Needs Resubmission' ? 'bg-orange-500' : 
                         'bg-app-accent'
                       }`}>
                          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                       </div>
                       <div className="space-y-1">
                          <div className="flex items-center justify-between">
                             <h4 className="text-sm font-bold text-white">{item.action}</h4>
                             <span className="text-[10px] text-app-text-secondary font-mono">{item.date}</span>
                          </div>
                          <p className="text-[11px] text-app-text-secondary">Performed by: <span className="text-white font-bold">{item.admin}</span></p>
                          {item.note && (
                            <div className="mt-3 p-4 bg-app-sidebar/50 border border-app-border rounded-xl text-xs text-app-text-secondary italic">
                               "{item.note}"
                            </div>
                          )}
                       </div>
                    </div>
                  ))}
               </div>
            </section>
          )}
        </div>

        {/* Sidebar Actions Summary */}
        <div className="space-y-8">
           <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
              <h3 className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mb-6 opacity-60">Verification Checklist</h3>
              <div className="space-y-4">
                 {[
                   { label: 'Identity Verified', status: documents.filter(d => d.name.includes('ID')).every(d => d.status === 'Verified') },
                   { label: 'Trade License Valid', status: documents.find(d => d.name === 'Trade License')?.status === 'Verified' },
                   { label: 'Bank Info Confirmed', status: documents.find(d => d.name.includes('Bank'))?.status === 'Verified' },
                   { label: 'Contact Verified', status: true },
                 ].map((item, i) => (
                   <div key={i} className="flex items-center justify-between p-3 bg-app-sidebar/30 border border-app-border rounded-xl">
                      <span className="text-xs text-white/80 font-medium">{item.label}</span>
                      {item.status ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-app-text-secondary opacity-40" />
                      )}
                   </div>
                 ))}
              </div>
           </section>

           <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl bg-gradient-to-br from-app-card to-app-accent/5">
              <div className="flex items-center gap-3 mb-6">
                <ShieldCheck className="w-6 h-6 text-app-accent" />
                <h3 className="text-lg font-bold text-white tracking-tight">Status Update</h3>
              </div>
              <p className="text-xs text-app-text-secondary mb-8 leading-relaxed">
                Confirm your decision based on the submitted application and verification results. 
              </p>
              
              <div className="space-y-3">
                 <button 
                   onClick={handleApprove}
                   disabled={status === 'Approved'}
                   className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-xs shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all disabled:opacity-50 active:scale-[0.98]"
                 >
                    Final: Approve Application
                 </button>
                 <button 
                    onClick={() => setIsResubmitModalOpen(true)}
                    className="w-full py-4 bg-app-sidebar border border-app-border text-orange-500 rounded-2xl font-bold text-xs hover:bg-white/5 transition-all active:scale-[0.98]"
                 >
                    Ask for Resubmission
                 </button>
              </div>
           </section>
        </div>
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {isRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-app-card border border-app-border rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative overflow-hidden"
             >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <XCircle className="w-32 h-32 text-red-500" />
                </div>
                
                <h3 className="text-2xl font-extrabold text-white mb-2 tracking-tight">Reject Application</h3>
                <p className="text-app-text-secondary text-sm mb-8 italic">Provide a clear and constructive reason for rejection. This will be sent to the seller.</p>
                
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] text-red-500 font-bold uppercase tracking-widest ml-1">Rejection Reason (Required)</label>
                      <textarea 
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g., The trade license provided has expired or is invalid for the requested category..."
                        className="w-full bg-app-sidebar border border-app-border rounded-2xl p-6 text-sm text-white outline-none focus:border-red-500/40 min-h-[150px] leading-relaxed"
                      />
                   </div>

                   <div className="flex gap-4">
                      <button 
                        onClick={() => setIsRejectModalOpen(false)}
                        className="flex-1 py-4 bg-app-sidebar border border-app-border text-white rounded-2xl font-bold text-xs hover:bg-white/5 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleReject}
                        className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-xs shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" /> Confirm Rejection
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resubmit Modal */}
      <AnimatePresence>
        {isResubmitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-app-card border border-app-border rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative overflow-hidden"
             >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <RotateCcw className="w-32 h-32 text-orange-500" />
                </div>
                
                <h3 className="text-2xl font-extrabold text-white mb-2 tracking-tight">Request Resubmission</h3>
                <p className="text-app-text-secondary text-sm mb-8 italic">Explain what needs correction so the seller can update their application.</p>
                
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] text-orange-500 font-bold uppercase tracking-widest ml-1">What needs correction?</label>
                      <textarea 
                        value={resubmitReason}
                        onChange={(e) => setResubmitReason(e.target.value)}
                        placeholder="e.g., The bank statement is blurry. Please upload a clear digital copy or a high-res photo..."
                        className="w-full bg-app-sidebar border border-app-border rounded-2xl p-6 text-sm text-white outline-none focus:border-orange-500/40 min-h-[150px] leading-relaxed"
                      />
                   </div>

                   <div className="flex gap-4">
                      <button 
                        onClick={() => setIsResubmitModalOpen(false)}
                        className="flex-1 py-4 bg-app-sidebar border border-app-border text-white rounded-2xl font-bold text-xs hover:bg-white/5 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleResubmit}
                        className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold text-xs shadow-xl shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" /> Send Request
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


