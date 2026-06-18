import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  role: string;
  timestamp: string;
  actionType: 'entry_created' | 'entry_edited' | 'entry_deleted' | 'attachment_added' | 'cashbook_accessed' | 'report_generated' | 'lock_status_changed';
  details: string;
  beforeState?: string;
  afterState?: string;
}

export interface CashBookEntry {
  id: string;
  type: 'Cash In' | 'Cash Out';
  amount: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  category: string;
  contactName: string;
  remarks: string;
  paymentMode: 'bKash' | 'Nagad' | 'Cash' | 'Bank Transfer';
  attachments: string[]; // Mock file names or Google Drive urls
  createdBy: { id: string; name: string; role: string };
  lastEditedBy?: { id: string; name: string; role: string };
  deleted?: boolean; // Soft delete
}

export interface CashBook {
  userId: string;
  userName: string;
  role: 'seller' | 'creator' | 'admin' | 'super_admin';
  businessName: string;
  currency: 'BDT';
  isLocked: boolean;
}

interface CashBookContextType {
  cashbooks: Record<string, CashBook>;
  entries: Record<string, CashBookEntry[]>;
  auditLogs: AuditLog[];
  addEntry: (cashbookId: string, entry: Omit<CashBookEntry, 'id' | 'createdBy' | 'deleted'>) => void;
  editEntry: (cashbookId: string, entryId: string, entry: Partial<Omit<CashBookEntry, 'id' | 'createdBy'>>) => void;
  deleteEntry: (cashbookId: string, entryId: string) => void;
  toggleLock: (cashbookId: string) => void;
  createCashBook: (userId: string, userName: string, role: string, businessName: string) => void;
  logAudit: (actionType: AuditLog['actionType'], details: string, beforeState?: string, afterState?: string) => void;
  exportReport: (cashbookId: string, format: 'PDF' | 'CSV', reportRange: string) => void;
}

const CashBookContext = createContext<CashBookContextType | undefined>(undefined);

export const useCashBook = () => {
  const context = useContext(CashBookContext);
  if (!context) throw new Error('useCashBook must be used within a CashBookProvider');
  return context;
};

// Initial data seeds for a beautiful realistic experience
const seedCashbooks: Record<string, CashBook> = {
  'seller_001': {
    userId: 'seller_001',
    userName: 'Rahim Uddin',
    role: 'seller',
    businessName: 'Aarong Premium Outlet',
    currency: 'BDT',
    isLocked: false
  },
  'creator_001': {
    userId: 'creator_001',
    userName: 'Sumaiya Akter',
    role: 'creator',
    businessName: 'Sumaiya Lifestyle Vlogs',
    currency: 'BDT',
    isLocked: false
  },
  'admin_002': {
    userId: 'admin_002',
    userName: 'Tanvir Hossain',
    role: 'admin',
    businessName: 'Choosify Platform Admin',
    currency: 'BDT',
    isLocked: false
  }
};

const seedEntries: Record<string, CashBookEntry[]> = {
  'seller_001': [
    {
      id: 'tx_s1',
      type: 'Cash In',
      amount: 45000,
      date: '2026-06-16',
      time: '11:30 AM',
      category: 'Sales',
      contactName: 'Sumaiya Akter',
      remarks: 'Bulk purchase of Jamdani Sarees',
      paymentMode: 'Bank Transfer',
      attachments: ['https://drive.google.com/open?id=jamdani_invoice_09a'],
      createdBy: { id: 'seller_001', name: 'Rahim Uddin', role: 'seller' }
    },
    {
      id: 'tx_s2',
      type: 'Cash Out',
      amount: 15000,
      date: '2026-06-16',
      time: '02:15 PM',
      category: 'Inventory',
      contactName: 'Karika Weaving Hub',
      remarks: 'Advanced payment for handloom fabrics thread supply',
      paymentMode: 'bKash',
      attachments: ['https://drive.google.com/open?id=bkash_receipt_tx152'],
      createdBy: { id: 'seller_001', name: 'Rahim Uddin', role: 'seller' }
    },
    {
      id: 'tx_s3',
      type: 'Cash In',
      amount: 28000,
      date: '2026-06-17',
      time: '10:05 AM',
      category: 'Sales',
      contactName: 'Kabir Ahmed',
      remarks: 'Wholesale retail consignment clearance',
      paymentMode: 'Nagad',
      attachments: [],
      createdBy: { id: 'seller_001', name: 'Rahim Uddin', role: 'seller' }
    },
    {
      id: 'tx_s4',
      type: 'Cash Out',
      amount: 8500,
      date: '2026-06-17',
      time: '04:50 PM',
      category: 'Marketing',
      contactName: 'Choosify Promos',
      remarks: 'Paid for sponsored promotion of Summer Edition',
      paymentMode: 'Cash',
      attachments: ['https://drive.google.com/open?id=payment_cash_voucher_0991'],
      createdBy: { id: 'seller_001', name: 'Rahim Uddin', role: 'seller' }
    },
    {
      id: 'tx_s5',
      type: 'Cash Out',
      amount: 12000,
      date: '2026-06-18',
      time: '09:15 AM',
      category: 'Utilities',
      contactName: 'DESCO Electricity',
      remarks: 'Office & Showroom electricity bill June 2026',
      paymentMode: 'Bank Transfer',
      attachments: ['https://drive.google.com/open?id=electricity_bill_desco_011'],
      createdBy: { id: 'seller_001', name: 'Rahim Uddin', role: 'seller' }
    }
  ],
  'creator_001': [
    {
      id: 'tx_c1',
      type: 'Cash In',
      amount: 60000,
      date: '2026-06-15',
      time: '03:10 PM',
      category: 'Sponsorship',
      contactName: 'Apex Footwear BD',
      remarks: 'Sponsorship payout for Eid Collection Vlog Integration',
      paymentMode: 'Bank Transfer',
      attachments: ['https://drive.google.com/open?id=apex_sponsorship_agreement'],
      createdBy: { id: 'creator_001', name: 'Sumaiya Akter', role: 'creator' }
    },
    {
      id: 'tx_c2',
      type: 'Cash Out',
      amount: 5000,
      date: '2026-06-16',
      time: '12:00 PM',
      category: 'Travel',
      contactName: 'Pathao Ride Services',
      remarks: 'Shoot transport for outfit travel vlogs around Dhaka',
      paymentMode: 'bKash',
      attachments: [],
      createdBy: { id: 'creator_001', name: 'Sumaiya Akter', role: 'creator' }
    },
    {
      id: 'tx_c3',
      type: 'Cash In',
      amount: 15300,
      date: '2026-06-17',
      time: '06:30 PM',
      category: 'Commission',
      contactName: 'Choosify Affiliate',
      remarks: 'Affiliate link referrals commission payout for June week 2',
      paymentMode: 'Nagad',
      attachments: ['https://drive.google.com/open?id=choosify_affiliate_report_02'],
      createdBy: { id: 'creator_001', name: 'Sumaiya Akter', role: 'creator' }
    },
    {
      id: 'tx_c4',
      type: 'Cash Out',
      amount: 18000,
      date: '2026-06-18',
      time: '11:00 AM',
      category: 'Marketing',
      contactName: 'Facebook Ad Desk',
      remarks: 'Boosting Sumaiya Vlog page posts to regional target segments',
      paymentMode: 'Bank Transfer',
      attachments: ['https://drive.google.com/open?id=invoice_fb_6615b'],
      createdBy: { id: 'creator_001', name: 'Sumaiya Akter', role: 'creator' }
    }
  ],
  'admin_002': [
    {
      id: 'tx_a1',
      type: 'Cash In',
      amount: 120000,
      date: '2026-06-15',
      time: '09:00 AM',
      category: 'Commission',
      contactName: 'System Sales',
      remarks: 'Compiled weekly sales commission platform cuts',
      paymentMode: 'Bank Transfer',
      attachments: [],
      createdBy: { id: 'admin_002', name: 'Tanvir Hossain', role: 'admin' }
    },
    {
      id: 'tx_a2',
      type: 'Cash Out',
      amount: 30000,
      date: '2026-06-16',
      time: '05:00 PM',
      category: 'Salary',
      contactName: 'Kazi Farhan',
      remarks: 'Partial support agent incentive payouts',
      paymentMode: 'bKash',
      attachments: [],
      createdBy: { id: 'admin_002', name: 'Tanvir Hossain', role: 'admin' }
    }
  ]
};

const seedAudit: AuditLog[] = [
  {
    id: 'log_01',
    userId: 'system',
    userName: 'Choosify System Engine',
    role: 'system',
    timestamp: '2026-06-15T09:00:00Z',
    actionType: 'entry_created',
    details: 'System initialized seeds and accounts structure across Multi-Role Ledger platform assets successfully.'
  }
];

export const CashBookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  
  const [cashbooks, setCashbooks] = useState<Record<string, CashBook>>(() => {
    const saved = localStorage.getItem('choosify_cashbooks');
    return saved ? JSON.parse(saved) : seedCashbooks;
  });

  const [entries, setEntries] = useState<Record<string, CashBookEntry[]>>(() => {
    const saved = localStorage.getItem('choosify_cashbook_entries');
    return saved ? JSON.parse(saved) : seedEntries;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('choosify_cashbook_audit');
    return saved ? JSON.parse(saved) : seedAudit;
  });

  useEffect(() => {
    localStorage.setItem('choosify_cashbooks', JSON.stringify(cashbooks));
  }, [cashbooks]);

  useEffect(() => {
    localStorage.setItem('choosify_cashbook_entries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('choosify_cashbook_audit', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const logAudit = (actionType: AuditLog['actionType'], details: string, beforeState?: string, afterState?: string) => {
    const actorId = profile?.id || 'guest';
    const actorName = profile?.displayName || 'Anonymous Guest';
    const actorRole = profile?.role || 'visitor';

    const newLog: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      userId: actorId,
      userName: actorName,
      role: actorRole,
      timestamp: new Date().toISOString(),
      actionType,
      details,
      beforeState,
      afterState
    };

    setAuditLogs(prev => [newLog, ...prev]);
  };

  const createCashBook = (userId: string, userName: string, role: string, businessName: string) => {
    if (cashbooks[userId]) return;

    const newCB: CashBook = {
      userId,
      userName,
      role: role as CashBook['role'],
      businessName: businessName || `${userName}'s Workspace`,
      currency: 'BDT',
      isLocked: false
    };

    setCashbooks(prev => ({ ...prev, [userId]: newCB }));
    setEntries(prev => ({ ...prev, [userId]: [] }));
    logAudit('entry_created', `Created a new CashBook ledger for ${userName} (${role}) - Business: ${newCB.businessName}`);
  };

  const addEntry = (cashbookId: string, entry: Omit<CashBookEntry, 'id' | 'createdBy' | 'deleted'>) => {
    const cb = cashbooks[cashbookId];
    if (cb?.isLocked) {
      throw new Error("This CashBook is locked by system administrators and cannot accept any modifications.");
    }

    const actorId = profile?.id || 'guest';
    const actorName = profile?.displayName || 'Anonymous Guest';
    const actorRole = profile?.role || 'visitor';

    const newEntry: CashBookEntry = {
      ...entry,
      id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      createdBy: { id: actorId, name: actorName, role: actorRole }
    };

    setEntries(prev => {
      const list = prev[cashbookId] || [];
      return {
        ...prev,
        [cashbookId]: [newEntry, ...list]
      };
    });

    logAudit('entry_created', `Added ${newEntry.type} entry of ৳${newEntry.amount.toLocaleString('en-US')} to CashBook ${cb?.userName || cashbookId} - Category: ${newEntry.category}`);
  };

  const editEntry = (cashbookId: string, entryId: string, updatedData: Partial<Omit<CashBookEntry, 'id' | 'createdBy'>>) => {
    const cb = cashbooks[cashbookId];
    if (cb?.isLocked) {
      throw new Error("This CashBook is locked by system administrators and cannot accept edits.");
    }

    const actorId = profile?.id || 'guest';
    const actorName = profile?.displayName || 'Anonymous Guest';
    const actorRole = profile?.role || 'visitor';

    let original: CashBookEntry | undefined;

    setEntries(prev => {
      const list = prev[cashbookId] || [];
      const updatedList = list.map(item => {
        if (item.id === entryId) {
          original = { ...item };
          return {
            ...item,
            ...updatedData,
            lastEditedBy: { id: actorId, name: actorName, role: actorRole }
          };
        }
        return item;
      });
      return {
        ...prev,
        [cashbookId]: updatedList
      };
    });

    if (original) {
      logAudit(
        'entry_edited',
        `Edited entry ID ${entryId} inside CashBook ${cb?.userName || cashbookId} - Amount updated from ৳${original.amount.toLocaleString()} to ৳${(updatedData.amount ?? original.amount).toLocaleString()}`,
        JSON.stringify(original),
        JSON.stringify({ ...original, ...updatedData })
      );
    }
  };

  const deleteEntry = (cashbookId: string, entryId: string) => {
    const cb = cashbooks[cashbookId];
    if (cb?.isLocked) {
      throw new Error("This CashBook is locked by system administrators and cannot accept deletions.");
    }

    let target: CashBookEntry | undefined;

    setEntries(prev => {
      const list = prev[cashbookId] || [];
      const updatedList = list.map(item => {
        if (item.id === entryId) {
          target = { ...item };
          return { ...item, deleted: true }; // Soft deletion
        }
        return item;
      });
      return {
        ...prev,
        [cashbookId]: updatedList
      };
    });

    if (target) {
      logAudit('entry_deleted', `Deleted entry ID ${entryId} (৳${target.amount.toLocaleString()} ${target.type}) in CashBook ${cb?.userName || cashbookId}`, JSON.stringify(target));
    }
  };

  const toggleLock = (cashbookId: string) => {
    const cb = cashbooks[cashbookId];
    if (!cb) return;

    const newLockStatus = !cb.isLocked;

    setCashbooks(prev => ({
      ...prev,
      [cashbookId]: { ...prev[cashbookId], isLocked: newLockStatus }
    }));

    logAudit('lock_status_changed', `Changed CashBook lock status for ${cb.userName} to ${newLockStatus ? 'LOCKED' : 'UNLOCKED'}`);
  };

  const exportReport = (cashbookId: string, format: 'PDF' | 'CSV', reportRange: string) => {
    const cb = cashbooks[cashbookId];
    logAudit('report_generated', `Generated and downloaded daily/monthly consolidated financial CashBook report in ${format} format for user ${cb?.userName || cashbookId} (Period: ${reportRange})`);
  };

  return (
    <CashBookContext.Provider value={{
      cashbooks,
      entries,
      auditLogs,
      addEntry,
      editEntry,
      deleteEntry,
      toggleLock,
      createCashBook,
      logAudit,
      exportReport
    }}>
      {children}
    </CashBookContext.Provider>
  );
};
