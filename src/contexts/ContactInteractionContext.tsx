import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, MessageSquare, Send, X, Check, Loader2, Info, AlertTriangle, ArrowLeft, Search, CheckCheck } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useOrders } from './OrdersContext';

export interface ContactTarget {
  id: string;
  name: string;
  avatarUrl: string;
  phone?: string;
  status?: 'Active' | 'Banned' | 'Inactive' | string;
  role?: string;
  online?: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  sender: 'me' | 'them';
}

interface ChatThread {
  targetId: string;
  messages: ChatMessage[];
  metadata: {
    context_type: string;
    source: string;
    entity_id: string;
    unread?: boolean;
    targetName?: string;
    targetAvatarUrl?: string;
    targetRole?: string;
  };
}

interface ContactInteractionContextType {
  triggerPhone: (target: ContactTarget) => void;
  triggerMessage: (target: ContactTarget) => void;
  openChatWith: (target: ContactTarget) => void;
  triggerOpenInbox: () => void;
  unreadProfileCount: number;
}

const ContactInteractionContext = createContext<ContactInteractionContextType | undefined>(undefined);

export const useContact = () => {
  const context = useContext(ContactInteractionContext);
  if (!context) {
    throw new Error('useContact must be used within a ContactInteractionProvider');
  }
  return context;
};

export const ContactInteractionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const { 
    messageThreads, 
    sendChatMessage, 
    markThreadAsRead, 
    markAllThreadsAsRead 
  } = useOrders();
  
  // Custom Toast State
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
    phoneIcon?: boolean;
    type: 'success' | 'error' | 'info';
  }>({
    message: '',
    visible: false,
    phoneIcon: false,
    type: 'success'
  });

  // Support messages local storage state
  const [supportMessages, setSupportMessages] = useState(() => {
    const saved = localStorage.getItem('choosify_general_messages');
    if (saved) return JSON.parse(saved);
    return [
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
  });

  // Chat Modal State
  const [chatTarget, setChatTarget] = useState<ContactTarget | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Profile direct message threads state
  const [threads, setThreads] = useState<Record<string, ChatThread>>(() => {
    const saved = localStorage.getItem('choosify_chat_threads');
    return saved ? JSON.parse(saved) : {};
  });
  const [isAccessBlocked, setIsAccessBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Save support messages to localStorage when they change
  useEffect(() => {
    localStorage.setItem('choosify_general_messages', JSON.stringify(supportMessages));
  }, [supportMessages]);

  // Save threads to localStorage when they change
  useEffect(() => {
    localStorage.setItem('choosify_chat_threads', JSON.stringify(threads));
  }, [threads]);

  // ESC key listener to close messenger popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChatOpen) {
        closeMessenger();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen]);

  // Handle marking active conversation as READ
  useEffect(() => {
    if (!activeThreadId || !isChatOpen) return;

    const orderThread = messageThreads.find(t => t.id === activeThreadId);
    if (orderThread) {
      if (orderThread.status === 'UNREAD') {
        markThreadAsRead(activeThreadId);
      }
    } else {
      const supportThread = supportMessages.find(m => m.id === activeThreadId);
      if (supportThread) {
        if (supportThread.status === 'UNREAD') {
          setSupportMessages(prev => prev.map(m => m.id === activeThreadId ? { ...m, status: 'READ' } : m));
        }
      } else {
        // Direct Profile Message Thread
        const t = threads[activeThreadId];
        if (t && t.metadata?.unread === true) {
          setThreads(prev => {
            const currentT = prev[activeThreadId];
            if (!currentT) return prev;
            return {
              ...prev,
              [activeThreadId]: {
                ...currentT,
                metadata: {
                  ...currentT.metadata,
                  unread: false
                }
              }
            };
          });
        }
      }
    }
  }, [activeThreadId, isChatOpen, messageThreads, supportMessages, threads, markThreadAsRead]);

  // Count unread direct profile messages
  const unreadProfileCount = (Object.values(threads) as ChatThread[]).filter(t => t.metadata?.unread === true).length;

  const closeMessenger = () => {
    setIsChatOpen(false);
    setChatTarget(null);
    setActiveThreadId(null);
    setSearchTerm('');
  };

  // Global phone action click
  const triggerPhone = (target: ContactTarget) => {
    const rawNumber = target.phone || '+8801700000000';
    
    // Step 1: Copy number to clipboard
    navigator.clipboard.writeText(rawNumber).then(() => {
      // Step 2: Show success toast
      setToast({
        message: `Phone number copied\nReady to call`,
        visible: true,
        phoneIcon: true,
        type: 'success'
      });

      // Clear toast after 3 seconds
      setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3000);

      // Step 3: Trigger native dialer prompt if mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent || ''
      );
      if (isMobile) {
        window.location.href = `tel:${rawNumber}`;
      }
    }).catch(() => {
      setToast({
        message: 'Could not copy phone number to clipboard',
        visible: true,
        phoneIcon: false,
        type: 'error'
      });
      setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3000);
    });
  };

  // Global message action click (opens popup in active thread chat view directly)
  const triggerMessage = (target: ContactTarget) => {
    // Check credentials & authentication status
    if (!profile) {
      setIsAccessBlocked(true);
      setBlockReason('You must be logged in to send a message.');
      setChatTarget(target);
      setActiveThreadId(target.id);
      setIsChatOpen(true);
      return;
    }

    // Access control check: target.status cannot be 'Banned'
    if (target.status === 'Banned') {
      setIsAccessBlocked(true);
      setBlockReason('You cannot contact this user. This profile has been restricted or banned.');
      setChatTarget(target);
      setActiveThreadId(target.id);
      setIsChatOpen(true);
      return;
    }

    setIsAccessBlocked(false);
    setBlockReason('');
    
    // Auto Context Initialization for a first-time thread
    if (!threads[target.id]) {
      const initialThread: ChatThread = {
        targetId: target.id,
        messages: [],
        metadata: {
          context_type: 'profile_message',
          source: 'buyer_profile',
          entity_id: target.id,
          targetName: target.name,
          targetAvatarUrl: target.avatarUrl,
          targetRole: target.role,
          unread: false
        }
      };
      setThreads(prev => ({
        ...prev,
        [target.id]: initialThread
      }));
    } else {
      setThreads(prev => {
        const currentTh = prev[target.id];
        return {
          ...prev,
          [target.id]: {
            ...currentTh,
            metadata: {
              ...currentTh.metadata,
              targetName: target.name,
              targetAvatarUrl: target.avatarUrl,
              targetRole: target.role
            }
          }
        };
      });
    }

    setChatTarget(target);
    setActiveThreadId(target.id);
    setIsChatOpen(true);
  };

  // Open the Messenger directly into Conversation List / Inbox view
  const triggerOpenInbox = () => {
    setIsAccessBlocked(false);
    setBlockReason('');
    setChatTarget(null);
    setActiveThreadId(null);
    setIsChatOpen(true);
  };

  // Bulk action: Mark all as read across all channels
  const handleMarkAllAsReadUnified = () => {
    // 1. Mark Orders message threads read
    markAllThreadsAsRead();

    // 2. Mark general support messages read
    setSupportMessages(prev => prev.map(m => ({ ...m, status: 'READ' })));

    // 3. Mark direct profile threads read
    setThreads(prev => {
      const updated: Record<string, ChatThread> = {};
      Object.keys(prev).forEach(key => {
        updated[key] = {
          ...prev[key],
          metadata: {
            ...prev[key].metadata,
            unread: false
          }
        };
      });
      return updated;
    });

    setToast({
      message: "Checked Inbox\nAll messages marked as read",
      visible: true,
      phoneIcon: false,
      type: 'success'
    });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 2500);
  };

  // Handle message sending across multiple types
  const handleSendMessageUnified = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeThreadId) return;

    const messageText = inputText.trim();
    
    // Find active thread type
    const activeOrderThread = messageThreads.find(t => t.id === activeThreadId);
    const activeSupportThread = supportMessages.find(m => m.id === activeThreadId);

    if (activeOrderThread) {
      const senderName = profile?.displayName || 'Merchant Partner';
      const senderRole = profile?.role === 'seller' ? 'seller' : 'admin';
      sendChatMessage(activeThreadId, messageText, senderRole, senderName);
      setInputText('');
    } else if (activeSupportThread) {
      // Append to general support messages
      setSupportMessages(prev => prev.map(t => {
        if (t.id === activeThreadId) {
          return {
            ...t,
            preview: messageText,
            messages: [
              ...t.messages,
              {
                id: Math.random().toString(),
                senderName: profile?.displayName || 'Merchant Partner',
                senderRole: 'admin',
                text: messageText,
                timestamp: new Date().toISOString()
              }
            ]
          };
        }
        return t;
      }));
      setInputText('');
    } else {
      // Profile Thread
      if (!chatTarget) return;
      const targetId = chatTarget.id;

      const newMsg: ChatMessage = {
        id: Math.random().toString(),
        text: messageText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'me'
      };

      setThreads(prev => {
        const currentThread = prev[targetId] || {
          targetId,
          messages: [],
          metadata: {
            context_type: 'profile_message',
            source: 'buyer_profile',
            entity_id: targetId,
            targetName: chatTarget.name,
            targetAvatarUrl: chatTarget.avatarUrl,
            targetRole: chatTarget.role,
            unread: false
          }
        };
        
        return {
          ...prev,
          [targetId]: {
            ...currentThread,
            messages: [...currentThread.messages, newMsg]
          }
        };
      });

      setInputText('');

      // Auto reply mock simulation
      setTimeout(() => {
        const automaticReplies = [
          `Thanks for reaching out! Let's arrange a call to discuss.`,
          `Received. I am checking the specs. Will get back shortly!`,
          `Perfect, let's keep in touch here. ${chatTarget.name} is available.`,
          `Got it! Let's coordinate our Choosify requirements.`
        ];
        const randomReply = automaticReplies[Math.floor(Math.random() * automaticReplies.length)];

        // Select response preset
        let simulatedReply = randomReply;
        const lText = messageText.toLowerCase();
        if (lText.includes('hello') || lText.includes('hi') || lText.includes('hey')) {
          simulatedReply = `Hello! This is ${chatTarget.name}. Good to connect with you. How can I help you today?`;
        } else if (lText.includes('price') || lText.includes('cost') || lText.includes('expensive')) {
          simulatedReply = `We aim to offer top-tier value on Choosify! Let me share the official deal sheet with you shortly.`;
        }

        const replyMsg: ChatMessage = {
          id: Math.random().toString(),
          text: simulatedReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sender: 'them'
        };

        setThreads(prev => {
          const currentThread = prev[targetId];
          if (!currentThread) return prev;
          return {
            ...prev,
            [targetId]: {
              ...currentThread,
              metadata: {
                ...currentThread.metadata,
                unread: activeThreadId !== targetId // Unread only if we are currently not inside this thread!
              },
              messages: [...currentThread.messages, replyMsg]
            }
          };
        });
      }, 800);
    }
  };

  // Compile full set of items for ConversationList view
  const profileThreadsList = Object.keys(threads).map(targetId => {
    const t = threads[targetId];
    const lastMsg = t.messages[t.messages.length - 1];
    return {
      id: t.targetId,
      name: t.metadata.targetName || `User ${t.targetId.substring(0, 5)}`,
      avatarUrl: t.metadata.targetAvatarUrl || '',
      avatarInitials: (t.metadata.targetName || 'U').substring(0, 2).toUpperCase(),
      role: t.metadata.targetRole || 'User',
      subject: 'Direct Message Chat',
      orderId: undefined,
      brandName: undefined,
      sellerName: undefined,
      preview: lastMsg ? lastMsg.text : 'No messages yet',
      time: lastMsg ? lastMsg.timestamp : 'Recent',
      unread: t.metadata.unread === true,
      messages: t.messages,
      type: 'profile' as const,
      target: {
        id: t.targetId,
        name: t.metadata.targetName || `User`,
        avatarUrl: t.metadata.targetAvatarUrl || '',
        role: t.metadata.targetRole || 'User'
      }
    };
  });

  const orderThreadsList = messageThreads.map(t => ({
    id: t.id,
    name: t.customer?.name || 'Customer',
    avatarUrl: undefined,
    avatarInitials: (t.customer?.name || 'C').substring(0, 2).toUpperCase(),
    role: 'Customer',
    subject: t.subject,
    orderId: t.orderId,
    brandName: t.product?.brand,
    sellerName: t.product?.sellerName,
    preview: t.preview,
    time: t.time,
    unread: t.status === 'UNREAD',
    messages: t.messages,
    type: 'order' as const
  }));

  const supportThreadsList = supportMessages.map(t => ({
    id: t.id,
    name: t.sender,
    avatarUrl: undefined,
    avatarInitials: t.avatar || 'S',
    role: t.role,
    subject: t.subject,
    orderId: undefined,
    brandName: undefined,
    sellerName: undefined,
    preview: t.preview,
    time: t.time,
    unread: t.status === 'UNREAD',
    messages: t.messages,
    type: 'support' as const
  }));

  const allUnifiedThreads = [...profileThreadsList, ...orderThreadsList, ...supportThreadsList];

  // Search inside list (matching Order ID, Seller Name, Brand Name, Contact/Customer Name)
  const filteredThreads = allUnifiedThreads.filter(t => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    
    const matchesOrder = t.orderId ? t.orderId.toLowerCase().includes(term) : false;
    const matchesSeller = t.sellerName ? t.sellerName.toLowerCase().includes(term) : false;
    const matchesBrand = t.brandName ? t.brandName.toLowerCase().includes(term) : false;
    const matchesName = t.name.toLowerCase().includes(term);
    const matchesSubject = t.subject ? t.subject.toLowerCase().includes(term) : false;
    
    return matchesOrder || matchesSeller || matchesBrand || matchesName || matchesSubject;
  });

  // Safe RegExp Escaping
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Real-time matched-text highlighting
  const highlightMatchedText = (text: string, search: string) => {
    if (!search.trim()) return <span>{text}</span>;
    const cleanSearch = search.toLowerCase().trim();
    const regex = new RegExp(`(${escapeRegExp(cleanSearch)})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-orange-500/30 text-orange-950 font-bold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Find active messages block
  const getActiveThreadMessages = () => {
    const activeUnified = allUnifiedThreads.find(x => x.id === activeThreadId);
    return activeUnified ? activeUnified.messages : [];
  };

  const currentMessagesUnified = getActiveThreadMessages();

  return (
    <ContactInteractionContext.Provider value={{ 
      triggerPhone, 
      triggerMessage, 
      openChatWith: triggerMessage,
      triggerOpenInbox,
      unreadProfileCount
    }}>
      {children}

      {/* GLOBAL TOAST DYNAMIC OVERLAY */}
      <AnimatePresence>
        {toast.visible && (
          <div className="fixed top-6 right-6 z-[9999]">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900 border border-emerald-500/30 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-4 max-w-sm"
              style={{ minWidth: '240px' }}
            >
              <div className="bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 text-emerald-400 shrink-0">
                {toast.phoneIcon ? <Phone className="w-5 h-5 animate-pulse" /> : <Check className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                {toast.message.split('\n').map((line, i) => (
                  <span 
                    key={i} 
                    className={`block ${i === 0 ? 'text-xs md:text-sm font-black text-white' : 'text-[11px] text-slate-400 font-mono uppercase tracking-wider mt-0.5'}`}
                  >
                    {line}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GLOBAL CHAT MODAL OVERLAY (FLOATING MESSENGER POPUP) */}
      <AnimatePresence>
        {isChatOpen && (
          <div 
            id="OverlayLayer"
            className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm OverlayLayer transition-all duration-300"
            onClick={closeMessenger} // Click outside to close
          >
            {/* Modal Box / ChatWidget */}
            <motion.div
              id="ChatWidget"
              className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col w-full max-w-full h-full md:w-[440px] md:h-[620px] md:max-h-[85vh] md:rounded-3xl ChatWidget"
              onClick={(e) => e.stopPropagation()} // Stop propagation to prevent Click Outside closure
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            >
              
              {/* CHAT/MESSENGER HEADER */}
              <div id="MessageHeader" className="bg-[#0B1528] text-white px-5 py-4.5 flex items-center justify-between border-b border-slate-800 shrink-0 MessageHeader">
                <div className="flex items-center gap-3">
                  
                  {/* Back to Inbox arrow (only visible when a thread is selected) */}
                  {activeThreadId && (
                    <button
                      onClick={() => {
                        setActiveThreadId(null);
                        setChatTarget(null);
                      }}
                      className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                      title="Back to conversation list"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  )}

                  {/* Header Identity details */}
                  {activeThreadId && chatTarget ? (
                    <div className="flex items-center gap-2.5">
                      <div className="relative shrink-0">
                        {chatTarget.avatarUrl ? (
                          <img
                            src={chatTarget.avatarUrl}
                            alt={chatTarget.name}
                            className="w-10 h-10 rounded-full border border-slate-700 object-cover bg-slate-900"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#F97316] text-white font-bold flex items-center justify-center text-xs border border-slate-700 lowercase">
                            {chatTarget.name.substring(0, 2)}
                          </div>
                        )}
                        {chatTarget.online !== false && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0B1528] rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs md:text-sm font-black tracking-tight block truncate max-w-[160px]">
                          {chatTarget.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-mono text-emerald-400 font-black uppercase tracking-wider block">
                            ● Online
                          </span>
                          {chatTarget.role && (
                            <>
                              <span className="text-[9px] text-slate-500 font-mono">•</span>
                              <span className="text-[8px] px-1 bg-slate-800 text-slate-300 font-mono rounded uppercase tracking-wider block">
                                {chatTarget.role}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : activeThreadId && !chatTarget ? (
                    // Load active thread custom info if chatTarget is not set yet (e.g. general support thread selected)
                    (() => {
                      const thObj = allUnifiedThreads.find(v => v.id === activeThreadId);
                      if (!thObj) return null;
                      return (
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 border border-slate-700">
                            {thObj.avatarInitials}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs md:text-sm font-black tracking-tight block truncate max-w-[160px]">
                              {thObj.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[8px] px-1 bg-slate-800 text-slate-300 font-mono rounded uppercase tracking-wider block">
                                {thObj.role}
                              </span>
                              {thObj.orderId && (
                                <span className="text-[8px] px-1 bg-emerald-950 text-emerald-400 border border-emerald-800/50 font-mono rounded tracking-tight block">
                                  Order #{thObj.orderId}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    // Default inbox list header
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                        <MessageSquare className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="text-xs md:text-sm font-bold tracking-tight block">Choosify Messenger</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Connect instantly with Partners</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Top action controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Mark All Read button (only on All Inbox list mode) */}
                  {!activeThreadId && (
                    <button
                      onClick={handleMarkAllAsReadUnified}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-800 text-[10px] font-black uppercase text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer inline-flex items-center gap-1 shrink-0"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-orange-400" />
                      <span className="hidden sm:inline">Mark All Read</span>
                    </button>
                  )}

                  {/* Always Visible Close Button (Primary Requirement) */}
                  <button
                    onClick={closeMessenger}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    title="Close messenger modal"
                  >
                    <X className="w-5.5 h-5.5" />
                  </button>
                </div>
              </div>

              {/* MESSENGER WINDOW BODY CONTAINER */}
              <div id="FloatingMessageContainer" className="flex-1 overflow-hidden flex flex-col bg-slate-50 min-h-0 FloatingMessageContainer">
                {isAccessBlocked ? (
                  // Banned / Access restricted error view
                  <div className="my-auto text-center px-6 py-10">
                    <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-3">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                      Access Restricted
                    </span>
                    <p className="text-[11px] text-slate-500 leading-normal mt-1 max-w-xs mx-auto">
                      {blockReason}
                    </p>
                    <button
                      onClick={closeMessenger}
                      className="mt-4 px-4 py-2 bg-[#0B1528] text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Dismiss & Close
                    </button>
                  </div>
                ) : !activeThreadId ? (
                  
                  // CONVERSATION LIST VIEW inside Messenger Popup
                  <div className="flex-1 flex flex-col min-h-0">
                    
                    {/* SEARCH PANEL at top */}
                    <div className="p-4 bg-white border-b border-slate-100 shrink-0">
                       <div className="relative">
                         <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                         <input
                           type="text"
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           placeholder="Search order #, seller, brand, client name..."
                           className="w-full pl-9.5 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500/40 focus:bg-white transition-all font-medium"
                         />
                       </div>
                    </div>

                    {/* CONVERSATION LIST BODY */}
                    <div id="ConversationList" className="flex-1 overflow-y-auto p-2.5 space-y-1.5 ConversationList custom-scrollbar scroll-smooth">
                      {filteredThreads.length === 0 ? (
                        <div className="text-center py-12 px-4 space-y-3">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                            <MessageSquare className="w-5 h-5 opacity-40" />
                          </div>
                          <p className="text-xs font-black text-slate-700 uppercase tracking-widest">No conversations</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">None of your chats or support inquiries matched search keyword "{searchTerm}"</p>
                        </div>
                      ) : (
                        filteredThreads.map((thread) => {
                          return (
                            <div
                              key={thread.id}
                              onClick={() => {
                                if (thread.type === 'profile' && thread.target) {
                                  triggerMessage(thread.target);
                                } else {
                                  setActiveThreadId(thread.id);
                                }
                              }}
                              className={`p-3 rounded-2xl cursor-pointer transition-all border flex gap-3 relative justify-between items-center ${
                                thread.unread 
                                  ? 'bg-[#F97316]/5 border-orange-500/10 hover:bg-[#F97316]/10' 
                                  : 'bg-white hover:bg-slate-100 border-slate-100/80 shadow-xs'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="relative shrink-0">
                                  {thread.avatarUrl ? (
                                    <img
                                      src={thread.avatarUrl}
                                      alt={thread.name}
                                      className="w-10 h-10 rounded-full border border-slate-200/80 object-cover bg-slate-100"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-200/80 font-black flex items-center justify-center text-xs uppercase">
                                      {thread.avatarInitials}
                                    </div>
                                  )}
                                  {thread.unread && (
                                    <span id="NotificationBadge" className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#F97316] rounded-full border-2 border-white animate-pulse NotificationBadge" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <h4 className="text-[11.5px] font-black text-slate-800 truncate leading-tight block">
                                      {highlightMatchedText(thread.name, searchTerm)}
                                    </h4>
                                    <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap block shrink-0">{thread.time}</span>
                                  </div>
                                  
                                  {/* Sub-Context Labels: Order Number / Brand / Seller Name */}
                                  <div className="flex items-center gap-1 flex-wrap mt-1">
                                    {thread.orderId && (
                                      <span className="text-[8px] bg-emerald-50 text-emerald-600 font-mono font-bold border border-emerald-100 rounded px-1 lowercase tracking-tight block shrink-0">
                                        order #{highlightMatchedText(thread.orderId, searchTerm)}
                                      </span>
                                    )}
                                    {thread.brandName && (
                                      <span className="text-[8px] bg-slate-100 text-slate-500 border border-slate-200/50 rounded px-1 font-mono tracking-tight block shrink-0">
                                        brand: {highlightMatchedText(thread.brandName, searchTerm)}
                                      </span>
                                    )}
                                    {thread.sellerName && (
                                      <span className="text-[8px] bg-orange-50 text-orange-600 border border-orange-100/55 rounded px-1 font-mono tracking-tight block shrink-0">
                                        seller: {highlightMatchedText(thread.sellerName, searchTerm)}
                                      </span>
                                    )}
                                    {!thread.orderId && !thread.brandName && !thread.sellerName && (
                                      <span className="text-[8px] bg-slate-50 text-slate-400 border border-slate-100 rounded px-1 tracking-tight font-sans block shrink-0 font-medium capitalize">
                                        {thread.role}
                                      </span>
                                    )}
                                  </div>

                                  <p className={`text-[10px] mt-1.5 leading-normal ${thread.unread ? 'text-slate-800 font-semibold' : 'text-slate-400'} truncate block`}>
                                    {highlightMatchedText(thread.preview, searchTerm)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  
                  // ACTIVE CONVERSATION MESSAGES CHAT WINDOW
                  <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col custom-scrollbar scroll-smooth">
                      {currentMessagesUnified.length === 0 ? (
                        <div className="my-auto text-center px-6 py-8">
                          <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 border border-orange-100/50">
                            <MessageSquare className="w-5 h-5 animate-bounce" />
                          </div>
                          <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                            Choosify Trust-Line Init
                          </span>
                          <p className="text-[11.5px] text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                            Start chatting with <strong className="text-slate-900 font-bold">{chatTarget?.name || 'Partner'}</strong> instantly. Direct context metatags are bound to your account.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3.5 flex flex-col justify-end">
                          {currentMessagesUnified.map((msg: any) => {
                            // Direct profile has sender 'me' / 'them', Orders message has senderRole 'customer'/'seller'/'admin'
                            const isMe = msg.sender === 'me' || (msg.senderRole && msg.senderRole !== 'customer' && profile?.role !== 'customer') || (msg.senderRole === 'customer' && profile?.role === 'customer');
                            const timeStr = msg.timestamp ? (msg.timestamp.includes('T') ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : msg.timestamp) : 'recent';
                            
                            return (
                              <div
                                key={msg.id}
                                className={`flex flex-col max-w-[80%] ${
                                  isMe ? 'self-end items-end' : 'self-start items-start'
                                }`}
                              >
                                {msg.senderName && !isMe && (
                                  <span className="text-[8px] text-slate-400 mb-0.5 ml-1 font-extrabold uppercase tracking-wide">
                                    {msg.senderName}
                                  </span>
                                )}
                                <div
                                  className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                                    isMe
                                      ? 'bg-[#F97316] text-white rounded-br-none shadow-sm shadow-orange-500/10'
                                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-xs'
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                </div>
                                <span className="text-[8px] font-mono text-slate-400 mt-1 uppercase tracking-wider">
                                  {timeStr}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Chat Input Footer Bar */}
                    <form
                      onSubmit={handleSendMessageUnified}
                      className="bg-white border-t border-slate-100 p-3.5 flex gap-2 shrink-0 items-center justify-between"
                    >
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 min-w-0 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300 transition-colors bg-slate-50"
                      />
                      <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="p-2.5 bg-[#F97316] text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                        title="Send message"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ContactInteractionContext.Provider>
  );
};
