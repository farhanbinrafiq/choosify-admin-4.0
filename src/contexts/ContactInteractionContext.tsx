import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, MessageSquare, Send, X, Check, Loader2, Info, AlertTriangle } from 'lucide-react';
import { useAuth } from './AuthContext';

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
  };
}

interface ContactInteractionContextType {
  triggerPhone: (target: ContactTarget) => void;
  triggerMessage: (target: ContactTarget) => void;
  openChatWith: (target: ContactTarget) => void;
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

  // Chat Modal State
  const [chatTarget, setChatTarget] = useState<ContactTarget | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [threads, setThreads] = useState<Record<string, ChatThread>>(() => {
    const saved = localStorage.getItem('choosify_chat_threads');
    return saved ? JSON.parse(saved) : {};
  });
  const [isAccessBlocked, setIsAccessBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Save threads to localStorage when they change
  useEffect(() => {
    localStorage.setItem('choosify_chat_threads', JSON.stringify(threads));
  }, [threads]);

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

  // Global message action click (opens modal)
  const triggerMessage = (target: ContactTarget) => {
    // Check credentials & authentication status
    if (!profile) {
      setIsAccessBlocked(true);
      setBlockReason('You must be logged in to send a message.');
      setChatTarget(target);
      setIsChatOpen(true);
      return;
    }

    // Access control check: target.status cannot be 'Banned'
    if (target.status === 'Banned') {
      setIsAccessBlocked(true);
      setBlockReason('You cannot contact this user. This profile has been restricted or banned.');
      setChatTarget(target);
      setIsChatOpen(true);
      return;
    }

    // Is current profile blocked or restricted?
    // Let's assume standard allowed if active
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
          entity_id: target.id
        }
      };
      setThreads(prev => ({
        ...prev,
        [target.id]: initialThread
      }));
    }

    setChatTarget(target);
    setIsChatOpen(true);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !chatTarget) return;

    const messageText = inputText.trim();
    const targetId = chatTarget.id;

    const newMsg: ChatMessage = {
      id: Math.random().toString(),
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sender: 'me'
    };

    // Update messages thread
    setThreads(prev => {
      const currentThread = prev[targetId] || {
        targetId,
        messages: [],
        metadata: {
          context_type: 'profile_message',
          source: 'buyer_profile',
          entity_id: targetId
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

    // Fast asynchronous reply simulation (200ms - 800ms) to make it feel super-responsive and alive!
    setTimeout(() => {
      const automaticReplies = [
        `Thanks for reaching out! Let's arrange a call to discuss.`,
        `Received. I am checking the specs. Will get back shortly!`,
        `Perfect, let's keep in touch here. ${chatTarget.name} is available.`,
        `Got it! Let's coordinate our Choosify requirements.`
      ];
      const randomReply = automaticReplies[Math.floor(Math.random() * automaticReplies.length)];

      const replyMsg: ChatMessage = {
        id: Math.random().toString(),
        text: replyMsgTextSelector(messageText, randomReply, chatTarget.name),
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
            messages: [...currentThread.messages, replyMsg]
          }
        };
      });
    }, 800);
  };

  const replyMsgTextSelector = (userText: string, defaultReply: string, targetName: string) => {
    const lText = userText.toLowerCase();
    if (lText.includes('hello') || lText.includes('hi') || lText.includes('hey')) {
      return `Hello! This is ${targetName}. Good to connect with you. How can I help you today?`;
    }
    if (lText.includes('price') || lText.includes('cost') || lText.includes('expensive')) {
      return `We aim to offer top-tier value on Choosify! Let me share the official deal sheet with you shortly.`;
    }
    return defaultReply;
  };

  const currentMessages = chatTarget ? (threads[chatTarget.id]?.messages || []) : [];

  return (
    <ContactInteractionContext.Provider value={{ triggerPhone, triggerMessage, openChatWith: triggerMessage }}>
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

      {/* GLOBAL CHAT MODAL OVERLAY */}
      <AnimatePresence>
        {isChatOpen && chatTarget && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col ${
                // Mobile: Full screen modal, Desktop: 420px width, 600px height
                'w-full max-w-full h-full md:w-[420px] md:h-[600px] md:max-h-[85vh] md:rounded-2xl'
              }`}
            >
              {/* CHAT HEADER */}
              <div className="bg-[#0B1528] text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={chatTarget.avatarUrl}
                      alt={chatTarget.name}
                      className="w-10 h-10 rounded-full border border-slate-700 object-cover bg-slate-900"
                    />
                    {chatTarget.online !== false && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0B1528] rounded-full" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-black tracking-tight block truncate max-w-[180px]">
                      {chatTarget.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-mono text-emerald-400 font-black uppercase tracking-wider block">
                        ● Online
                      </span>
                      {chatTarget.role && (
                        <>
                          <span className="text-[9px] text-slate-500 font-mono">•</span>
                          <span className="text-[8px] px-1 bg-slate-800 text-slate-300 font-mono rounded uppercase tracking-wider">
                            {chatTarget.role}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setIsChatOpen(false);
                    setChatTarget(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close conversation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* CHAT BODY */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col min-h-0">
                {isAccessBlocked ? (
                  // Banned / Access restricted error view
                  <div className="my-auto text-center px-6">
                    <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-3">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                      Access Denied
                    </span>
                    <p className="text-[11px] text-slate-500 leading-normal mt-1 max-w-xs mx-auto">
                      {blockReason}
                    </p>
                    <button
                      onClick={() => {
                        setIsChatOpen(false);
                        setChatTarget(null);
                      }}
                      className="mt-4 px-4 py-2 bg-[#0B1528] text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Bypass & Close
                    </button>
                  </div>
                ) : currentMessages.length === 0 ? (
                  // Empty state
                  <div className="my-auto text-center px-4 py-6">
                    <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 border border-orange-100/50">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                      Choosify Trust-Line Init
                    </span>
                    <p className="text-[11.5px] text-slate-600 mt-1">
                      Start your conversation with <strong className="text-slate-900 font-black">{chatTarget.name}</strong>
                    </p>
                    <div className="mt-4 p-3 bg-white/70 border border-slate-200/50 rounded-xl text-left">
                      <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest block font-bold">
                        Attached Context Metatag
                      </span>
                      <pre className="text-[9px] font-mono text-orange-600 bg-orange-50/50 p-2 rounded border border-orange-100/30 overflow-x-auto mt-1 leading-normal">
{`{
  "context_type": "profile_message",
  "source": "buyer_profile",
  "entity_id": "${chatTarget.id}"
}`}
                      </pre>
                    </div>
                  </div>
                ) : (
                  // Message list thread
                  <div className="space-y-3.5 flex flex-col">
                    {currentMessages.map((msg) => {
                      const isMe = msg.sender === 'me';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[80%] ${
                            isMe ? 'self-end items-end' : 'self-start items-start'
                          }`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                              isMe
                                ? 'bg-[#F97316] text-white rounded-br-none'
                                : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          <span className="text-[8.5px] font-mono text-slate-400 mt-1 uppercase tracking-wider">
                            {msg.timestamp}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CHAT INPUT BAR */}
              {!isAccessBlocked && (
                <form
                  onSubmit={handleSendMessage}
                  className="bg-white border-t border-slate-100 p-3.5 flex gap-2 shrink-0 items-center justify-between"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Message ${chatTarget.name}...`}
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
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ContactInteractionContext.Provider>
  );
};
