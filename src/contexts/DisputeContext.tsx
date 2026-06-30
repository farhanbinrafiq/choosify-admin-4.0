import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTrust } from './TrustContext';

export type DisputeType = 
  | 'order_issue' 
  | 'payment' 
  | 'quality' 
  | 'late_delivery' 
  | 'seller_misconduct' 
  | 'product_authenticity' 
  | 'abuse' 
  | 'other';

export type DisputeStatus = 
  | 'open' 
  | 'in_investigation' 
  | 'mediation' 
  | 'resolved' 
  | 'escalated' 
  | 'closed';

export type ResolutionType = 
  | 'refund_full' 
  | 'refund_partial' 
  | 'replacement' 
  | 'credit' 
  | 'dismiss' 
  | 'escalate';

export interface DisputeParticipant {
  id: string;
  type: 'buyer' | 'seller' | 'brand' | 'admin';
  name: string;
  avatar?: string;
  contactInfo?: string;
}

export interface DisputeEvidence {
  id: string;
  type: 'image' | 'document' | 'message' | 'order_detail';
  url: string;
  description: string;
  uploadedBy: string; // user ID
  uploadedAt: string;
}

export interface DisputeMessage {
  id: string;
  sender: DisputeParticipant;
  content: string;
  timestamp: string;
  isInternal: boolean; // internal note, not visible to all parties
  attachments?: DisputeEvidence[];
}

export interface Dispute {
  id: string;
  disputeNumber: string; // DSP-2026-00123
  status: DisputeStatus;
  type: DisputeType;
  severity: 'low' | 'medium' | 'high';
  priority: 'normal' | 'urgent';
  
  // Parties involved
  buyer: DisputeParticipant;
  seller: DisputeParticipant;
  admin?: string; // assigned admin ID
  
  // Context
  orderId?: string;
  productId?: string;
  brandId?: string;
  
  // Details
  title: string;
  description: string;
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
  
  // Resolution
  resolutionType?: ResolutionType;
  resolutionAmount?: number; // refund/credit amount
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string; // admin ID
  
  // Timeline
  createdAt: string;
  lastUpdatedAt: string;
  dueDateForResolution: string; // auto-calculated based on SLA
  
  // Audit
  statusHistory: { status: DisputeStatus; timestamp: string; changedBy: string; }[];
  actionLog: string[]; // detailed log of all actions
}

// Bangladesh holidays in 2026 for authentic local business calendar calculations
const BANGLADESH_HOLIDAYS_2026 = [
  '2026-02-21', // International Mother Language Day
  '2026-03-26', // Independence Day
  '2026-04-14', // Pahela Baishakh
  '2026-05-01', // May Day
  '2026-11-07', // National Revolution & Solidarity Day
  '2026-12-16', // Victory Day
  '2026-12-25', // Christmas Day
];

export function addBusinessDays(startDate: Date, days: number): Date {
  const date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay(); // 0 Sunday, 5 Friday, 6 Saturday
    const dateStr = date.toISOString().split('T')[0];
    
    // Friday and Saturday are Bangladesh weekends
    const isWeekend = day === 5 || day === 6;
    const isHoliday = BANGLADESH_HOLIDAYS_2026.includes(dateStr);
    
    if (!isWeekend && !isHoliday) {
      added++;
    }
  }
  return date;
}

export function getDaysRemaining(dueDateStr: string): number {
  const due = new Date(dueDateStr).getTime();
  const now = new Date().getTime();
  const diffTime = due - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export interface DisputeContextType {
  disputes: Dispute[];
  activeDisputeId: string | null;
  setActiveDisputeId: (id: string | null) => void;
  createDispute: (
    buyerId: string,
    buyerName: string,
    sellerId: string,
    sellerName: string,
    type: DisputeType,
    title: string,
    description: string,
    orderId?: string,
    productId?: string,
    brandId?: string,
    severity?: 'low' | 'medium' | 'high',
    priority?: 'normal' | 'urgent'
  ) => void;
  updateDisputeStatus: (id: string, newStatus: DisputeStatus, changedBy?: string, reason?: string) => void;
  assignDispute: (id: string, adminId: string, adminName: string) => void;
  addMessage: (disputeId: string, content: string, isInternal: boolean, sender?: DisputeParticipant) => void;
  addEvidence: (disputeId: string, type: DisputeEvidence['type'], url: string, description: string, uploadedBy: string) => void;
  resolveDispute: (id: string, resolutionType: ResolutionType, amount?: number, notes?: string, adminId?: string) => void;
  escalateDispute: (id: string, reason: string, adminId?: string) => void;
  dismissDispute: (id: string, reason: string, adminId?: string) => void;
  reopenDispute: (id: string, reason: string, adminId?: string) => void;
  getDisputesByBuyer: (buyerId: string) => Dispute[];
  getDisputesBySeller: (sellerId: string) => Dispute[];
  getOverdueDisputes: () => Dispute[];
  generateDisputeReport: (dateRange: '7d' | '30d' | '90d' | 'all') => any;
  undoLastStatusChange: (disputeId: string) => boolean;
}

const DisputeContext = createContext<DisputeContextType | undefined>(undefined);

export const useDisputes = () => {
  const context = useContext(DisputeContext);
  if (!context) throw new Error('useDisputes must be used within a DisputeProvider');
  return context;
};

// Rich Preload Dataset representing authentic Dhaka disputes
const MOCK_DISPUTES: Dispute[] = [
  {
    id: 'dsp_001',
    disputeNumber: 'DSP-2026-00101',
    status: 'open',
    type: 'late_delivery',
    severity: 'medium',
    priority: 'normal',
    buyer: { id: 'cust_001', type: 'buyer', name: 'Rashedul Bari', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', contactInfo: 'rashed.bari@gmail.com' },
    seller: { id: 'seller_techzone', type: 'seller', name: 'TechZone BD', contactInfo: 'support@techzonebd.com' },
    title: 'Express delivery charge paid but shipment delayed by 4 days',
    description: 'I ordered a premium laptop cooler package with paid express next-day home delivery to Banani, Dhaka. However, it is already 4 business days overdue and paperfly transit logistics reports stuck at central hub.',
    evidence: [
      { id: 'ev_1', type: 'order_detail', url: '#', description: 'SLA Express Checkout billing receipt', uploadedBy: 'cust_001', uploadedAt: '2026-06-25T10:00:00Z' }
    ],
    messages: [
      {
        id: 'msg_1',
        sender: { id: 'cust_001', type: 'buyer', name: 'Rashedul Bari' },
        content: 'Hi, I need this cooler desperately. Can you please check with your rider why this was not dispatched yet?',
        timestamp: '2026-06-25T10:05:00Z',
        isInternal: false
      }
    ],
    createdAt: '2026-06-25T10:00:00Z',
    lastUpdatedAt: '2026-06-25T10:05:00Z',
    dueDateForResolution: addBusinessDays(new Date('2026-06-25T10:00:00Z'), 5).toISOString(),
    statusHistory: [
      { status: 'open', timestamp: '2026-06-25T10:00:00Z', changedBy: 'System' }
    ],
    actionLog: [
      'Dispute system auto-registered complaint from customer Rashedul Bari',
      'Assigned SLA target duration: 5 Business Days'
    ]
  },
  {
    id: 'dsp_002',
    disputeNumber: 'DSP-2026-00102',
    status: 'mediation',
    type: 'product_authenticity',
    severity: 'high',
    priority: 'urgent',
    buyer: { id: 'cust_002', type: 'buyer', name: 'Sabrina Sharmin', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', contactInfo: 'sabrina.sharmin@live.com' },
    seller: { id: 'seller_stylehub', type: 'seller', name: 'StyleHub Bangladesh', contactInfo: 'sales@stylehub.com' },
    admin: 'usr_admin_001',
    orderId: 'INV-11029',
    productId: 'prod_jamdani',
    title: 'Stitching defect and color mismatch on premium Jamdani saree',
    description: 'The Tangail Jamdani delivered is of a completely different color code (pale cyan instead of the royal azure requested) and has noticeable threads hanging off the border detailing. Seller refuses to process full refund claiming handcraft minor variance.',
    evidence: [
      { id: 'ev_2', type: 'image', url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400', description: 'Defect photos showing sewing defects and pale shade', uploadedBy: 'cust_002', uploadedAt: '2026-06-26T12:00:00Z' }
    ],
    messages: [
      {
        id: 'msg_2',
        sender: { id: 'cust_002', type: 'buyer', name: 'Sabrina Sharmin' },
        content: 'This was bought for an family wedding event and I cannot use this cyan colour. Please provide a full refund.',
        timestamp: '2026-06-26T12:10:00Z',
        isInternal: false
      },
      {
        id: 'msg_3',
        sender: { id: 'seller_stylehub', type: 'seller', name: 'StyleHub Bangladesh' },
        content: 'Handloomed products exhibit minor structural variation under studio lighting. We can only approve a 15% discount coupon for next purchase, not a cash refund.',
        timestamp: '2026-06-26T14:30:00Z',
        isInternal: false
      },
      {
        id: 'msg_4',
        sender: { id: 'usr_admin_001', type: 'admin', name: 'Principal Mediator' },
        content: 'Evaluating uploaded evidence. Saree border stitching variance appears to exceed acceptable craft standards. StyleHub team, please justify why replacement cannot be routed.',
        timestamp: '2026-06-27T09:00:00Z',
        isInternal: true
      }
    ],
    createdAt: '2026-06-26T12:00:00Z',
    lastUpdatedAt: '2026-06-27T09:00:00Z',
    dueDateForResolution: addBusinessDays(new Date('2026-06-26T12:00:00Z'), 5).toISOString(),
    statusHistory: [
      { status: 'open', timestamp: '2026-06-26T12:00:00Z', changedBy: 'System' },
      { status: 'mediation', timestamp: '2026-06-27T08:30:00Z', changedBy: 'Principal Mediator' }
    ],
    actionLog: [
      'Dispute initiated by Sabrina Sharmin.',
      'SLA deadline computed based on standard service guidelines.',
      'Principal Mediator claimed case, transitioning to Mediation workflow.',
      'Internal note posted to direct seller audit actions.'
    ]
  },
  {
    id: 'dsp_003',
    disputeNumber: 'DSP-2026-00103',
    status: 'escalated',
    type: 'quality',
    severity: 'high',
    priority: 'urgent',
    buyer: { id: 'cust_003', type: 'buyer', name: 'Mahmudul Hasan', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', contactInfo: 'hasan.mahmud@gmail.com' },
    seller: { id: 'seller_walton', type: 'seller', name: 'Walton BD Official', contactInfo: 'complaints@waltonbd.com' },
    admin: 'usr_admin_002',
    title: 'AC Compressor making excessive rattling sound upon first boots',
    description: 'We bought a Walton 1.5 Ton split AC, but upon professional installation, the outdoor unit is making a 75dB clanging vibration. Walton customer support says we must pay 3,500 BDT service visitation fee because it was installed by third-party technician. This violates the 5-year replacement warranty!',
    evidence: [
      { id: 'ev_3', type: 'document', url: '#', description: 'Official Walton Warranty Card and Invoice', uploadedBy: 'cust_003', uploadedAt: '2026-06-23T15:00:00Z' }
    ],
    messages: [
      {
        id: 'msg_5',
        sender: { id: 'cust_003', type: 'buyer', name: 'Mahmudul Hasan' },
        content: 'This compressor is clearly defective out of box. Paying visitation fee on day 1 is absolute extortion.',
        timestamp: '2026-06-23T15:20:00Z',
        isInternal: false
      },
      {
        id: 'msg_6',
        sender: { id: 'seller_walton', type: 'seller', name: 'Walton BD Official' },
        content: 'Our warranty clauses restrict coverage if non-certified technicians install or open the chassis. Please contact our official hotline.',
        timestamp: '2026-06-24T11:00:00Z',
        isInternal: false
      }
    ],
    createdAt: '2026-06-23T15:00:00Z',
    lastUpdatedAt: '2026-06-27T10:15:00Z',
    dueDateForResolution: addBusinessDays(new Date('2026-06-23T15:00:00Z'), 2).toISOString(), // Escalated SLA is 2 days
    statusHistory: [
      { status: 'open', timestamp: '2026-06-23T15:00:00Z', changedBy: 'System' },
      { status: 'escalated', timestamp: '2026-06-27T10:15:00Z', changedBy: 'System' }
    ],
    actionLog: [
      'Dispute lodged for Quality concern.',
      'SLA warning triggered: unresolved within 3 business days.',
      'System auto-escalated case to management level. Resolution SLA shrunk to 2 Business Days.'
    ]
  }
];

export const DisputeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logDisputeImpact } = useTrust();
  
  const [disputes, setDisputes] = useState<Dispute[]>(() => {
    const saved = localStorage.getItem('choosify_disputes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse local storage disputes, loading defaults', e);
      }
    }
    return MOCK_DISPUTES;
  });

  const [activeDisputeId, setActiveDisputeId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('choosify_disputes', JSON.stringify(disputes));
  }, [disputes]);

  // Clean old disputes (> 1 year) out of system archive
  useEffect(() => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const unarchived = disputes.filter(d => {
      if (d.status === 'resolved' || d.status === 'closed') {
        const resolvedDate = d.resolvedAt ? new Date(d.resolvedAt) : new Date(d.lastUpdatedAt);
        return resolvedDate > oneYearAgo;
      }
      return true; // Keep all active ones
    });

    if (unarchived.length !== disputes.length) {
      setDisputes(unarchived);
    }
  }, []);

  // Actions
  const createDispute = (
    buyerId: string,
    buyerName: string,
    sellerId: string,
    sellerName: string,
    type: DisputeType,
    title: string,
    description: string,
    orderId?: string,
    productId?: string,
    brandId?: string,
    severity: 'low' | 'medium' | 'high' = 'medium',
    priority: 'normal' | 'urgent' = 'normal'
  ) => {
    const id = 'dsp_' + Math.floor(100000 + Math.random() * 900000);
    const dateStr = new Date().toISOString();
    const disputeNumber = `DSP-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const slaDays = priority === 'urgent' ? 2 : 5;
    const dueDateForResolution = addBusinessDays(new Date(), slaDays).toISOString();

    const newDispute: Dispute = {
      id,
      disputeNumber,
      status: 'open',
      type,
      severity,
      priority,
      buyer: { id: buyerId, type: 'buyer', name: buyerName },
      seller: { id: sellerId, type: 'seller', name: sellerName },
      orderId,
      productId,
      brandId,
      title,
      description,
      evidence: [],
      messages: [],
      createdAt: dateStr,
      lastUpdatedAt: dateStr,
      dueDateForResolution,
      statusHistory: [{ status: 'open', timestamp: dateStr, changedBy: 'System' }],
      actionLog: [`Dispute registered with ${slaDays} days resolution SLA.`]
    };

    setDisputes(prev => [newDispute, ...prev]);

    // Apply reputation impact
    try {
      logDisputeImpact(sellerId, sellerName, 'seller', 'created');
    } catch (e) {
      console.warn('Reputation update failed:', e);
    }
  };

  const updateDisputeStatus = (id: string, newStatus: DisputeStatus, changedBy: string = 'System', reason?: string) => {
    setDisputes(prev => prev.map(d => {
      if (d.id === id) {
        const dateStr = new Date().toISOString();
        const updatedHistory = [...d.statusHistory, { status: newStatus, timestamp: dateStr, changedBy }];
        const logMsg = `Status transitioned from ${d.status} to ${newStatus} by ${changedBy}.${reason ? ` Reason: ${reason}` : ''}`;
        
        return {
          ...d,
          status: newStatus,
          lastUpdatedAt: dateStr,
          statusHistory: updatedHistory,
          actionLog: [...d.actionLog, logMsg]
        };
      }
      return d;
    }));
  };

  const assignDispute = (id: string, adminId: string, adminName: string) => {
    setDisputes(prev => prev.map(d => {
      if (d.id === id) {
        const dateStr = new Date().toISOString();
        return {
          ...d,
          admin: adminId,
          lastUpdatedAt: dateStr,
          actionLog: [...d.actionLog, `Case assigned to administrative officer ${adminName}`]
        };
      }
      return d;
    }));
  };

  const addMessage = (disputeId: string, content: string, isInternal: boolean, sender?: DisputeParticipant) => {
    const resolvedSender: DisputeParticipant = sender || { id: 'usr_admin_001', type: 'admin', name: 'System Admin' };
    const newMessage: DisputeMessage = {
      id: 'msg_' + Math.floor(100000 + Math.random() * 900000),
      sender: resolvedSender,
      content,
      timestamp: new Date().toISOString(),
      isInternal
    };

    setDisputes(prev => prev.map(d => {
      if (d.id === disputeId) {
        return {
          ...d,
          messages: [...d.messages, newMessage],
          lastUpdatedAt: new Date().toISOString()
        };
      }
      return d;
    }));
  };

  const addEvidence = (disputeId: string, type: DisputeEvidence['type'], url: string, description: string, uploadedBy: string) => {
    const newEvidence: DisputeEvidence = {
      id: 'ev_' + Math.floor(100000 + Math.random() * 900000),
      type,
      url,
      description,
      uploadedBy,
      uploadedAt: new Date().toISOString()
    };

    setDisputes(prev => prev.map(d => {
      if (d.id === disputeId) {
        return {
          ...d,
          evidence: [...d.evidence, newEvidence],
          lastUpdatedAt: new Date().toISOString(),
          actionLog: [...d.actionLog, `New evidence added of type ${type} uploaded by ${uploadedBy}`]
        };
      }
      return d;
    }));
  };

  const resolveDispute = (id: string, resolutionType: ResolutionType, amount?: number, notes?: string, adminId: string = 'usr_admin_001') => {
    setDisputes(prev => prev.map(d => {
      if (d.id === id) {
        const dateStr = new Date().toISOString();
        const logMsg = `Dispute resolved on ${dateStr} by Admin with resolution type: ${resolutionType}.${notes ? ` Notes: ${notes}` : ''}`;
        
        // Link resolution to reputation engines
        try {
          if (resolutionType === 'refund_full' || resolutionType === 'refund_partial' || resolutionType === 'credit') {
            logDisputeImpact(d.seller.id, d.seller.name, 'seller', 'resolved_against');
          } else {
            logDisputeImpact(d.seller.id, d.seller.name, 'seller', 'dismissed');
          }
        } catch (e) {
          console.warn('Resolution reputation impact dispatch failed', e);
        }

        return {
          ...d,
          status: 'resolved',
          resolutionType,
          resolutionAmount: amount,
          resolutionNotes: notes,
          resolvedAt: dateStr,
          resolvedBy: adminId,
          lastUpdatedAt: dateStr,
          statusHistory: [...d.statusHistory, { status: 'resolved', timestamp: dateStr, changedBy: adminId }],
          actionLog: [...d.actionLog, logMsg]
        };
      }
      return d;
    }));
  };

  const escalateDispute = (id: string, reason: string, adminId: string = 'usr_admin_001') => {
    setDisputes(prev => prev.map(d => {
      if (d.id === id) {
        const dateStr = new Date().toISOString();
        const escalatedDueDate = addBusinessDays(new Date(), 2).toISOString(); // Shrunk to 2 days
        
        try {
          logDisputeImpact(d.seller.id, d.seller.name, 'seller', 'escalated');
        } catch (e) {
          console.warn('Escalation reputation impact dispatch failed', e);
        }

        return {
          ...d,
          status: 'escalated',
          priority: 'urgent',
          dueDateForResolution: escalatedDueDate,
          lastUpdatedAt: dateStr,
          statusHistory: [...d.statusHistory, { status: 'escalated', timestamp: dateStr, changedBy: adminId }],
          actionLog: [...d.actionLog, `Case escalated to managerial level. Reason: ${reason}`]
        };
      }
      return d;
    }));
  };

  const dismissDispute = (id: string, reason: string, adminId: string = 'usr_admin_001') => {
    setDisputes(prev => prev.map(d => {
      if (d.id === id) {
        const dateStr = new Date().toISOString();
        try {
          logDisputeImpact(d.seller.id, d.seller.name, 'seller', 'dismissed');
        } catch (e) {
          console.warn('Dismissal reputation impact dispatch failed', e);
        }

        return {
          ...d,
          status: 'closed',
          resolutionType: 'dismiss',
          resolutionNotes: reason,
          resolvedAt: dateStr,
          resolvedBy: adminId,
          lastUpdatedAt: dateStr,
          statusHistory: [...d.statusHistory, { status: 'closed', timestamp: dateStr, changedBy: adminId }],
          actionLog: [...d.actionLog, `Dispute dismissed by administrative decision: "${reason}"`]
        };
      }
      return d;
    }));
  };

  const reopenDispute = (id: string, reason: string, adminId: string = 'usr_admin_001') => {
    setDisputes(prev => prev.map(d => {
      if (d.id === id) {
        const dateStr = new Date().toISOString();
        const renewedDueDate = addBusinessDays(new Date(), 3).toISOString();
        return {
          ...d,
          status: 'open',
          dueDateForResolution: renewedDueDate,
          lastUpdatedAt: dateStr,
          statusHistory: [...d.statusHistory, { status: 'open', timestamp: dateStr, changedBy: adminId }],
          actionLog: [...d.actionLog, `Dispute reopened due to newly discovered facts: "${reason}"`]
        };
      }
      return d;
    }));
  };

  const undoLastStatusChange = (disputeId: string): boolean => {
    let success = false;
    setDisputes(prev => prev.map(d => {
      if (d.id === disputeId && d.statusHistory.length > 1) {
        // Only allow undoing if within 1 hour
        const lastChange = d.statusHistory[d.statusHistory.length - 1];
        const changeTime = new Date(lastChange.timestamp).getTime();
        const now = new Date().getTime();
        
        if (now - changeTime < 60 * 60 * 1000) { // 1 hour
          const newHistory = [...d.statusHistory];
          newHistory.pop(); // Remove latest
          const previousStatus = newHistory[newHistory.length - 1].status;
          
          success = true;
          return {
            ...d,
            status: previousStatus,
            lastUpdatedAt: new Date().toISOString(),
            statusHistory: newHistory,
            actionLog: [...d.actionLog, `Admin reverted the last status transition to ${previousStatus} successfully`]
          };
        }
      }
      return d;
    }));
    return success;
  };

  const getDisputesByBuyer = (buyerId: string) => {
    return disputes.filter(d => d.buyer.id === buyerId);
  };

  const getDisputesBySeller = (sellerId: string) => {
    return disputes.filter(d => d.seller.id === sellerId);
  };

  const getOverdueDisputes = () => {
    const now = new Date();
    return disputes.filter(d => {
      if (d.status === 'resolved' || d.status === 'closed') return false;
      return new Date(d.dueDateForResolution) < now;
    });
  };

  const generateDisputeReport = (dateRange: '7d' | '30d' | '90d' | 'all') => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
    const cutOff = new Date();
    cutOff.setDate(cutOff.getDate() - days);

    const relevant = disputes.filter(d => new Date(d.createdAt) >= cutOff);
    
    // Average resolution time (in milliseconds)
    const resolved = relevant.filter(d => d.status === 'resolved' || d.status === 'closed');
    const avgResTimeMs = resolved.length > 0 
      ? resolved.reduce((acc, d) => {
          const start = new Date(d.createdAt).getTime();
          const end = d.resolvedAt ? new Date(d.resolvedAt).getTime() : new Date(d.lastUpdatedAt).getTime();
          return acc + (end - start);
        }, 0) / resolved.length
      : 0;
    
    const avgResDays = (avgResTimeMs / (1000 * 60 * 60 * 24)).toFixed(1);

    // Common types breakdown
    const typeCount: Record<string, number> = {};
    relevant.forEach(d => {
      typeCount[d.type] = (typeCount[d.type] || 0) + 1;
    });

    // Resolution rates
    const resolutionTypes: Record<string, number> = {};
    resolved.forEach(d => {
      if (d.resolutionType) {
        resolutionTypes[d.resolutionType] = (resolutionTypes[d.resolutionType] || 0) + 1;
      }
    });

    // Dispute rates by seller
    const sellerRates: Record<string, { name: string, count: number }> = {};
    relevant.forEach(d => {
      if (!sellerRates[d.seller.id]) {
        sellerRates[d.seller.id] = { name: d.seller.name, count: 0 };
      }
      sellerRates[d.seller.id].count++;
    });

    const topSellers = Object.values(sellerRates)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCount: relevant.length,
      resolvedCount: resolved.length,
      activeCount: relevant.length - resolved.length,
      avgResolutionDays: resolved.length > 0 ? avgResDays : 'N/A',
      typeBreakdown: Object.keys(typeCount).map(k => ({ name: k.replace('_', ' '), value: typeCount[k] })),
      resolutionBreakdown: Object.keys(resolutionTypes).map(k => ({ name: k.replace('_', ' '), value: resolutionTypes[k] })),
      topTroublesomeSellers: topSellers,
    };
  };

  // Automated Escalation / Warnings check
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setDisputes(prev => prev.map(d => {
        if (d.status !== 'resolved' && d.status !== 'closed' && d.status !== 'escalated') {
          const dueDate = new Date(d.dueDateForResolution);
          if (now > dueDate) {
            const dateStr = now.toISOString();
            return {
              ...d,
              status: 'escalated',
              priority: 'urgent',
              lastUpdatedAt: dateStr,
              statusHistory: [...d.statusHistory, { status: 'escalated', timestamp: dateStr, changedBy: 'Automated SLA Engine' }],
              actionLog: [...d.actionLog, 'System automated escalation rule executed: Dispute exceeded target SLA threshold. Recomputed SLA to Urgent Priority (2 Days).']
            };
          }
        }
        return d;
      }));
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <DisputeContext.Provider value={{
      disputes,
      activeDisputeId,
      setActiveDisputeId,
      createDispute,
      updateDisputeStatus,
      assignDispute,
      addMessage,
      addEvidence,
      resolveDispute,
      escalateDispute,
      dismissDispute,
      reopenDispute,
      getDisputesByBuyer,
      getDisputesBySeller,
      getOverdueDisputes,
      generateDisputeReport,
      undoLastStatusChange
    }}>
      {children}
    </DisputeContext.Provider>
  );
};
