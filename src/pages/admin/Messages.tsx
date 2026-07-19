import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Send, 
  Phone, 
  Mail, 
  User, 
  MessageCircle, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle, 
  Activity, 
  RefreshCw, 
  ArrowRight, 
  ChevronRight, 
  Camera, 
  Paperclip, 
  Trash2, 
  UserCheck, 
  Hash, 
  Radio, 
  Info,
  ExternalLink,
  ShieldAlert,
  Sliders,
  Maximize2,
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Plus,
  FileText,
  ChevronLeft,
  MapPin,
  Printer
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOrders, MessageThread, ThreadMessage, Order } from "../../contexts/OrdersContext";
import { UnifiedMessage, Conversation, Agent, Customer as TypesCustomer } from "../../types";
import { io, Socket } from "socket.io-client";
import { SplitLayout } from "../../components/Layout/SplitLayout";

// Platform definitions with branding colors
interface PlatformBranding {
  name: string;
  color: string;
  bgHex: string;
  iconColor: string;
  logoColorClass: string;
}

const PLATFORMS: Record<string, PlatformBranding> = {
  whatsapp: { 
    name: "WhatsApp", 
    color: "from-emerald-500 to-green-600", 
    bgHex: "#25D366", 
    iconColor: "text-emerald-500",
    logoColorClass: "bg-emerald-500" 
  },
  messenger: { 
    name: "Messenger", 
    color: "from-blue-500 to-indigo-600", 
    bgHex: "#0084FF", 
    iconColor: "text-blue-500",
    logoColorClass: "bg-blue-500" 
  },
  instagram: { 
    name: "Instagram", 
    color: "from-pink-500 via-purple-600 to-orange-500", 
    bgHex: "#E1306C", 
    iconColor: "text-pink-500",
    logoColorClass: "bg-pink-500" 
  }
};

// Helper to format timestamps gracefully
function formatElapsedTime(timestampStr: string) {
  try {
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) return timestampStr;
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch (e) {
    return timestampStr;
  }
}

export default function MessagesPage() {
  const { profile } = useAuth();
  const messagesCustomerPanes = [
    { size: 340, minSize: 260, maxSize: 450 }, // Left sidebar channels
    { size: 600, minSize: 400, maxSize: 1000 }, // Center chat area
    { size: 340, minSize: 280, maxSize: 450 }  // Right context actions
  ];
  const messagesPlatformPanes = [
    { size: 340, minSize: 260, maxSize: 450 }, // Left sidebar threads
    { size: 600, minSize: 400, maxSize: 1000 }, // Center chat area
    { size: 340, minSize: 280, maxSize: 450 }  // Right context actions
  ];
  const { 
    orders, 
    messageThreads, 
    approveOrder, 
    declineOrder, 
    dispatchOrder, 
    addCustomerNotes, 
    addSellerNotes,
    updateOrderStatus,
    sendChatMessage,
    createManualOrder,
    markAllThreadsAsRead,
    markThreadAsRead
  } = useOrders();

  // Primary inbox division
  const [activeInboxType, setActiveInboxType] = useState<"customer" | "platform">("platform");

  // Meta Conversations & Messages states (Firestore)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  
  const [activePlatform, setActivePlatform] = useState<"whatsapp" | "messenger" | "instagram">("whatsapp");
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "pending" | "resolved">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [replyText, setReplyText] = useState("");
  const [customMediaUrl, setCustomMediaUrl] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingAgent, setTypingAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [messagingStatus, setMessagingStatus] = useState<{
    mode: string;
    channels: Record<string, string>;
  } | null>(null);
  
  // Platform Support system state (Sync Threads)
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [platformSearchTerm, setPlatformSearchTerm] = useState("");
  const [platformReplyText, setPlatformReplyText] = useState("");

  // WhatsApp Warning states
  const [whatsappWarning, setWhatsappWarning] = useState<string | null>(null);

  // Simulation controls state
  const [simSenderPhone, setSimSenderPhone] = useState("+8801700112233");
  const [simSenderName, setSimSenderName] = useState("Kazi Shohel");
  const [simMessageBody, setSimMessageBody] = useState("Assalamu alaikum. Can I get an update on order CSS-9921? Also I need to buy an Aarong Silk Panjabi.");
  const [simImageUrl, setSimImageUrl] = useState("");
  const [simMsgType, setSimMsgType] = useState<"text" | "image">("text");
  const [simProcessing, setSimProcessing] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Interactive View Order details modal
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

  // Live sidebar input controlled states
  const [localPrivateNote, setLocalPrivateNote] = useState("");
  const [localCustomerNote, setLocalCustomerNote] = useState("");
  const [courierField, setCourierField] = useState("Pathao Courier Service");
  const [trackingIdField, setTrackingIdField] = useState("");

  // Quick Action form prompts
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [tempDeliveryCharge, setTempDeliveryCharge] = useState(120);
  const [tempSellerNote, setTempSellerNote] = useState("");
  
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [tempDeclineReason, setTempDeclineReason] = useState("");

  // Manual Order Wizard States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSuccessOrderInfo, setManualSuccessOrderInfo] = useState<{ orderId: string; invoiceId: string } | null>(null);
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerEmail, setManualCustomerEmail] = useState("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState("");
  const [manualCustomerAddress, setManualCustomerAddress] = useState("");
  const [manualPlatformSource, setManualPlatformSource] = useState<'WhatsApp' | 'Facebook' | 'Instagram' | 'Offline'>("WhatsApp");
  const [manualChatRefId, setManualChatRefId] = useState("");
  const [manualProductSelection, setManualProductSelection] = useState("101"); // default Aarong Silk Panjabi
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualPriceOverride, setManualPriceOverride] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [tempDeliveryPartner, setTempDeliveryPartner] = useState("Pathao Courier");
  const [tempTrackingUrl, setTempTrackingUrl] = useState("");

  const [newInternalNote, setNewInternalNote] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const platformMessagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // -------------------------------------------------------------
  // DYNAMIC COMMERCE UTILITIES: Sourcing mentions and auto-linking
  // -------------------------------------------------------------
  const detectProductsAndOrdersInText = (text: string) => {
    const lowercase = text.toLowerCase();
    
    // 1. Detect Order ID
    const orderIdMatch = text.match(/CSS-\d{4}/i);
    let linkedOrder: Order | undefined = undefined;
    if (orderIdMatch) {
      const orderId = orderIdMatch[0].toUpperCase();
      linkedOrder = orders.find(o => o.id === orderId);
    }

    // 2. Detect Product Mentions
    let linkedProduct: any = null;
    if (lowercase.includes("apex") || lowercase.includes("leather") || lowercase.includes("shoes") || lowercase.includes("formal")) {
      linkedProduct = { id: '102', name: 'Apex Mens Formal Leather', brand: 'Apex', price: 3500, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', sku: 'SKU-APX-9812' };
    } else if (lowercase.includes("aarong") || lowercase.includes("silk") || lowercase.includes("panjabi")) {
      linkedProduct = { id: '101', name: 'Aarong Silk Panjabi', brand: 'Aarong', price: 4200, image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80', sku: 'SKU-AAR-2391' };
    } else if (lowercase.includes("samsung") || lowercase.includes("s25") || lowercase.includes("ultra") || lowercase.includes("phone")) {
      linkedProduct = { id: '103', name: 'Samsung S25 Ultra', brand: 'Samsung BD', price: 139999, image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80', sku: 'SKU-SAM-0012' };
    } else if (lowercase.includes("walton") || lowercase.includes("fridge") || lowercase.includes("refrigerator") || lowercase.includes("cooling")) {
      linkedProduct = { id: '104', name: 'Walton 2-Door Fridge', brand: 'Walton', price: 29990, image: 'https://images.unsplash.com/photo-1571175432247-fe0320b5da22?w=400&q=80', sku: 'SKU-WAL-7711' };
    }

    // Fallbacks
    if (linkedOrder && !linkedProduct) {
      linkedProduct = { ...linkedOrder.product, sku: `SKU-${linkedOrder.product.brand.substring(0,3).toUpperCase()}-${linkedOrder.product.id}` };
    }
    if (linkedProduct && !linkedOrder) {
      linkedOrder = orders.find(o => o.product.name.toLowerCase().includes(linkedProduct.name.toLowerCase()));
    }

    return { linkedOrder, linkedProduct };
  };

  // Get current active thread/conv commerce states
  const getActiveConversationCommerce = () => {
    if (activeInboxType === "customer") {
      // Walk messages to find any mentions
      for (const m of [...messages].reverse()) {
        const res = detectProductsAndOrdersInText(m.content.body);
        if (res.linkedProduct || res.linkedOrder) {
          return res;
        }
      }
    } else {
      const activeTh = messageThreads.find(t => t.id === selectedThreadId);
      if (activeTh) {
        const orderOfThread = orders.find(o => o.id === activeTh.orderId);
        return {
          linkedOrder: orderOfThread,
          linkedProduct: activeTh.product ? { ...activeTh.product, sku: `SKU-${activeTh.product.brand.substring(0,3).toUpperCase()}-${activeTh.product.id}` } : undefined
        };
      }
    }
    return { linkedOrder: undefined, linkedProduct: undefined };
  };

  const currentCommerce = getActiveConversationCommerce();

  const handleSubmitManualOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCustomerName || !manualCustomerPhone || !manualCustomerAddress) {
      alert("Please fill in Customer Name, Customer Phone, and Customer Address!");
      return;
    }

    const catalog = [
      { id: '101', name: 'Aarong Silk Panjabi', brand: 'Aarong', price: 4200, image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80', sellerId: 'seller_001', sellerName: 'Aarong Digital' },
      { id: '102', name: 'Apex Mens Formal Leather', brand: 'Apex', price: 3500, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', sellerId: 'seller_001', sellerName: 'Apex Shoes' },
      { id: '103', name: 'Samsung S25 Ultra', brand: 'Samsung BD', price: 139999, image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80', sellerId: 'seller_002', sellerName: 'TechZone BD' },
      { id: '104', name: 'Walton 2-Door Fridge', brand: 'Walton', price: 29990, image: 'https://images.unsplash.com/photo-1571175432247-fe0320b5da22?w=400&q=80', sellerId: 'seller_002', sellerName: 'ElectroBD' },
    ];

    const selectedProd = catalog.find(p => p.id === manualProductSelection) || catalog[0];
    const rawOverrideValue = manualPriceOverride ? parseFloat(manualPriceOverride) : undefined;

    createManualOrder({
      customerName: manualCustomerName,
      customerEmail: manualCustomerEmail || `${manualCustomerName.toLowerCase().replace(/\s+/g, '')}@sourced.com`,
      customerPhone: manualCustomerPhone,
      customerAddress: manualCustomerAddress,
      platformSource: manualPlatformSource,
      chatRefId: manualChatRefId || undefined,
      product: selectedProd,
      quantity: manualQuantity || 1,
      priceOverride: rawOverrideValue && !isNaN(rawOverrideValue) ? rawOverrideValue : undefined,
      notes: manualNotes || undefined
    });

    const generatedOrderId = 'CSS-' + Math.floor(1000 + Math.random() * 9000);
    const generatedInvoiceId = 'INV-' + Math.floor(100000 + Math.random() * 900000);
    setManualSuccessOrderInfo({ orderId: generatedOrderId, invoiceId: generatedInvoiceId });
  };

  const handleResetManualForm = () => {
    setManualCustomerName("");
    setManualCustomerEmail("");
    setManualCustomerPhone("");
    setManualCustomerAddress("");
    setManualPlatformSource("WhatsApp");
    setManualChatRefId("");
    setManualProductSelection("101");
    setManualQuantity(1);
    setManualPriceOverride("");
    setManualNotes("");
    setManualSuccessOrderInfo(null);
    setIsManualModalOpen(false);
  };

  // Initialize socket.io & fetch first batches
  useEffect(() => {
    const socketUrl = `${window.location.protocol}//${window.location.host}`;
    console.log("[Socket.io-Meta] Connecting to target host:", socketUrl);
    
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket.io-Meta] Client established connection to messaging hub.");
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("connect_error", () => {
      setSocketConnected(false);
    });

    socket.on("message:received", (msg: UnifiedMessage) => {
      console.log("[Socket.io-Meta] Received realtime message payload.", msg);
      if (msg.conversationId === selectedConvId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
      fetchConversations(false);
    });

    socket.on("conversation:updated", (conv: Conversation) => {
      setConversations(prev => {
        const index = prev.findIndex(item => item.conversationId === conv.conversationId);
        if (index === -1) return [conv, ...prev];
        const updated = [...prev];
        updated[index] = conv;
        return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    });

    socket.on("typing:start", ({ agentName }) => {
      setTypingAgent(agentName);
      setIsTyping(true);
    });

    socket.on("typing:stop", () => {
      setIsTyping(false);
      setTypingAgent(null);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      setSocketConnected(false);
    };
  }, [selectedConvId]);

  // Bootstraps
  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      await fetchConversations(true);
      await fetchAgents();
      setLoading(false);
    };
    bootstrap();
  }, []);

  useEffect(() => {
    fetch('/api/messaging/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMessagingStatus({ mode: data.mode, channels: data.channels });
      })
      .catch(() => undefined);
  }, []);

  // When active platform changes, load corresponding conversations
  useEffect(() => {
    const matched = conversations.filter(c => c.platform === activePlatform);
    if (matched.length > 0) {
      setSelectedConvId(matched[0].conversationId);
    } else {
      setSelectedConvId("");
    }
  }, [activePlatform]);

  // When conversation changes, get history
  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      if (socketRef.current) {
        socketRef.current.emit("join:conversation", selectedConvId);
      }
    } else {
      setMessages([]);
    }
  }, [selectedConvId]);

  // Auto select first platform thread on swap
  useEffect(() => {
    if (activeInboxType === "platform") {
      if (messageThreads.length > 0 && !selectedThreadId) {
        setSelectedThreadId(messageThreads[0].id);
        markThreadAsRead(messageThreads[0].id);
      }
      scrollPlatformThreadToBottom();
    }
  }, [activeInboxType, messageThreads]);

  useEffect(() => {
    if (selectedThreadId) {
      markThreadAsRead(selectedThreadId);
      scrollPlatformThreadToBottom();
    }
  }, [selectedThreadId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const scrollPlatformThreadToBottom = () => {
    setTimeout(() => {
      platformMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const fetchConversations = async (selectFirst = false) => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Could not download Firestore index threads.");
      const list: Conversation[] = await res.json();
      setConversations(list);
      
      if (selectFirst && list.length > 0) {
        const matched = list.filter(c => c.platform === activePlatform);
        if (matched.length > 0) {
          setSelectedConvId(matched[0].conversationId);
        } else {
          setSelectedConvId(list[0].conversationId);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/messages/${conversationId}`);
      if (!res.ok) throw new Error("Could not pull conversation messages logs");
      const list: UnifiedMessage[] = await res.json();
      setMessages(list);

      // Verify WhatsApp 24-hour limits
      const activeConv = conversations.find(c => c.conversationId === conversationId);
      if (activeConv && activeConv.platform === "whatsapp") {
        const lastInbound = [...list].reverse().find(m => m.direction === "inbound");
        if (lastInbound) {
          const hours = (Date.now() - new Date(lastInbound.timestamp).getTime()) / (1000 * 60 * 60);
          if (hours > 24) {
            setWhatsappWarning("⚠️ Warning: Outbound messaging window (24h) expired. Native Meta templates recommended.");
          } else {
            setWhatsappWarning(null);
          }
        } else {
          setWhatsappWarning(null);
        }
      } else {
        setWhatsappWarning(null);
      }

      scrollToBottom();
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const list = await res.json();
        setAgents(list);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Poll REST messaging endpoints when Socket.IO is unavailable (e.g. Vercel serverless)
  // or always in production builds where persistent sockets are unreliable.
  useEffect(() => {
    const shouldPoll = import.meta.env.PROD || !socketConnected;
    if (!shouldPoll) return;

    const POLL_MS = 7_000;
    const tick = () => {
      void fetchConversations(false);
      if (selectedConvId) {
        void fetchMessages(selectedConvId);
      }
    };

    const intervalId = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [socketConnected, selectedConvId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() && !customMediaUrl.trim()) return;

    const currentConv = conversations.find(c => c.conversationId === selectedConvId);
    if (!currentConv) return;

    const payload = {
      conversationId: selectedConvId,
      content: {
        type: customMediaUrl ? "image" : "text",
        body: replyText,
        mediaUrl: customMediaUrl || undefined
      },
      senderId: profile?.id || "agent_farhan",
      senderName: profile?.name || "Kazi Farhan (Supervisor)"
    };

    // Optimistic payload injection
    const optimisticMessage: UnifiedMessage = {
      id: `m_opt_${Date.now()}`,
      platform: currentConv.platform,
      platformMessageId: `mid.opt_${Date.now()}`,
      conversationId: selectedConvId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      content: {
        type: customMediaUrl ? "image" : "text",
        body: replyText,
        mediaUrl: customMediaUrl || undefined
      },
      direction: "outbound",
      status: "sent",
      timestamp: new Date().toISOString()
    } as any;

    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();
    setReplyText("");
    setCustomMediaUrl("");

    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Outbound gateway rejected dispatch");
      const result = await response.json();
      
      if (result.whatsapp24HourWarning) {
        setWhatsappWarning(result.whatsapp24HourWarning);
      } else {
        setWhatsappWarning(null);
      }

      fetchConversations(false);
      fetchMessages(selectedConvId);
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message);
    }
  };

  const handleUpdateStatus = async (status: "open" | "pending" | "resolved") => {
    try {
      const res = await fetch("/api/conversation/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConvId, status })
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.conversationId === selectedConvId ? { ...c, status } : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    try {
      const res = await fetch("/api/conversation/assign-agent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConvId, agentId })
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.conversationId === selectedConvId ? { ...c, assignedAgent: agentId } : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dispatch Meta Simulation
  const executeSimulation = async () => {
    setSimProcessing(true);
    setSimResult(null);

    let webhookPayload: any = {
      object: activePlatform === "whatsapp" ? "whatsapp_business_account" : 
              activePlatform === "messenger" ? "page" : "instagram",
      entry: []
    };

    const cleanPhone = simSenderPhone.replace(/\+/g, "");

    if (activePlatform === "whatsapp") {
      webhookPayload.entry = [{
        id: "meta_wa_acc_101",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "16505551111", phone_number_id: "123456789" },
            contacts: [{ profile: { name: simSenderName }, wa_id: cleanPhone }],
            messages: [{
              from: cleanPhone,
              id: `wam_msg_sim_${Date.now()}`,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              type: simMsgType,
              text: simMsgType === "text" ? { body: simMessageBody } : undefined,
              image: simMsgType === "image" ? { url: simImageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400" } : undefined
            }]
          }
        }]
      }];
    } else {
      webhookPayload.entry = [{
        id: activePlatform === "messenger" ? "fb_page_id_101" : "ig_business_id_101",
        time: Date.now(),
        messaging: [{
          sender: { id: `sim_sender_${cleanPhone}` },
          recipient: { id: "my_brand_recipient_id" },
          timestamp: Date.now(),
          message: {
            mid: `sim_mid_token_${Date.now()}`,
            text: simMsgType === "text" ? simMessageBody : undefined,
            attachments: simMsgType === "image" ? [{
              type: "image",
              payload: { url: simImageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400" }
            }] : undefined
          }
        }]
      }];
    }

    try {
      const response = await fetch("/api/webhooks/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload)
      });
      const resJson = await response.json();
      setSimResult({
        statusCode: response.status,
        responsePayload: resJson,
        submittedPayload: webhookPayload
      });

      setSimMessageBody("");
      setSimImageUrl("");

      setTimeout(() => {
        fetchConversations(false);
        if (selectedConvId) {
          fetchMessages(selectedConvId);
        }
      }, 500);

    } catch (err: any) {
      console.error(err);
      setSimResult({ error: err.message });
    } finally {
      setSimProcessing(false);
    }
  };

  const handleSendPlatformReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!platformReplyText.trim()) return;

    sendChatMessage(selectedThreadId, platformReplyText, "admin", profile?.name || "Kazi Farhan (Admin)");
    setPlatformReplyText("");
    scrollPlatformThreadToBottom();
  };

  // -------------------------------------------------------------
  // ORDERS PORTFOLIO MANIPULATORS
  // -------------------------------------------------------------
  const triggerApproveOrder = (orderId: string) => {
    approveOrder(orderId, tempDeliveryCharge, tempSellerNote || undefined);
    setShowApproveForm(false);
    setTempSellerNote("");
  };

  const triggerDeclineOrder = (orderId: string) => {
    declineOrder(orderId, tempDeclineReason || "Product temporarily out of stock.");
    setShowDeclineForm(false);
    setTempDeclineReason("");
  };

  const triggerDispatchOrder = (orderId: string) => {
    dispatchOrder(orderId, tempDeliveryPartner, tempTrackingUrl || `https://pathao.com/track/${orderId}`);
    setShowDispatchForm(false);
  };

  const triggerAddInternalNote = (orderId: string) => {
    if (!newInternalNote.trim()) return;
    addCustomerNotes(orderId, newInternalNote.trim());
    setNewInternalNote("");
  };

  // -------------------------------------------------------------
  // FILTERINGS & ENHANCEMENTS
  // -------------------------------------------------------------
  const filteredConversations = conversations.filter(c => {
    // Keep internal-ERP system platform messages out!
    if (c.platform === "platform") return false;
    if (c.platform !== activePlatform) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const inName = c.senderName.toLowerCase().includes(term);
      const inMsg = c.lastMessage?.toLowerCase().includes(term) || false;
      if (!inName && !inMsg) return false;
    }
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  const getTabBadgeCount = (platform: "whatsapp" | "messenger" | "instagram") => {
    return conversations.filter(c => c.platform === platform && c.status === "open").length;
  };

  const getUnreadPlatformCount = () => {
    return messageThreads.filter(t => t.messages.some(m => m.senderRole === "customer")).length;
  };

  const filteredPlatformThreads = messageThreads.filter(t => {
    if (platformSearchTerm) {
      const term = platformSearchTerm.toLowerCase();
      return (
        t.customer.name.toLowerCase().includes(term) ||
        t.subject.toLowerCase().includes(term) ||
        t.preview.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const selectedConv = conversations.find(c => c.conversationId === selectedConvId);
  const selectedThread = messageThreads.find(t => t.id === selectedThreadId);
  const activeAgent = agents.find(a => a.id === selectedConv?.assignedAgent);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-app-card rounded-3xl overflow-hidden border border-app-border">
      
      {/* 1. SEPARATE INBOX SWITCHER TOP BAR */}
      <div className="border-b border-app-border bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 transition-all">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-app-accent/20 rounded-xl">
            <MessageCircle className="w-5 h-5 text-app-accent" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-app-text-primary leading-none">Choosify Workspace</h1>
            <span className="text-[10px] text-app-text-secondary font-bold mt-1 block">Unified Channels Routing Hub</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="px-4 py-2 bg-[#ef3c23] hover:bg-orange-600 text-app-text-primary font-extrabold uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <span>➕ Create Manual Order</span>
          </button>

          <div className="flex bg-app-bg border border-app-border rounded-xl p-1 shrink-0">
            <button
              onClick={() => setActiveInboxType("platform")}
              className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer${
                activeInboxType === "platform"
                  ? "bg-app-accent text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Platform Inbox
              {getUnreadPlatformCount() > 0 && (
                <span className="bg-rose-500 text-white rounded-md px-1.5 py-0.5 text-[8px] font-black animate-pulse leading-none shrink-0 border border-app-border">
                  {getUnreadPlatformCount()}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveInboxType("customer")}
              className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer${
                activeInboxType === "customer"
                  ? "bg-app-accent text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Unified Inbox
              {conversations.filter(c => c.status === "open").length > 0 && (
                <span className="bg-rose-500 text-white rounded-md px-1.5 py-0.5 text-[8px] font-black animate-pulse leading-none shrink-0 border border-app-border">
                  {conversations.filter(c => c.status === "open").length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {messagingStatus && (
        <div
          className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-b shrink-0 ${
            messagingStatus.mode === 'live'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
          }`}
        >
          {messagingStatus.mode === 'live'
            ? 'Live Meta delivery enabled — WhatsApp, Messenger, and Instagram replies go to real customers.'
            : 'Sandbox mode — inbox and simulator work locally. Set MESSAGING_MODE=live and Meta credentials after approval.'}
          {' · '}
          WA: {messagingStatus.channels.whatsapp} · FB: {messagingStatus.channels.messenger} · IG:{' '}
          {messagingStatus.channels.instagram}
        </div>
      )}

      {/* 2. LIVE VIEWWORK PORTALS */}
      {activeInboxType === "customer" ? (
        
        // =============================================================
        // CUSTOMER CHATS METAFRAME DESIGN (ONLY HANDLES WHATSAPP, MESSENGER, INSTAGRAM)
        // =============================================================
        <SplitLayout layoutId="messages-customer-studio" panes={messagesCustomerPanes} className="flex-1 min-h-0 bg-app-bg">
          
          {/* A. LEFT BAR: META PLATFORM CHANNELS */}
          <div className="w-full h-full bg-app-bg border-r border-app-border flex flex-col shrink-0">
            <div className="p-4 border-b border-app-border bg-app-bg/10">
              <div className="grid grid-cols-3 gap-1.5">
                {(["whatsapp", "messenger", "instagram"] as const).map((p) => {
                  const brand = PLATFORMS[p];
                  const isActive = activePlatform === p;
                  const unreadCount = getTabBadgeCount(p);

                  return (
                    <button
                      key={p}
                      onClick={() => setActivePlatform(p)}
                      className={`relative flex flex-col items-center justify-center py-2 rounded-xl transition-all border cursor-pointer ${
                        isActive 
                          ? `bg-gradient-to-br ${brand.color} border-transparent text-white shadow-lg` 
                          : "bg-app-card/30 border-app-border text-slate-500 hover:text-white hover:bg-slate-800/50"
                      }`}
                    >
                      <span className="text-[9px] font-black uppercase tracking-widest leading-none">{brand.name}</span>
                      {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white ring-2 ring-app-bg">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Filtering Controls */}
              <div className="mt-4 space-y-2">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-app-accent transition-colors" />
                  <input 
                    type="text" 
                    placeholder={`Search ${PLATFORMS[activePlatform].name} chats...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-app-card border border-app-border rounded-xl text-xs text-app-text-primary placeholder-slate-500 focus:outline-none focus:border-app-accent/40 transition-all font-medium"
                  />
                </div>

                <div className="flex gap-1.5">
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="w-full bg-app-card text-[9px] text-app-text-secondary font-bold uppercase tracking-wider px-2 py-1.5 border border-app-border rounded-lg focus:outline-none focus:border-app-accent/40"
                  >
                    <option value="all">⚡ All Status</option>
                    <option value="open">🟢 Open / Active</option>
                    <option value="pending">🟡 Pending Response</option>
                    <option value="resolved">⚪ Resolved / Closed</option>
                  </select>
                  
                  <button 
                    onClick={() => fetchConversations(false)} 
                    className="px-2 bg-app-card border border-app-border rounded-lg hover:bg-slate-800 text-app-text-secondary transition-all cursor-pointer"
                    title="Force refresh"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-app-border/40">
              {loading ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono tracking-widest animate-pulse uppercase">
                  Syncing Meta Firestore...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="text-slate-600 text-[10px] uppercase tracking-widest font-black">No Active Leads</div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Fire our Meta Simulator in the right sidebar to construct a new webhook client!
                  </p>
                </div>
              ) : (
                filteredConversations.map((c) => {
                  const isSelected = c.conversationId === selectedConvId;
                  const branding = PLATFORMS[c.platform];
                  const agentAssigned = agents.find(a => a.id === c.assignedAgent);

                  return (
                    <div
                      key={c.conversationId}
                      onClick={() => setSelectedConvId(c.conversationId)}
                      className={`px-4 py-4 cursor-pointer relative transition-all group${
                        isSelected 
                          ? "bg-app-accent/15 border-l-4 border-l-app-accent" 
                          : "hover:bg-slate-800/10"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black bg-indigo-950 border border-app-border text-white shadow-sm uppercase">
                            {c.senderAvatar || c.senderName[0]}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] text-app-text-primary font-bold${branding.logoColorClass}ring-2 ring-app-bg`}>
                            {branding.name[0]}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs font-black text-app-text-primary group-hover:text-app-accent transition-colors truncate">
                              {c.senderName}
                            </h4>
                            <span className="text-[9px] text-slate-500 font-bold ml-1 shrink-0">
                              {new Date(c.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-[10px] text-app-text-secondary mt-1 line-clamp-1 italic text-ellipsis">
                            {c.lastMessage || "No messages..."}
                          </p>

                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-app-border">
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none${
                              c.status === "open" ? "bg-emerald-500/10 text-emerald-400" :
                              c.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                              "bg-slate-500/10 text-slate-400"
                            }`}>
                              ● {c.status}
                            </span>

                            {agentAssigned && (
                              <span className="text-[8px] text-slate-500 font-bold flex items-center gap-1">
                                <UserCheck className="w-2.5 h-2.5 text-app-accent" /> {agentAssigned.name.split(" ")[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* B. CENTER CHAT LOG WITH rich product attachment integrations */}
          <div className="flex-1 flex flex-col bg-app-bg/10 h-full">
            {selectedConv ? (
              <>
                {/* Header info */}
                <div className="h-16 border-b border-app-border px-6 flex items-center justify-between bg-app-bg/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-3.5 h-3.5 rounded-full${PLATFORMS[selectedConv.platform].logoColorClass}`} />
                    <div>
                      <h3 className="text-xs font-black text-app-text-primary tracking-wide uppercase flex items-center gap-2">
                        {selectedConv.senderName} 
                        <span className="text-[9px] bg-app-bg text-app-text-secondary font-bold px-1.5 py-0.5 rounded uppercase">
                          {PLATFORMS[selectedConv.platform].name}
                        </span>
                      </h3>
                      <p className="text-[9px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5 font-mono uppercase">
                        Conversation Id: {selectedConv.conversationId}
                      </p>
                    </div>
                  </div>

                  {activeAgent && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-app-bg border border-app-border rounded-xl">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] text-app-text-primary font-black uppercase tracking-widest">
                        Support Staff: {activeAgent.name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Messages stream */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-app-bg/10">
                  {messages.map((m) => {
                    const isOurAgent = m.direction === "outbound";
                    const branding = PLATFORMS[m.platform] || { name: "Agent" };
                    const parsedCommerce = detectProductsAndOrdersInText(m.content.body);
                    const hasProductMention = !!parsedCommerce.linkedProduct;

                    return (
                      <div key={m.id} className={`flex${isOurAgent ? "justify-end" : "justify-start"}animate-fade-in`}>
                        <div className={`max-w-[75%] rounded-2xl p-4 shadow-md${
                          isOurAgent 
                            ? "bg-app-accent text-white rounded-br-none" 
                            : "bg-app-card border border-app-border text-white rounded-bl-none"
                        }`}>
                          <div className="text-[8px] font-black tracking-widest uppercase mb-1.5 opacity-60 flex items-center justify-between gap-4">
                            <span>{m.senderName}</span>
                            <span>{branding.name}</span>
                          </div>
                          
                          {/* Rich attachment rendering support */}
                          {m.content.type === "image" && m.content.mediaUrl && (
                            <div className="mb-2 rounded-lg overflow-hidden max-h-48 bg-app-card/20 border border-app-border">
                              <img src={m.content.mediaUrl} className="w-full h-full object-cover" alt="attachment" referrerPolicy="no-referrer" />
                            </div>
                          )}

                          <p className="text-[12px] leading-relaxed font-semibold">
                            {m.content.body}
                          </p>

                          {/* RICH PRODUCT MESSAGE ATTACHMENT CARD (RULE #3) */}
                          {hasProductMention && (
                            <div className="mt-3.5 bg-app-card border border-app-border rounded-xl p-3.5 shadow-lg max-w-[280px] text-app-text-primary text-left">
                              <span className="text-[8px] text-app-accent font-black uppercase tracking-widest block mb-2">🛒 Product Attachment</span>
                              
                              <div className="flex gap-3">
                                <img 
                                  src={parsedCommerce.linkedProduct.image} 
                                  className="w-14 h-14 rounded-lg object-cover border border-app-border shrink-0 bg-app-bg" 
                                  alt={parsedCommerce.linkedProduct.name} 
                                  referrerPolicy="no-referrer" 
                                />
                                <div className="min-w-0">
                                  <h5 className="text-[11px] font-black text-app-text-primary leading-tight truncate uppercase tracking-tight">{parsedCommerce.linkedProduct.name}</h5>
                                  <span className="text-[9px] text-app-text-secondary block font-semibold mt-0.5">By {parsedCommerce.linkedProduct.brand}</span>
                                  <span className="text-[11px] text-app-accent font-bold block mt-1">৳ {parsedCommerce.linkedProduct.price.toLocaleString()}</span>
                                </div>
                              </div>

                              {parsedCommerce.linkedProduct.sku && (
                                <div className="mt-2.5 flex justify-between text-[9px] font-mono text-slate-500 uppercase">
                                  <span>Sku Identifier:</span>
                                  <span className="font-bold text-app-text-secondary">{parsedCommerce.linkedProduct.sku}</span>
                                </div>
                              )}

                              {parsedCommerce.linkedOrder && (
                                <div className="mt-2 pt-2 border-t border-app-border flex items-center justify-between text-[9px] text-app-text-secondary font-bold uppercase">
                                  <span>Order ID Match:</span>
                                  <span className="bg-[#f97316]/20 text-app-accent px-1.5 py-0.5 rounded font-black">{parsedCommerce.linkedOrder.id}</span>
                                </div>
                              )}

                              <div className="mt-4 grid grid-cols-2 gap-2">
                                <button 
                                  onClick={() => {
                                    if (parsedCommerce.linkedOrder) {
                                      setSelectedOrderDetails(parsedCommerce.linkedOrder);
                                    } else {
                                      alert("The scanned product mention has no formal customer order submitted yet.");
                                    }
                                  }}
                                  disabled={!parsedCommerce.linkedOrder}
                                  className="py-1.5 bg-white/5 hover:bg-white/10 border border-app-border text-app-text-primary rounded-lg text-[9px] font-black text-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                                >
                                  View Order
                                </button>
                                
                                <button 
                                  onClick={() => alert(`Redirecting simulation portal to Product Page: ${parsedCommerce.linkedProduct.name}`)}
                                  className="py-1.5 bg-[#f97316] hover:bg-orange-500 text-app-text-primary rounded-lg text-[9px] font-black text-center transition-all cursor-pointer"
                                >
                                  Open Product Page
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-1.5 text-[8px] opacity-40">
                            <span>
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isOurAgent && (
                              <span className="ml-1 text-sky-200">
                                {m.status === "read" ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-app-card border border-app-border text-app-text-secondary rounded-2xl rounded-bl-none p-3 max-w-[60%] flex items-center gap-2">
                        <span className="text-[10px] font-mono tracking-wider italic">
                          {typingAgent || "Customer"} is typing
                        </span>
                        <span className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75" />
                          <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150" />
                          <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-300" />
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {whatsappWarning && (
                  <div className="px-6 py-2.5 bg-amber-500/10 border-y border-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center gap-2 uppercase font-mono">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{whatsappWarning}</span>
                  </div>
                )}

                {/* Outbound inputs form */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-app-border bg-app-card/35">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-app-bg border border-app-border rounded-xl p-2.5 focus-within:border-app-accent/60 transition-all">
                      <textarea 
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Reply to ${selectedConv.senderName}...`}
                        rows={1}
                        className="flex-1 bg-transparent text-xs text-app-text-primary outline-none resize-none px-2 py-1 placeholder-slate-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                      />
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          type="button"
                          onClick={() => {
                            const url = prompt("Enter complete image attachment link (Url):");
                            if (url) setCustomMediaUrl(url);
                          }}
                          className={`p-2 rounded-lg transition-all cursor-pointer${customMediaUrl ? "bg-emerald-500/15 text-emerald-400" : "text-slate-500 hover:text-white"}`}
                          title="Attach Image Link"
                        >
                          <Camera className="w-4 h-4" />
                        </button>

                        <button 
                          type="submit"
                          disabled={!replyText.trim() && !customMediaUrl.trim()}
                          className="p-2.5 bg-app-accent hover:bg-orange-500 text-app-text-primary rounded-lg disabled:opacity-25 disabled:cursor-not-allowed transition-all cursor-pointer shadow"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {customMediaUrl && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-[10px] text-emerald-400 font-bold self-start animate-fade-in">
                        <CheckCheck className="w-3.5 h-3.5" /> Media attachment uploaded
                        <button type="button" onClick={() => setCustomMediaUrl("")} className="text-app-text-secondary hover:text-white"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <Radio className="w-14 h-14 text-slate-700 animate-pulse mb-3" />
                <h3 className="text-sm font-black text-app-text-primary uppercase tracking-widest">No Meta Lead Selected</h3>
                <p className="text-[10px] text-slate-500 max-w-xs mt-2 leading-relaxed">
                  Select a live active customer chat workspace on the left, or use the high fidelity webhook simulation console!
                </p>
              </div>
            )}
          </div>

          {/* C. RIGHT ACTIONS SIDEBAR WITH DYNAMIC ORDER LIFECYCLE (RULE #4) */}
          <div className="w-full h-full border-l border-app-border bg-app-bg/10 overflow-y-auto custom-scrollbar">
            
            {/* 1. Dynamic Order Context Panel if Auto-Linked */}
            {selectedConv && currentCommerce.linkedOrder ? (
              <div className="p-4 border-b border-app-border bg-orange-500/[0.02]/30 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-[#f97316]">
                    <ShoppingBag className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Linked Customer Order</span>
                  </div>
                  <span className="bg-orange-500/20 text-app-accent text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase font-mono">
                    {currentCommerce.linkedOrder.id}
                  </span>
                </div>

                {/* Horizontal Step Progress Bar Tracker */}
                <div className="bg-app-bg p-3.5 border border-app-border rounded-xl">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-3.5">Fulfillment Lifecycle Status</span>
                  
                  <div className="flex items-center justify-between relative mt-2 mb-1 px-1">
                    {/* Connecting line */}
                    <div className="absolute top-[7px] left-0 right-0 h-[2px] bg-app-bg z-0" />
                    
                    {/* Activated line */}
                    <div className={`absolute top-[7px] left-0 h-[2px] bg-emerald-500 z-0 transition-all`} style={{
                      width: currentCommerce.linkedOrder.status === 'PENDING' ? '0%' :
                             currentCommerce.linkedOrder.status === 'DECLINED' ? '0%' :
                             currentCommerce.linkedOrder.status === 'CONFIRMED' ? '33.3%' :
                             currentCommerce.linkedOrder.status === 'DISPATCHED' ? '66.6%' : '100%'
                    }} />

                    {/* Milestone steps */}
                    {(["Placed", "Approved", "Dispatched", "Completed"] as const).map((step, idx) => {
                      const orderStatus = currentCommerce.linkedOrder?.status;
                      let isPassed = false;
                      let isCurrent = false;

                      if (idx === 0) isPassed = true; // Placed is always passed
                      if (idx === 1 && ["CONFIRMED", "DISPATCHED", "DELIVERED"].includes(orderStatus || "")) isPassed = true;
                      if (idx === 2 && ["DISPATCHED", "DELIVERED"].includes(orderStatus || "")) isPassed = true;
                      if (idx === 3 && orderStatus === "DELIVERED") isPassed = true;

                      if (idx === 0 && orderStatus === "PENDING") isCurrent = true;
                      if (idx === 1 && orderStatus === "CONFIRMED") isCurrent = true;
                      if (idx === 2 && orderStatus === "DISPATCHED") isCurrent = true;
                      if (idx === 3 && orderStatus === "DELIVERED") isCurrent = true;

                      return (
                        <div key={step} className="flex flex-col items-center relative z-10">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center border font-black text-[8px] transition-all${
                            isPassed 
                              ? "bg-emerald-500 text-white border-transparent" 
                              : isCurrent 
                                ? "bg-amber-500 text-slate-950 border-transparent animate-pulse" 
                                : "bg-app-card text-slate-600 border-white/5"
                          }`}>
                            {isPassed ? "✓" : idx + 1}
                          </div>
                          <span className="text-[7.5px] font-black uppercase tracking-wider text-app-text-secondary mt-1">{step}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-app-border text-[10px] text-app-text-secondary flex items-center justify-between">
                    <span>Status:</span>
                    <span className={`font-black uppercase tracking-wide px-1.5 py-0.5 rounded text-[9px]${
                      currentCommerce.linkedOrder.status === 'DELIVERED' ? 'bg-green-500/10 text-emerald-400' :
                      currentCommerce.linkedOrder.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                      currentCommerce.linkedOrder.status === 'CONFIRMED' ? 'bg-sky-500/10 text-sky-400' :
                      currentCommerce.linkedOrder.status === 'DISPATCHED' ? 'bg-fuchsia-500/10 text-fuchsia-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {currentCommerce.linkedOrder.status}
                    </span>
                  </div>
                </div>

                {/* Quick actions authorization workflows */}
                <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Authorized Quick Actions</span>
                  
                  {currentCommerce.linkedOrder.status === "PENDING" && (
                    <div className="space-y-2">
                      {!showApproveForm && !showDeclineForm ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setShowApproveForm(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold uppercase py-2 px-3 rounded-lg text-[9px] tracking-wider transition-all cursor-pointer shadow"
                          >
                            Approve Order
                          </button>
                          <button
                            onClick={() => setShowDeclineForm(true)}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold uppercase py-2 px-3 rounded-lg text-[9px] tracking-wider transition-all cursor-pointer shadow"
                          >
                            Decline / Cancel
                          </button>
                        </div>
                      ) : null}

                      {/* Approval inputs */}
                      {showApproveForm && (
                        <div className="bg-app-bg p-3 border border-emerald-500/25 rounded-xl space-y-2.5 animate-fade-in">
                          <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block">Configure Delivery Approve</span>
                          <div className="space-y-1">
                            <label className="text-[8.5px] text-app-text-secondary font-bold">Delivery Charge (৳)</label>
                            <input 
                              type="number" 
                              value={tempDeliveryCharge}
                              onChange={(e) => setTempDeliveryCharge(Number(e.target.value))}
                              className="w-full bg-app-card border border-app-border px-2.5 py-1 text-xs text-app-text-primary rounded font-bold focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8.5px] text-app-text-secondary font-bold">Internal Dispatch Instructions</label>
                            <input 
                              type="text" 
                              value={tempSellerNote}
                              placeholder="e.g. Call client before dispatching package"
                              onChange={(e) => setTempSellerNote(e.target.value)}
                              className="w-full bg-app-card border border-app-border px-2.5 py-1 text-xs text-app-text-primary rounded focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-1.5 pt-1">
                            <button 
                              onClick={() => triggerApproveOrder(currentCommerce.linkedOrder!.id)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-[9px] uppercase py-1 px-2 rounded cursor-pointer"
                            >
                              Authorise
                            </button>
                            <button 
                              onClick={() => setShowApproveForm(false)}
                              className="bg-app-bg hover:bg-slate-800 text-app-text-secondary border border-app-border text-[9px] py-1 px-2 rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Decline input */}
                      {showDeclineForm && (
                        <div className="bg-app-bg p-3 border border-rose-500/25 rounded-xl space-y-2.5 animate-fade-in">
                          <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest block">Cancel Order Authorization</span>
                          <div className="space-y-1">
                            <label className="text-[8.5px] text-app-text-secondary font-bold">Reason for declines</label>
                            <input 
                              type="text" 
                              value={tempDeclineReason}
                              placeholder="e.g. Out of stock / Delivery service unavailable"
                              onChange={(e) => setTempDeclineReason(e.target.value)}
                              className="w-full bg-app-card border border-app-border px-2.5 py-1 text-xs text-app-text-primary rounded focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-1.5 pt-1">
                            <button 
                              onClick={() => triggerDeclineOrder(currentCommerce.linkedOrder!.id)}
                              className="flex-1 bg-rose-600 hover:bg-rose-500 font-bold text-white text-[9px] uppercase py-1 px-2 rounded cursor-pointer"
                            >
                              Decline Block
                            </button>
                            <button 
                              onClick={() => setShowDeclineForm(false)}
                              className="bg-app-bg hover:bg-slate-800 text-app-text-secondary border border-app-border text-[9px] py-1 px-2 rounded cursor-pointer"
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {currentCommerce.linkedOrder.status === "CONFIRMED" && (
                    <div className="space-y-2">
                      {!showDispatchForm ? (
                        <button
                          onClick={() => {
                            setTempTrackingUrl(`https://pathao.com/track/CSS-${currentCommerce.linkedOrder!.id}`);
                            setShowDispatchForm(true);
                          }}
                          className="w-full bg-[#f97316] hover:bg-orange-600 text-app-text-primary font-extrabold uppercase py-2 px-3 rounded-lg text-[9px] tracking-wider transition-all cursor-pointer shadow flex items-center justify-center gap-1"
                        >
                          <Truck className="w-3.5 h-3.5" /> Dispatch Courier
                        </button>
                      ) : (
                        <div className="bg-app-bg p-3 border border-app-accent/20 rounded-xl space-y-2.5 animate-fade-in">
                          <span className="text-[8px] font-black text-app-accent uppercase tracking-widest block">Courier Dispatch Configuration</span>
                          <div className="space-y-1">
                            <label className="text-[8.5px] text-app-text-secondary font-bold">Delivery Partner</label>
                            <input 
                              type="text" 
                              value={tempDeliveryPartner}
                              onChange={(e) => setTempDeliveryPartner(e.target.value)}
                              className="w-full bg-app-card border border-app-border px-2.5 py-1 text-xs text-app-text-primary rounded font-bold focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8.5px] text-app-text-secondary font-bold">Tracking URL Link</label>
                            <input 
                              type="text" 
                              value={tempTrackingUrl}
                              onChange={(e) => setTempTrackingUrl(e.target.value)}
                              className="w-full bg-app-card border border-app-border px-2.5 py-1 text-xs text-app-text-primary rounded focus:outline-none font-mono text-[9px]"
                            />
                          </div>
                          <div className="flex gap-1.5 pt-1">
                            <button 
                              onClick={() => triggerDispatchOrder(currentCommerce.linkedOrder!.id)}
                              className="flex-1 bg-app-accent hover:bg-orange-500 font-bold text-app-text-primary text-[9px] uppercase py-1 px-2 rounded cursor-pointer"
                            >
                              Mark Dispatched
                            </button>
                            <button 
                              onClick={() => setShowDispatchForm(false)}
                              className="bg-app-bg hover:bg-slate-800 text-app-text-secondary border border-app-border text-[9px] py-1 px-2 rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {currentCommerce.linkedOrder.status === "DISPATCHED" && (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => updateOrderStatus(currentCommerce.linkedOrder!.id, "DELIVERED")}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold uppercase py-2 px-3 rounded-lg text-[9px] tracking-wider transition-all cursor-pointer shadow flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered & Settle BDT
                      </button>

                      {currentCommerce.linkedOrder.trackingUrl && (
                        <a 
                          href={currentCommerce.linkedOrder.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full bg-app-card hover:bg-slate-800 text-app-text-secondary font-extrabold uppercase py-2 px-3 rounded-lg text-[9px] tracking-wider border border-app-border transition-all text-center block"
                        >
                          🔗 Track Shipment Realtime
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Internal notes collection */}
                <div className="space-y-2 pt-2 border-t border-app-border">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Internal ERP Admin Notes</span>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                    {currentCommerce.linkedOrder.sellerNotes && currentCommerce.linkedOrder.sellerNotes.length > 0 ? (
                      currentCommerce.linkedOrder.sellerNotes.map((note, nIdx) => (
                        <div key={nIdx} className="bg-app-bg p-2 rounded text-[10px] text-amber-300/90 font-mono leading-tight border-l-2 border-l-amber-500/70">
                          {note}
                        </div>
                      ))
                    ) : (
                      <span className="text-[9px] text-slate-600 block italic">No authorization logs saved.</span>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <input 
                      type="text" 
                      value={newInternalNote}
                      placeholder="Add administrative dispatch note..."
                      onChange={(e) => setNewInternalNote(e.target.value)}
                      className="flex-1 bg-app-bg border border-app-border px-2.5 py-1 text-[10px] text-app-text-primary rounded focus:outline-none"
                    />
                    <button 
                      onClick={() => triggerAddInternalNote(currentCommerce.linkedOrder!.id)}
                      className="bg-app-accent hover:bg-orange-500 p-1 rounded text-app-text-primary text-[10px] font-black shrink-0 px-2 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>
            ) : null}

            {/* Standard Profile and Webhook Console tools */}
            <div className="p-4 space-y-4">
              {selectedConv && (
                <div className="space-y-3.5">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Customer Identity Details</span>
                  
                  <div className="bg-app-bg p-3 border border-app-border rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-950 font-black text-white text-[10px] flex items-center justify-center border border-app-border">
                      {selectedConv.senderName[0]}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-app-text-primary truncate uppercase">{selectedConv.senderName}</h4>
                      <div className="text-[9px] text-app-text-secondary flex items-center gap-1 mt-0.5 font-semibold">
                        <MapPin className="w-2.5 h-2.5 text-app-accent" fill="currentColor" /> Dhaka, Bangladesh
                      </div>
                    </div>
                  </div>

                  {/* Status settings */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Leads Workflow Status</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(["open", "pending", "resolved"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(st)}
                          className={`py-1 rounded text-[8px] font-black uppercase tracking-wide border transition-all cursor-pointer${
                            selectedConv.status === st 
                              ? "bg-app-accent text-white border-transparent" 
                              : "bg-app-bg text-slate-500 border-white/5 hover:text-white"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lead Expert selecter */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Lead Expert Assignment</span>
                    <select
                      value={selectedConv.assignedAgent || ""}
                      onChange={(e) => handleAssignAgent(e.target.value)}
                      className="w-full bg-app-bg text-[10px] text-app-text-primary font-bold px-2.5 py-2 border border-app-border rounded-lg focus:outline-none"
                    >
                      <option value="" disabled>-- Assign Agent --</option>
                      {agents.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          👤 {ag.name} ({ag.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Webhook simulator block */}
              <div className="pt-4 border-t border-app-border space-y-3.5">
                <div className="flex items-center gap-1.5 text-app-accent">
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Meta Channels Simulator</span>
                </div>

                <div className="bg-app-bg/10 p-3.5 border border-app-border rounded-xl space-y-3">
                  <p className="text-[9.5px] text-slate-500 leading-normal font-semibold">
                    Simulate real-time Meta Messenger or WhatsApp payloads entering our webhook pipeline!
                  </p>

                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-black text-app-text-secondary uppercase">Customer Number / WaId</label>
                      <input 
                        type="text" 
                        value={simSenderPhone}
                        onChange={(e) => setSimSenderPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-app-card border border-app-border rounded text-xs text-app-text-primary placeholder-slate-600 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[7.5px] font-black text-app-text-secondary uppercase">Profile Identifier Name</label>
                      <input 
                        type="text" 
                        value={simSenderName}
                        onChange={(e) => setSimSenderName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-app-card border border-app-border rounded text-xs text-app-text-primary placeholder-slate-600 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSimMsgType("text")}
                        className={`flex-1 py-1 rounded text-[8px] font-bold uppercase cursor-pointer${simMsgType === "text" ? "bg-slate-800 text-white" : "bg-app-bg text-slate-500 border border-white/5"}`}
                      >
                        📝 Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimMsgType("image")}
                        className={`flex-1 py-1 rounded text-[8px] font-bold uppercase cursor-pointer${simMsgType === "image" ? "bg-slate-800 text-white" : "bg-app-bg text-slate-500 border border-white/5"}`}
                      >
                        🖼️ Image
                      </button>
                    </div>

                    {simMsgType === "text" ? (
                      <div className="space-y-1">
                        <label className="text-[7.5px] font-black text-app-text-secondary uppercase">Message Text Body</label>
                        <textarea 
                          value={simMessageBody}
                          onChange={(e) => setSimMessageBody(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-app-card border border-app-border rounded text-xs text-app-text-primary placeholder-slate-600 focus:outline-none resize-none h-14"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[7.5px] font-black text-app-text-secondary uppercase">Public Image Url Sourcing</label>
                        <input 
                          type="text" 
                          value={simImageUrl}
                          onChange={(e) => setSimImageUrl(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-app-card border border-app-border rounded text-[10px] text-app-text-primary focus:outline-none font-mono"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={executeSimulation}
                      disabled={simProcessing}
                      className="w-full py-2 bg-app-accent hover:bg-orange-500 font-extrabold uppercase text-[10px] text-app-text-primary tracking-widest rounded-lg transition-all shadow cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {simProcessing ? (
                        <span className="animate-spin rounded-full h-3 w-3 border-2 border-app-border border-t-white" />
                      ) : (
                        <>🚀 Fire Meta Webhook</>
                      )}
                    </button>
                  </div>
                </div>

                {simResult && (
                  <div className="bg-app-bg rounded-xl p-3 border border-app-border font-mono text-[8px] text-app-text-secondary space-y-1.5 overflow-x-auto max-h-44 custom-scrollbar">
                    <div className="flex justify-between items-center text-app-text-primary border-b border-app-border pb-1 uppercase font-bold text-[7.5px]">
                      <span>Hook Result Log</span>
                      <span className={simResult.statusCode === 200 ? "text-emerald-400" : "text-rose-400"}>
                        Code {simResult.statusCode}
                      </span>
                    </div>
                    <pre>{JSON.stringify(simResult.responsePayload, null, 2)}</pre>
                  </div>
                )}
              </div>

            </div>

          </div>

        </SplitLayout>

      ) : (

        // =============================================================
        // PLATFORM INBOX DESIGN SEPARATED TAB (SYSTEM LAYER / ERP ALERTS) (RULE #1, #2)
        // =============================================================
        <SplitLayout layoutId="messages-platform-studio" panes={messagesPlatformPanes} className="flex-1 min-h-0 bg-app-bg">
          
          {/* A. LEFT BAR: PLATFORM THREADS INBOX (DRIVEN BY ERP MESSAGE THREADS) */}
          <div className="w-full h-full bg-app-bg border-r border-app-border flex flex-col shrink-0">
            <div className="p-4 border-b border-app-border bg-app-bg/10 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black text-app-text-primary uppercase tracking-wider">Platform Inbox</h3>
                  <span className="text-[9px] text-app-text-secondary font-bold block mt-0.5">{filteredPlatformThreads.length} Sync Threads</span>
                </div>
                
                <button
                  onClick={() => {
                    markAllThreadsAsRead();
                    alert("All internal system alerting threads authorized as read.");
                  }}
                  className="px-2.5 py-1 text-[8.5px] font-black uppercase text-app-accent bg-app-accent/15 rounded hover:bg-app-accent/25 transition-all cursor-pointer"
                >
                  Mark All Read
                </button>
              </div>

              {/* Filtering Controls */}
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-app-accent transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search conversations..."
                  value={platformSearchTerm}
                  onChange={(e) => setPlatformSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-app-card border border-app-border rounded-lg text-xs text-app-text-primary placeholder-slate-500 focus:outline-none focus:border-app-accent/40"
                />
              </div>
            </div>

            {/* Platform Thread List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-app-border/40">
              {filteredPlatformThreads.length === 0 ? (
                <div className="p-10 text-center space-y-1">
                  <div className="text-slate-600 text-[10px] uppercase tracking-widest font-black">No System Alerts</div>
                  <p className="text-[10px] text-slate-500">Wait for client order transactions or logistics alerts.</p>
                </div>
              ) : (
                filteredPlatformThreads.map((t) => {
                  const isSelected = t.id === selectedThreadId;
                  const hasUnread = t.messages.some(m => m.senderRole === "customer"); // Customer reply indicates action is needed!
                  const avatarLetter = t.customer.name ? t.customer.name[0] : "S";

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedThreadId(t.id)}
                      className={`px-4 py-3.5 cursor-pointer relative transition-all group${
                        isSelected 
                          ? "bg-app-card border-l-4 border-l-app-accent" 
                          : "hover:bg-slate-800/10"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-app-bg border border-app-border flex items-center justify-center font-black text-app-text-secondary text-xs shrink-0 relative uppercase">
                          {avatarLetter}
                          {hasUnread && (
                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border border-app-border" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs font-black text-app-text-primary truncate group-hover:text-app-accent transition-colors">
                              {t.customer.name}
                            </h4>
                            <span className="text-[9px] text-[#f97316] font-bold font-mono">
                              {t.id.substring(0, 8).toUpperCase()}
                            </span>
                          </div>
                          
                          <p className="text-[10.5px] font-black text-app-text-secondary mt-0.5 truncate leading-tight uppercase tracking-tight">
                            {t.subject}
                          </p>
                          
                          <p className="text-[10px] text-slate-500 line-clamp-1 italic text-ellipsis mt-1 font-semibold">
                            {t.preview}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* B. CENTER MESSAGE CHAT AREA FOR PLATFORM SUPPORT TERMINAL */}
          <div className="flex-1 flex flex-col bg-app-bg/10 h-full">
            {selectedThread ? (
              <>
                <div className="h-16 border-b border-app-border px-6 flex items-center justify-between bg-app-bg/10">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-yellow-500/15 rounded-lg">
                      <Activity className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-app-text-primary tracking-wide uppercase flex items-center gap-2">
                        {selectedThread.customer.name} 
                        <span className="text-[9px] bg-app-bg text-amber-500 font-bold px-1.5 py-0.5 rounded font-mono border border-app-border">
                          SYSTEM ALERTS
                        </span>
                      </h3>
                      <p className="text-[9px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5 font-mono uppercase">
                        Thread Code: {selectedThread.id.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-app-bg/10">
                  {selectedThread.messages.map((m) => {
                    const isOurAgent = m.senderRole === "seller" || m.senderRole === "admin";
                    
                    return (
                      <div key={m.id} className={`flex${isOurAgent ? "justify-end" : "justify-start"}animate-fade-in`}>
                        <div className={`max-w-[75%] rounded-2xl p-4 shadow-md${
                          isOurAgent 
                            ? "bg-app-card border border-white/5 text-white rounded-br-none" 
                            : "bg-indigo-950 border border-white/5 text-white rounded-bl-none animate-pulse-subtle"
                        }`}>
                          <div className="text-[8px] font-black tracking-widest uppercase mb-1 opacity-60 flex items-center justify-between gap-4">
                            <span>{m.senderName}</span>
                            <span className="text-app-accent">{m.senderRole}</span>
                          </div>
                          
                          <p className="text-[12px] leading-relaxed font-semibold text-app-text-primary">
                            {m.text}
                          </p>

                          <div className="flex items-center justify-end mt-1 text-[8px] opacity-40 font-mono">
                            <span>{m.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={platformMessagesEndRef} />
                </div>

                {/* Reply terminal interface */}
                <form onSubmit={handleSendPlatformReply} className="p-4 border-t border-app-border bg-app-card/35">
                  <div className="flex items-center gap-2 bg-app-bg border border-app-border rounded-xl p-2.5 focus-within:border-app-accent/60 transition-all">
                    <input 
                      type="text"
                      value={platformReplyText}
                      onChange={(e) => setPlatformReplyText(e.target.value)}
                      placeholder={`Send internal system response to ${selectedThread.customer.name}...`}
                      className="flex-1 bg-transparent text-xs text-app-text-primary outline-none px-2 py-1 placeholder-slate-500"
                    />
                    
                    <button 
                      type="submit"
                      disabled={!platformReplyText.trim()}
                      className="p-2.5 bg-app-accent hover:bg-orange-500 text-app-text-primary rounded-lg disabled:opacity-25 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <Activity className="w-14 h-14 text-slate-700 animate-pulse mb-3" />
                <h3 className="text-sm font-black text-app-text-primary uppercase tracking-widest">No Platform Thread Active</h3>
                <p className="text-[10px] text-slate-500 max-w-xs mt-2 leading-relaxed text-center">
                  Select an administrative system/order logs thread on the left pane to authorize actions.
                </p>
              </div>
            )}
          </div>

          {/* C. RIGHT ACTIONS SIDEBAR WITH CORE ORDER DETAILS INTEGRATION (RULE #1) */}
          <div className="w-full h-full border-l border-app-border bg-app-bg/10 overflow-y-auto custom-scrollbar font-sans">
            {selectedThread && currentCommerce.linkedOrder ? (
              <div className="p-4 space-y-5">
                
                {/* Visual Card Sourcing */}
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-[#F4631E] uppercase tracking-widest block">Associated ERP Transaction Detail</span>
                  <div className="bg-app-bg p-4 border border-app-border rounded-2xl space-y-3 text-app-text-primary">
                    <div className="flex gap-3">
                      <img 
                        src={currentCommerce.linkedProduct?.image || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80"} 
                        className="w-12 h-12 rounded-xl object-cover border border-app-border shrink-0 bg-app-bg" 
                        alt="Product"
                        referrerPolicy="no-referrer" 
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-app-text-primary truncate leading-tight uppercase font-mono">{currentCommerce.linkedProduct?.name}</h4>
                        <span className="text-[8px] text-slate-500 block mt-0.5">Brand: {currentCommerce.linkedProduct?.brand}</span>
                        <span className="text-[10px] text-app-accent font-bold mt-1 block">Value: ৳ {currentCommerce.linkedProduct?.price.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-app-border grid grid-cols-2 gap-2 text-[9px] font-mono uppercase text-app-text-secondary">
                      <div>Order RefID:</div>
                      <div className="text-right font-black text-app-text-primary">{currentCommerce.linkedOrder.id}</div>

                      <div>Source origin:</div>
                      <div className="text-right font-black text-amber-500">{currentCommerce.linkedOrder.platformSource || 'WhatsApp'}</div>
                      
                      <div>Commission BDT:</div>
                      <div className="text-right font-bold text-amber-300">৳ {currentCommerce.linkedOrder.earnings?.futureAutomatedDeduction?.toLocaleString() || "420"}</div>

                      <div>Net Earnings:</div>
                      <div className="text-right font-black text-emerald-400 font-mono">৳ {currentCommerce.linkedOrder.earnings?.sellerNet?.toLocaleString() || "3,780"}</div>
                    </div>
                  </div>
                </div>

                {/* Milestone fulfillment tracker */}
                <div className="bg-app-bg p-4 border border-app-border rounded-2xl space-y-3">
                  <span className="text-[9px] font-black text-app-text-secondary uppercase tracking-widest block">Fulfillment Tracks (Interactive)</span>
                  
                  <div className="flex items-center justify-between relative mt-2 mb-1 px-1">
                    <div className="absolute top-[7px] left-0 right-0 h-[2px] bg-app-bg z-0" />
                    <div className={`absolute top-[7px] left-0 h-[2px] bg-emerald-500 z-0 transition-all`} style={{
                      width: currentCommerce.linkedOrder.status === 'Pending' ? '0%' :
                             currentCommerce.linkedOrder.status === 'Cancelled' ? '0%' :
                             currentCommerce.linkedOrder.status === 'Confirmed' ? '33.3%' :
                             currentCommerce.linkedOrder.status === 'Dispatched' ? '66.6%' : '100%'
                    }} />

                    {(["Placed", "Approved", "Dispatched", "Completed"] as const).map((step, idx) => {
                      const orderStatus = currentCommerce.linkedOrder?.status;
                      let isPassed = false;
                      let isCurrent = false;

                      if (idx === 0) isPassed = true;
                      if (idx === 1 && ["Confirmed", "Dispatched", "Delivered"].includes(orderStatus || "")) isPassed = true;
                      if (idx === 2 && ["Dispatched", "Delivered"].includes(orderStatus || "")) isPassed = true;
                      if (idx === 3 && orderStatus === "Delivered") isPassed = true;

                      if (idx === 0 && orderStatus === "Pending") isCurrent = true;
                      if (idx === 1 && orderStatus === "Confirmed") isCurrent = true;
                      if (idx === 2 && orderStatus === "Dispatched") isCurrent = true;
                      if (idx === 3 && orderStatus === "Delivered") isCurrent = true;

                      return (
                        <button 
                          key={step} 
                          type="button"
                          onClick={() => {
                            if (idx === 0) updateOrderStatus(currentCommerce.linkedOrder!.id, 'Pending');
                            if (idx === 1) approveOrder(currentCommerce.linkedOrder!.id, 120, "Approved via interactive sidebar selection.");
                            if (idx === 2) dispatchOrder(currentCommerce.linkedOrder!.id, courierField || 'Pathao Logistics Partner', 'https://track.pathao.com/' + (trackingIdField || currentCommerce.linkedOrder!.id));
                            if (idx === 3) updateOrderStatus(currentCommerce.linkedOrder!.id, 'Delivered');
                          }}
                          className="flex flex-col items-center relative z-10 focus:outline-none cursor-pointer group"
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center border font-black text-[8px] transition-all${
                            isPassed 
                              ? "bg-emerald-500 text-white border-transparent" 
                              : isCurrent 
                                ? "bg-amber-500 text-slate-950 border-transparent animate-pulse" 
                                : "bg-app-card text-slate-600 border-white/5 group-hover:border-white/30"
                          }`}>
                            {isPassed ? "✓" : idx + 1}
                          </div>
                          <span className="text-[7.5px] font-black uppercase tracking-wider text-app-text-secondary mt-1">{step}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery Tracking Control Module */}
                <div className="bg-app-bg p-4 border border-app-border rounded-2xl space-y-3">
                  <span className="text-[9px] font-black text-app-text-secondary uppercase tracking-widest block">Delivery Tracking Control</span>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Courier Carrier</label>
                      <input 
                        type="text" 
                        value={courierField}
                        onChange={(e) => setCourierField(e.target.value)}
                        placeholder="Pathao, RedX, Steadfast..."
                        className="w-full bg-app-card text-app-text-primary px-3 py-1.5 rounded-lg border border-app-border text-[10px] outline-none focus:border-[#F4631E]/40"
                      />
                    </div>

                    <div>
                      <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Tracking ID or URL slug</label>
                      <input 
                        type="text" 
                        value={trackingIdField}
                        onChange={(e) => setTrackingIdField(e.target.value)}
                        placeholder="e.g. TRK-PATHAO-12938"
                        className="w-full bg-app-card text-app-text-primary px-3 py-1.5 rounded-lg border border-app-border text-[10px] outline-none focus:border-[#F4631E]/40"
                      />
                    </div>

                    <div>
                      <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Current Transit Status</label>
                      <select
                        value={currentCommerce.linkedOrder.status}
                        onChange={(e) => updateOrderStatus(currentCommerce.linkedOrder!.id, e.target.value as any)}
                        className="w-full bg-app-card text-app-text-primary px-3 py-1.5 rounded-lg border border-app-border text-[10px] outline-none focus:border-[#F4631E]/40 cursor-pointer"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed / Approved</option>
                        <option value="Dispatched">Dispatched / Outbound</option>
                        <option value="Delivered">Delivered / Handover Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        dispatchOrder(
                          currentCommerce.linkedOrder!.id, 
                          courierField || 'Pathao Logistics Partner', 
                          'https://track.pathao.com/' + (trackingIdField || currentCommerce.linkedOrder!.id)
                        );
                        alert(`✓ Tracking information saved real-time: ${courierField}`);
                      }}
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold py-2 rounded-lg text-[9px] uppercase tracking-wider transition-all mt-1 cursor-pointer"
                    >
                      Attach & Save Tracking Info
                    </button>
                  </div>
                </div>

                {/* Customer Communication Notes (Rule constraints) */}
                <div className="bg-app-bg p-4 border border-app-border rounded-2xl space-y-4">
                  <span className="text-[9px] font-black text-app-text-secondary uppercase tracking-widest block">Customer Communication Notes</span>
                  
                  {/* Private Internal Note */}
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-500 uppercase block">Internal Note (Private Only)</label>
                    <div className="flex gap-1">
                      <input 
                        type="text"
                        value={localPrivateNote}
                        onChange={(e) => setLocalPrivateNote(e.target.value)}
                        placeholder="Private operational override notes..."
                        className="flex-1 bg-app-card text-app-text-primary px-2.5 py-1.5 rounded-lg border border-app-border text-[9px] outline-none focus:border-[#F4631E]/40"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!localPrivateNote) return;
                          addSellerNotes(currentCommerce.linkedOrder!.id, localPrivateNote);
                          setLocalPrivateNote("");
                        }}
                        className="bg-app-bg hover:bg-slate-700 text-app-text-primary text-[9px] font-bold px-2 rounded-lg transition-all"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Customer Conversation Note */}
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-500 uppercase block">Customer Conversation Note (Shared)</label>
                    <div className="flex gap-1">
                      <input 
                        type="text"
                        value={localCustomerNote}
                        onChange={(e) => setLocalCustomerNote(e.target.value)}
                        placeholder="Visible to customer on invoice receipt..."
                        className="flex-1 bg-app-card text-app-text-primary px-2.5 py-1.5 rounded-lg border border-app-border text-[9px] outline-none focus:border-[#F4631E]/40"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!localCustomerNote) return;
                          addCustomerNotes(currentCommerce.linkedOrder!.id, localCustomerNote);
                          setLocalCustomerNote("");
                        }}
                        className="bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-bold px-2 rounded-lg transition-all"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Render listing of both logs */}
                  <div className="pt-2 border-t border-app-border space-y-2">
                    {currentCommerce.linkedOrder.sellerNotes && currentCommerce.linkedOrder.sellerNotes.length > 0 && (
                      <div>
                        <span className="text-[7.5px] font-extrabold text-slate-500 uppercase tracking-widest">Logged Seller Notes ({currentCommerce.linkedOrder.sellerNotes.length})</span>
                        <div className="space-y-1 mt-1 max-h-24 overflow-y-auto">
                          {currentCommerce.linkedOrder.sellerNotes.map((note, nIdx) => (
                            <div key={nIdx} className="bg-app-bg/10 p-2 rounded text-[9px] text-[#F3631E] font-mono leading-relaxed border-l border-orange-500">
                              {note}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentCommerce.linkedOrder.customerNotes && currentCommerce.linkedOrder.customerNotes.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[7.5px] font-extrabold text-slate-500 uppercase tracking-widest">Customer Notes ({currentCommerce.linkedOrder.customerNotes.length})</span>
                        <div className="space-y-1 mt-1 max-h-24 overflow-y-auto">
                          {currentCommerce.linkedOrder.customerNotes.map((note, nIdx) => (
                            <div key={nIdx} className="bg-sky-950/20 p-2 rounded text-[9px] text-sky-400 font-sans leading-relaxed border-l border-sky-500">
                              {note}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ERP Order action buttons */}
                <div className="space-y-2">
                  <span className="text-[9px] font-black text-app-text-secondary uppercase tracking-widest block">Operational Controls</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/admin/invoice/${currentCommerce.linkedOrder.id}`}
                      className="bg-app-bg font-sans hover:bg-app-card border border-app-border text-app-text-secondary font-bold py-2 rounded-xl text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3 h-3 text-emerald-400" />
                      <span>View Invoice</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        approveOrder(currentCommerce.linkedOrder!.id, 120, "Authorized manually from internal ERP panel");
                        alert('✓ Order approved successfully');
                      }}
                      className="bg-[#241A35] font-sans hover:bg-app-card border border-purple-500/10 text-purple-300 font-bold py-2 rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Approve Order
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-10 text-center text-slate-500 text-[10px] leading-relaxed">
                Selecting a thread list conversation auto-loads of system-order details on the platform dashboard workspace dynamically.
              </div>
            )}
          </div>
        </SplitLayout>
      )}

      {/* =============================================================
          CORE DIALOG INTERACTIVE INVOICE MODAL BACKDROP (RULE #3, #4)
          ============================================================= */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 bg-app-card/20 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-app-bg border border-app-border rounded-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            <button 
              onClick={() => setSelectedOrderDetails(null)}
              className="absolute top-4 right-4 text-app-text-secondary hover:text-white p-2 rounded-xl bg-white/5 cursor-pointer text-xs font-bold"
            >
              ✕ Close
            </button>

            <span className="text-[8px] font-black text-app-accent uppercase tracking-widest block mb-1">Choosify Authorized Invoice</span>
            <h3 className="text-sm font-black text-app-text-primary uppercase tracking-wider">Fulfillment Docket: #{selectedOrderDetails.id}</h3>
            
            {/* Invoice Meta */}
            <div className="mt-4 pt-3.5 border-t border-app-border grid grid-cols-2 gap-2 text-[10px] text-app-text-secondary font-mono relative uppercase">
              <div>Invoice Status:</div>
              <div className="text-right text-emerald-400 font-black">{selectedOrderDetails.invoice_status || "Unpaid"}</div>

              <div>Creation Time:</div>
              <div className="text-right text-app-text-secondary">{new Date(selectedOrderDetails.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>

              <div>Invoice Slit Id:</div>
              <div className="text-right text-slate-500 font-bold">{selectedOrderDetails.invoice_id || "IV-CSS-1129-9"}</div>
            </div>

            {/* Product description card */}
            <div className="mt-4 bg-app-card border border-app-border/40 p-3.5 rounded-xl flex gap-3 text-app-text-primary">
              <img src={selectedOrderDetails.product.image} className="w-12 h-12 rounded object-cover border border-app-border" alt="Order product" referrerPolicy="no-referrer" />
              <div className="min-w-0 flex-1">
                <h5 className="text-[11px] font-black text-app-text-primary uppercase truncate leading-tight">{selectedOrderDetails.product.name}</h5>
                <span className="text-[8px] text-slate-500 block mt-0.5">Seller: {selectedOrderDetails.product.sellerName}</span>
                <span className="text-[11px] font-bold text-app-accent block mt-1">৳ {selectedOrderDetails.product.price.toLocaleString()}</span>
              </div>
            </div>

            {/* Price breaks calculation stack */}
            <div className="mt-4 pt-3.5 border-t border-app-border space-y-2.5 text-[11px] text-app-text-secondary font-mono">
              <div className="flex justify-between">
                <span>Value Sourcing Subtotal:</span>
                <span className="text-app-text-primary font-bold">৳ {selectedOrderDetails.product.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Authorized First-Mile Cargo:</span>
                <span className="text-app-text-primary">৳ {selectedOrderDetails.delivery_charge || "120"}</span>
              </div>
              <div className="flex justify-between border-t border-app-border pt-2 text-app-text-primary font-black">
                <span>Total Payable (৳):</span>
                <span className="text-app-accent font-black">৳ {((selectedOrderDetails.total_payable || selectedOrderDetails.product.price) + (selectedOrderDetails.delivery_charge || 120)).toLocaleString()}</span>
              </div>
            </div>

            {/* Shipping detail */}
            <div className="mt-4 pt-3.5 border-t border-app-border space-y-1.5 text-[10px] text-app-text-secondary">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Recipient Delivery Sourcing</span>
              <div className="bg-app-card border border-app-border rounded-xl p-3 space-y-1 text-app-text-secondary font-mono text-[9px] uppercase">
                <div>Client ID: {selectedOrderDetails.customer.id.toUpperCase()}</div>
                <div>Name: {selectedOrderDetails.customer.name}</div>
                <div>Status Flag: {selectedOrderDetails.customer.flagged ? "🔴 Flagged" : "🟢 Cleared"}</div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedOrderDetails(null)}
              className="mt-5 w-full py-2 bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-850 border border-app-border hover:to-indigo-900 text-white font-bold uppercase text-[10px] tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Authorization Finished / Understood
            </button>

          </div>
        </div>
      )}

      {/* =============================================================
          WIZARD MODAL: CREATE MANUAL / OFFLINE / SOURCED ORDER (RULE #4, #5)
          ============================================================= */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-app-card/20 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-app-bg border border-app-border rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-8 py-5 border-b border-app-border bg-gradient-to-r from-slate-900 to-indigo-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-app-text-primary uppercase tracking-wider">Initialize Sourced Trade</h3>
                  <span className="text-[10px] text-app-text-secondary font-bold block mt-0.5">Real-time ERP Manual Order Generation Engine</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleResetManualForm}
                className="text-app-text-secondary hover:text-white p-2 rounded-xl bg-white/5 cursor-pointer text-xs font-black"
              >
                ✕ Close
              </button>
            </div>

            {/* Success Success State */}
            {manualSuccessOrderInfo ? (
              <div className="p-8 text-center flex-grow overflow-y-auto custom-scrollbar flex flex-col justify-center items-center space-y-6">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center border-2 border-emerald-500/20 animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                
                <div className="space-y-2 max-w-sm">
                  <h4 className="text-base font-black text-app-text-primary uppercase font-sans tracking-wide">Manual Trade Sourced Successfully!</h4>
                  <p className="text-xs text-app-text-secondary leading-relaxed font-sans">
                    Every manual or external order is tracked instantly via our ERP control hub and has generated authenticated invoices.
                  </p>
                </div>

                {/* Sourced metadata receipt */}
                <div className="bg-app-card border border-app-border rounded-2xl p-6 w-full max-w-md space-y-3 text-left font-mono text-xs uppercase text-app-text-secondary">
                  <div className="flex justify-between pb-2 border-b border-app-border">
                    <span>Fulfillment Reference ID:</span>
                    <span className="text-app-text-primary font-black">{manualSuccessOrderInfo.orderId}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-app-border">
                    <span>Invoice Bill Slit ID:</span>
                    <span className="text-pink-400 font-black">{manualSuccessOrderInfo.invoiceId}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-app-border">
                    <span>Sourced User Profile:</span>
                    <span className="text-app-text-primary font-sans font-bold">{manualCustomerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Invoice Authorization:</span>
                    <span className="text-emerald-400 font-black">🟢 APPROVED / UNPAID</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (setSelectedOrderDetails) {
                        const productsMock = [
                          { id: "101", name: "Aarong Silk Panjabi", sellerName: "Aarong", price: 4200, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80" },
                          { id: "102", name: "Apex Mens Formal Leather", sellerName: "Apex Brands", price: 3500, image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80" },
                          { id: "103", name: "Samsung S25 Ultra", sellerName: "Samsung Co", price: 139999, image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80" },
                          { id: "104", name: "Walton 2-Door Fridge", sellerName: "Walton Corp", price: 29990, image: "https://images.unsplash.com/photo-1571175432247-5c86c5a4c0c4?w=400&q=80" }
                        ];
                        const matchedProd = productsMock.find(p => p.id === manualProductSelection) || productsMock[0];
                        setSelectedOrderDetails({
                          id: manualSuccessOrderInfo.orderId,
                          invoice_id: manualSuccessOrderInfo.invoiceId,
                          timestamp: new Date().toISOString(),
                          invoice_status: "Unpaid",
                          total_payable: (manualPriceOverride ? parseFloat(manualPriceOverride) || 0 : matchedProd.price) * manualQuantity,
                          delivery_charge: 120,
                          product: matchedProd,
                          customer: {
                            id: "C-MANUAL-" + manualSuccessOrderInfo.orderId.substring(4),
                            name: manualCustomerName,
                            flagged: false
                          }
                        });
                      }
                      setIsManualModalOpen(false);
                    }}
                    className="flex-1 py-3 bg-[#ef3c23] hover:bg-orange-600 text-app-text-primary font-black uppercase text-[10px] tracking-widest rounded-xl text-center shadow transition-all cursor-pointer"
                  >
                    View / Print Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualSuccessOrderInfo(null);
                      setManualCustomerName("");
                      setManualCustomerEmail("");
                      setManualCustomerPhone("");
                      setManualCustomerAddress("");
                      setManualChatRefId("");
                      setManualNotes("");
                    }}
                    className="flex-1 py-3 bg-app-card hover:bg-slate-800 border border-app-border text-app-text-secondary font-black uppercase text-[10px] tracking-widest rounded-xl transition-all cursor-pointer"
                  >
                    Add Another Trade
                  </button>
                  <button
                    type="button"
                    onClick={handleResetManualForm}
                    className="flex-1 py-3 bg-app-bg hover:bg-app-card border border-app-border text-slate-500 font-semibold uppercase text-[10px] tracking-widest rounded-xl transition-all cursor-pointer"
                  >
                    Dismiss Workspace
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitManualOrder} className="flex-1 flex flex-col min-h-0 bg-app-bg">
                <div className="p-8 space-y-6 overflow-y-auto shrink-0 custom-scrollbar flex-1">
                  
                  {/* Grid split columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Left Column: Customer details */}
                    <div className="space-y-4">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Step 1: Recipient Identity Profile</span>
                      
                      <div>
                        <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Customer Name (Required)</label>
                        <input 
                          type="text" 
                          required
                          value={manualCustomerName}
                          onChange={(e) => setManualCustomerName(e.target.value)}
                          placeholder="e.g. Farhan Bin Rafiq"
                          className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary placeholder-slate-600 outline-none focus:border-[#F4631E]/40 transition-all font-sans"
                        />
                      </div>

                      <div>
                        <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Customer Phone Number (Required)</label>
                        <input 
                          type="text" 
                          required
                          value={manualCustomerPhone}
                          onChange={(e) => setManualCustomerPhone(e.target.value)}
                          placeholder="e.g. +8801712345678"
                          className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary placeholder-slate-600 outline-none focus:border-[#F4631E]/40 transition-all font-sans"
                        />
                      </div>

                      <div>
                        <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Customer Email Address (Optional)</label>
                        <input 
                          type="email" 
                          value={manualCustomerEmail}
                          onChange={(e) => setManualCustomerEmail(e.target.value)}
                          placeholder="e.g. farhan@domain.com"
                          className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary placeholder-slate-600 outline-none focus:border-[#F4631E]/40 transition-all font-sans"
                        />
                      </div>

                      <div>
                        <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Fulfillment Home Address (Required)</label>
                        <textarea 
                          required
                          value={manualCustomerAddress}
                          onChange={(e) => setManualCustomerAddress(e.target.value)}
                          placeholder="Provide detailed supply delivery landmark location in Bangladesh..."
                          rows={3}
                          className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary placeholder-slate-600 outline-none focus:border-[#F4631E]/40 transition-all font-sans resize-none"
                        />
                      </div>
                    </div>

                    {/* Right Column: Sourced Product & overrides */}
                    <div className="space-y-4">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Step 2: Cart Items & Channels Sourcing</span>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Sourcing Channel</label>
                          <select
                            value={manualPlatformSource}
                            onChange={(e) => setManualPlatformSource(e.target.value as any)}
                            className="w-full bg-app-card border border-app-border rounded-xl px-3 py-2.5 text-xs text-app-text-primary outline-none focus:border-[#F4631E]/40 cursor-pointer font-sans"
                          >
                            <option value="WhatsApp">💬 WhatsApp DM</option>
                            <option value="Facebook">📬 Facebook Chat</option>
                            <option value="Instagram">📸 Instagram Direct</option>
                            <option value="Offline">🔌 Offline / Direct Sourced</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Chat Ref ID (Optional)</label>
                          <input 
                            type="text" 
                            value={manualChatRefId}
                            onChange={(e) => setManualChatRefId(e.target.value)}
                            placeholder="e.g. MSG-99120"
                            className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary placeholder-slate-600 outline-none focus:border-[#F4631E]/40 transition-all font-sans"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Select Sourced Product Item</label>
                        <select
                          value={manualProductSelection}
                          onChange={(e) => setManualProductSelection(e.target.value)}
                          className="w-full bg-app-card border border-app-border rounded-xl px-3 py-2 text-xs text-app-text-primary outline-none focus:border-[#F4631E]/40 cursor-pointer font-sans"
                        >
                          <option value="101">Aarong Silk Panjabi — ৳ 4,200</option>
                          <option value="102">Apex Mens Formal Leather — ৳ 3,500</option>
                          <option value="103">Samsung S25 Ultra — ৳ 139,999</option>
                          <option value="104">Walton 2-Door Fridge — ৳ 29,990</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Qty Ordered</label>
                          <input 
                            type="number" 
                            min={1}
                            required
                            value={manualQuantity}
                            onChange={(e) => setManualQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary outline-none focus:border-[#F4631E]/40 transition-all font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Price Overwrite BDT (Optional)</label>
                          <input 
                            type="number" 
                            value={manualPriceOverride}
                            onChange={(e) => setManualPriceOverride(e.target.value)}
                            placeholder="Overwrite normal BDT..."
                            className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary placeholder-slate-700 outline-none focus:border-[#F4631E]/40 transition-all font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[8px] font-black text-app-text-secondary uppercase block mb-1">Internal Comments Log Notes</label>
                        <input 
                          type="text" 
                          value={manualNotes}
                          onChange={(e) => setManualNotes(e.target.value)}
                          placeholder="Comments: e.g. Customer requested gift wrapping."
                          className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary placeholder-slate-600 outline-none focus:border-[#F4631E]/40 transition-all font-sans"
                        />
                      </div>
                    </div>

                  </div>

                  {/* Operational Dynamic Subtotal Calculator block */}
                  <div className="mt-4 bg-app-bg/10 border border-app-border p-5 rounded-2xl flex justify-between items-center flex-wrap gap-4 select-none font-sans">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Live Calculated Sourced Bill Quote</span>
                      <div className="text-xs text-app-text-secondary font-mono">
                        Base: ৳ {
                          (manualPriceOverride ? parseFloat(manualPriceOverride) || 0 : (manualProductSelection === '101' ? 4200 : manualProductSelection === '102' ? 3500 : manualProductSelection === '103' ? 139999 : 29990))
                        } · Qty: {manualQuantity} · Courier Base Carriage: ৳ 120
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">GRAND TOTAL EST. PAYABLE</span>
                      <div className="text-sm font-black text-emerald-400 font-mono">
                        ৳ {
                          (((manualPriceOverride ? parseFloat(manualPriceOverride) || 0 : (manualProductSelection === '101' ? 4200 : manualProductSelection === '102' ? 3500 : manualProductSelection === '103' ? 139999 : 29990)) * manualQuantity) + 120).toLocaleString()
                        } BDT
                      </div>
                    </div>
                  </div>

                </div>

                <div className="px-8 py-5 border-t border-app-border bg-app-bg/10 flex items-center justify-between shrink-0 gap-4">
                  <div className="text-[9px] text-app-text-secondary leading-tight block max-w-xs font-sans">
                    By submitting, this transaction is marked Approved. An invoice slit will compile, enabling print, logs, tracking, and courier dispatch.
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResetManualForm}
                      className="px-5 py-2.5 rounded-xl bg-app-card hover:bg-slate-800 text-app-text-secondary text-[10px] font-black uppercase tracking-wider transition-all border border-app-border cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                    >
                      Generate Invoice & Save
                    </button>
                  </div>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
