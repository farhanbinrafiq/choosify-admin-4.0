import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Send, 
  User, 
  Building2, 
  MoreHorizontal, 
  CheckCircle2, 
  Clock, 
  MessageCircle, 
  Award, 
  ShieldCheck, 
  Flag,
  Megaphone,
  Filter,
  CheckCircle,
  Paperclip,
  Smile,
  ExternalLink,
  ShoppingBag,
  Truck,
  XCircle,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders, MessageThread, ThreadMessage, Order } from '../../contexts/OrdersContext';

// Base mock support channels
const generalMockMessages = [
  { 
    id: 'general_1', 
    sender: 'Mehedi Rahman', 
    role: 'Consumer', 
    subject: 'Delayed product delivery inquiry', 
    preview: 'I ordered the Samsung S25 Ultra 3 days ago but haven\'t received any update yet...', 
    time: '14 min ago', 
    status: 'UNREAD',
    avatar: 'MR',
    color: 'bg-blue-500/10 text-blue-500',
    messages: [
      { id: 'gm1', senderName: 'Mehedi Rahman', senderRole: 'customer', text: 'I ordered the Samsung S25 Ultra 3 days ago but haven\'t received any update yet...', timestamp: '2026-05-20T10:00:00' }
    ]
  },
  { 
    id: 'general_2', 
    sender: 'TechZone BD', 
    role: 'Seller', 
    subject: 'Verification document inquiry', 
    preview: 'We have uploaded our trade license. Can you please check if it is sufficient?', 
    time: '2 hr ago', 
    status: 'READ',
    avatar: 'TZ',
    color: 'bg-orange-500/10 text-orange-500',
    messages: [
      { id: 'gm2', senderName: 'TechZone BD', senderRole: 'seller', text: 'We have uploaded our trade license. Can you please check if it is sufficient?', timestamp: '2026-05-20T08:00:00' }
    ]
  }
];

const RoleBadge = ({ role }: { role: string }) => {
  const styles: Record<string, string> = {
    'Consumer': 'bg-blue-500/10 text-blue-500 border-blue-500/10',
    'customer': 'bg-blue-500/10 text-blue-500 border-blue-500/10',
    'Seller': 'bg-orange-500/10 text-orange-500 border-orange-500/10',
    'seller': 'bg-orange-500/10 text-orange-500 border-orange-500/10',
    'creator': 'bg-green-500/10 text-green-500 border-green-500/10',
    'Creator': 'bg-green-500/10 text-green-500 border-green-500/10',
    'admin': 'bg-purple-500/10 text-purple-400 border-purple-500/10',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${styles[role] || 'bg-white/5 text-white'} border-current opacity-75`}>
      {role}
    </span>
  );
};

export default function MessagesPage() {
  const { profile } = useAuth();
  const { 
    orders, 
    messageThreads, 
    sendChatMessage, 
    approveOrder, 
    declineOrder, 
    dispatchOrder, 
    cancelOrder,
    updateOrderStatus
  } = useOrders();

  const [selectedId, setSelectedId] = useState<string>('thread_CSS-9844');
  const [replyText, setReplyText] = useState('');
  const [activeTab, setActiveTab] = useState<'inbox' | 'announcements'>('inbox');
  const [searchTerm, setSearchTerm] = useState('');

  // Dispatch modal sub-states inside Inbox
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [dispatchPartner, setDispatchPartner] = useState('');
  const [dispatchTracking, setDispatchTracking] = useState('');

  // Decline/Cancel reason inline input
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReasonText, setDeclineReasonText] = useState('');

  const currentRole = profile?.role || 'super_admin';

  // Filter threads for current Seller if Seller
  const sellerId = currentRole === 'seller' ? profile?.id : 'seller_001';
  const filteredOrderThreads = currentRole === 'seller' 
    ? messageThreads.filter(t => t.product?.sellerId === sellerId)
    : messageThreads; // admins see all threads

  // Combine regular mock messages and Order Threads for Super Admin, or only order threads + general for Seller
  const combinedThreads = [...filteredOrderThreads, ...generalMockMessages].filter(t => {
    const textTerm = searchTerm.toLowerCase();
    const nameMatch = t.customer?.name?.toLowerCase().includes(textTerm) || ('sender' in t && String(t.sender).toLowerCase().includes(textTerm));
    const subjectMatch = 'subject' in t ? String(t.subject).toLowerCase().includes(textTerm) : false;
    return nameMatch || subjectMatch;
  });

  const selectedThread = filteredOrderThreads.find(t => t.id === selectedId);
  const selectedGeneral = !selectedThread ? generalMockMessages.find(g => g.id === selectedId) : null;

  const currentChatMessages = selectedThread 
    ? selectedThread.messages 
    : (selectedGeneral ? selectedGeneral.messages : []);

  const linkedOrder: Order | undefined = selectedThread?.orderId 
    ? orders.find(o => o.id === selectedThread.orderId) 
    : undefined;

  const handleSendResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    if (selectedThread) {
      const senderName = currentRole === 'seller' ? (selectedThread.product?.sellerName || 'Merchant Partner') : 'Platform Admin';
      const senderRole = currentRole === 'seller' ? 'seller' : 'admin';
      sendChatMessage(selectedThread.id, replyText, senderRole, senderName);
    } else if (selectedGeneral) {
      // General mock response simulation
      selectedGeneral.messages.push({
        id: Math.random().toString(),
        senderName: 'Platform Support Admin',
        senderRole: 'admin',
        text: replyText,
        timestamp: new Date().toISOString()
      });
    }

    setReplyText('');
  };

  const executeInboxApprove = () => {
    if (!linkedOrder) return;
    approveOrder(linkedOrder.id, "Approved directly via support Inbox integration channel.");
  };

  const executeInboxDecline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedOrder || !declineReasonText.trim()) return;
    declineOrder(linkedOrder.id, declineReasonText);
    setDeclineReasonText('');
    setShowDeclineForm(false);
  };

  const executeInboxDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedOrder || !dispatchPartner.trim()) return;
    dispatchOrder(linkedOrder.id, dispatchPartner, dispatchTracking || `https://choosify.com.bd/track/${linkedOrder.id}`);
    setDispatchPartner('');
    setDispatchTracking('');
    setShowDispatchForm(false);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex bg-app-card border border-app-border rounded-3xl overflow-hidden shadow-2xl relative text-sans">
      
      {/* Sidebar Navigation */}
      <div className="w-[64px] bg-app-sidebar border-r border-app-border flex flex-col items-center py-6 gap-6 shrink-0">
         <button 
           onClick={() => setActiveTab('inbox')}
           className={`p-3 rounded-xl transition-all ${activeTab === 'inbox' ? 'active-filter-item bg-app-accent text-white shadow-lg shadow-app-accent/15 scale-110' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
         >
            <MessageCircle className="w-5 h-5" />
         </button>
         <button 
           onClick={() => setActiveTab('announcements')}
           className={`p-3 rounded-xl transition-all ${activeTab === 'announcements' ? 'active-filter-item bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
         >
            <Megaphone className="w-5 h-5" />
         </button>
         <div className="mt-auto flex flex-col gap-4">
            <button className="p-3 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
               <Filter className="w-5 h-5" />
            </button>
         </div>
      </div>

      {/* List Area */}
      <div className="w-[340px] bg-app-bg border-r border-app-border flex flex-col shrink-0">
        <div className="p-5 border-b border-app-border">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-black text-white uppercase tracking-widest">{activeTab === 'inbox' ? 'Unified Inbox' : 'Broadcasts'}</h3>
             <span className="text-[10px] font-bold bg-app-accent text-white px-2.5 py-0.5 rounded-full">
               {combinedThreads.length} Threads
             </span>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-app-accent transition-colors" />
            <input 
              type="text" 
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-app-bg border border-app-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-app-accent/50 transition-all font-medium"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-app-border/45">
          {activeTab === 'inbox' ? (
            combinedThreads.map((thread) => {
              const isOrderRelated = 'orderId' in thread;
              const title = isOrderRelated ? (thread.customer?.name || 'Customer') : (thread as any).sender;
              const desc = isOrderRelated ? `Order #${thread.orderId}` : (thread as any).subject;
              const prevText = isOrderRelated ? thread.preview : (thread as any).preview;
              const displayTime = isOrderRelated ? thread.time : (thread as any).time;
              const avatarLetter = isOrderRelated ? thread.customer?.name?.[0] : (thread as any).avatar;
              const unread = thread.status === 'UNREAD';

              return (
                <div 
                  key={thread.id}
                  onClick={() => {
                    setSelectedId(thread.id);
                    setShowDispatchForm(false);
                    setShowDeclineForm(false);
                  }}
                  className={`px-5 py-4 cursor-pointer transition-all relative group ${selectedId === thread.id ? 'bg-app-accent/10 border-r-4 border-r-app-accent' : 'hover:bg-white/[0.02]'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold bg-app-sidebar border border-white/5 text-white shrink-0">
                        {avatarLetter}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-white group-hover:text-app-accent-light transition-colors truncate leading-tight">
                          {title}
                        </h4>
                        <span className="text-[9px] text-slate-500 truncate block mt-0.5 font-medium">{desc}</span>
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">{displayTime}</span>
                  </div>

                  <p className="text-[10px] text-slate-400 line-clamp-1 group-hover:text-slate-300 transition-colors pl-0.5 leading-relaxed">
                    {prevText}
                  </p>
                  
                  {unread && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-app-accent rounded-full animate-pulse" />
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center space-y-4">
               <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 mx-auto border border-orange-500/20 shadow-xl">
                  <Megaphone className="w-6 h-6" />
               </div>
               <h4 className="text-xs font-bold text-white uppercase tracking-widest leading-relaxed">Broadcast Hub</h4>
               <p className="text-[10px] text-slate-500 leading-relaxed">Schedule or emit immediate announcement notifications with system sellers and customers.</p>
               <button className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95">
                  New Announcement
               </button>
            </div>
          )}
        </div>
      </div>

      {/* Main view area */}
      <div className="flex-1 flex flex-col bg-app-sidebar">
        {selectedThread || selectedGeneral ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-app-border flex items-center justify-between bg-white/[0.01] shadow-sm relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-app-accent text-white font-bold text-xs flex items-center justify-center">
                  {selectedThread ? selectedThread.customer?.avatar : selectedGeneral?.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-white">
                      {selectedThread ? selectedThread.customer?.name : selectedGeneral?.sender}
                    </h3>
                    <RoleBadge role={selectedThread ? 'Customer' : 'Consumer'} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                    <span className="text-emerald-500 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Linked Chat</span>
                    {selectedThread?.orderId && (
                      <>
                        <span>•</span>
                        <span className="text-app-accent">Order Thread ID: #{selectedThread.orderId}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Layout split: Messages conversation (Left) + Product Card Preview / Order Manager Panel (Right) */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Message History column */}
              <div className="flex-1 flex flex-col bg-app-bg/50">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {currentChatMessages.map((msg, i) => {
                    const isSelf = msg.senderRole === (currentRole === 'seller' ? 'seller' : 'admin');
                    return (
                      <div key={i} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-lg ${
                          isSelf 
                            ? 'bg-app-accent text-white rounded-br-none shadow-app-accent/5' 
                            : 'bg-app-card border border-app-border rounded-bl-none text-white'
                        }`}>
                          <div className="text-[8px] font-black tracking-widest uppercase mb-1 opacity-60">
                            {msg.senderName} • {msg.senderRole}
                          </div>
                          <p className="text-[12px] leading-relaxed font-medium">
                            {msg.text}
                          </p>
                          <span className="text-[8px] mt-1.5 block opacity-40 text-right">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply bar */}
                <form onSubmit={handleSendResponse} className="p-4 border-t border-app-border bg-app-card">
                  <div className="flex items-center gap-3 bg-app-bg border border-app-border rounded-2xl p-2.5 focus-within:border-app-accent/60 transition-all">
                    <textarea 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a direct question or responses..."
                      rows={1}
                      className="flex-1 bg-transparent text-xs text-white outline-none resize-none px-2 h-8 flex items-center placeholder-slate-500 pt-1.5"
                    />
                    <button 
                      type="submit"
                      disabled={!replyText.trim()}
                      className="p-2 bg-app-accent hover:bg-orange-500 text-white rounded-xl shadow-md disabled:opacity-20 transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* PRODUCT & ORDER ACTIONS SIDE PANEL */}
              {selectedThread && selectedThread.product && (
                <div className="w-[280px] border-l border-app-border bg-app-card p-5 overflow-y-auto shrink-0 space-y-6 custom-scrollbar">
                  
                  {/* Linked Product Card Preview */}
                  <div className="space-y-3">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Product Card Preview</span>
                    <div className="bg-app-bg border border-app-border rounded-2xl p-4 space-y-3 shadow-md">
                      <div className="h-28 overflow-hidden rounded-xl border border-app-border/40 relative bg-black/50">
                        <img src={selectedThread.product.image} className="w-full h-full object-cover" alt="" />
                        <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-[9px] font-black tracking-wider px-2 py-0.5 rounded text-app-accent-light">
                          ৳ {selectedThread.product.price.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-white truncate">{selectedThread.product.name}</h4>
                        <p className="text-[9px] text-slate-500 uppercase mt-0.5 font-bold">{selectedThread.product.brand}</p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Order Actions Integration Panel */}
                  {linkedOrder && (
                    <div className="space-y-4">
                      <div className="border-t border-app-border/60 pt-4">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Order Lifecycle Manager</span>
                        
                        {/* Status detail box */}
                        <div className="bg-app-bg border border-app-border rounded-xl p-3 mb-4 space-y-2">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">Order ID:</span>
                            <span className="font-mono font-bold text-white">{linkedOrder.id}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">Status:</span>
                            <span className="font-bold text-app-accent uppercase tracking-wider">{linkedOrder.status}</span>
                          </div>
                        </div>

                        {/* Interactive operations workflow buttons */}
                        <div className="space-y-2">
                          {linkedOrder.status === 'Pending' && (
                            <>
                              <button 
                                onClick={executeInboxApprove}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve & Confirm
                              </button>
                              
                              {!showDeclineForm ? (
                                <button 
                                  onClick={() => setShowDeclineForm(true)}
                                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-rose-400 border border-rose-500/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  Reject Request
                                </button>
                              ) : (
                                <form onSubmit={executeInboxDecline} className="bg-app-bg border border-rose-500/20 p-3 rounded-xl space-y-2">
                                  <input 
                                    required
                                    type="text"
                                    value={declineReasonText}
                                    onChange={(e) => setDeclineReasonText(e.target.value)}
                                    placeholder="Enter mandatory reason..."
                                    className="w-full bg-app-card text-[10px] text-white px-2 py-1.5 outline-none border border-app-border rounded"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button type="button" onClick={() => setShowDeclineForm(false)} className="text-[9px] text-slate-500">Cancel</button>
                                    <button type="submit" className="text-[9px] text-rose-400 font-bold">Apply Reject</button>
                                  </div>
                                </form>
                              )}
                            </>
                          )}

                          {linkedOrder.status === 'Confirmed' && (
                            <>
                              {!showDispatchForm ? (
                                <button 
                                  onClick={() => {
                                    setShowDispatchForm(true);
                                    setDispatchPartner('');
                                    setDispatchTracking('');
                                  }}
                                  className="w-full py-2.5 bg-gradient-to-r from-app-accent to-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                                >
                                  <Truck className="w-3.5 h-3.5" /> Mark Dispatched
                                </button>
                              ) : (
                                <form onSubmit={executeInboxDispatch} className="bg-app-bg border border-app-border p-3 rounded-xl space-y-2">
                                  <div className="text-[9px] font-bold text-slate-400">Carrier details:</div>
                                  <input 
                                    required
                                    type="text"
                                    value={dispatchPartner}
                                    onChange={(e) => setDispatchPartner(e.target.value)}
                                    placeholder="Courier Partner (Pathao...)"
                                    className="w-full bg-app-card text-[10px] text-white px-2 py-1.5 outline-none border border-app-border rounded"
                                  />
                                  <input 
                                    type="text"
                                    value={dispatchTracking}
                                    onChange={(e) => setDispatchTracking(e.target.value)}
                                    placeholder="Tracking Link Note (Optional)"
                                    className="w-full bg-app-card text-[10px] text-white px-2 py-1.5 outline-none border border-app-border rounded"
                                  />
                                  <div className="flex gap-2 justify-end pt-1">
                                    <button type="button" onClick={() => setShowDispatchForm(false)} className="text-[9px] text-slate-500">Cancel</button>
                                    <button type="submit" className="text-[9px] text-app-accent font-bold">Confirm Dispatch</button>
                                  </div>
                                </form>
                              )}

                              <button 
                                onClick={() => {
                                  const reason = prompt("Enter post-approval cancellation reason:");
                                  if (reason) cancelOrder(linkedOrder.id, reason);
                                }}
                                className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] rounded-xl font-bold uppercase"
                              >
                                Cancel Order
                              </button>
                            </>
                          )}

                          {linkedOrder.status === 'Dispatched' && (
                            <button 
                              onClick={() => updateOrderStatus(linkedOrder.id, 'In Transit')}
                              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase transition-all"
                            >
                              Transition In Transit ➔
                            </button>
                          )}

                          {linkedOrder.status === 'In Transit' && (
                            <button 
                              onClick={() => updateOrderStatus(linkedOrder.id, 'Delivered')}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-md"
                            >
                              Deliver Package ✓
                            </button>
                          )}

                          {['Delivered', 'Cancelled'].includes(linkedOrder.status) && (
                            <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                              Lifecycle Concluded
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-24 h-24 bg-app-bg border border-app-border rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-app-accent/15 opacity-0 group-hover:opacity-100 transition-opacity" />
               <MessageCircle className="w-12 h-12 text-slate-600 relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Workspace Chat System</h3>
            <p className="text-slate-500 max-w-sm text-xs leading-relaxed">
              Select an ongoing order inquiry thread or general support conversation to interface with merchants and customers.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
