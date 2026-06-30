import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth, UserRole } from '../../contexts/AuthContext';
import { useCashBook } from '../../contexts/CashBookContext';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  Download, 
  Minus,
  Lock, 
  Unlock, 
  FileText, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  ExternalLink,
  History,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building2,
  User,
  MoreVertical,
  Plus,
  HelpCircle,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  X,
  FileDown,
  Check,
  CheckSquare,
  ChevronLeft,
  Settings,
  Share2
} from 'lucide-react';
import { 
  ResponsiveContainer,
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

import { useOrders } from '../../contexts/OrdersContext';

export interface Book {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  role: string;
}

export interface BookEntry {
  id: string;
  bookId: string;
  type: 'Cash In' | 'Cash Out';
  amount: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  category: string;
  contactName: string;
  remarks: string;
  paymentMode: 'bKash' | 'Nagad' | 'Cash' | 'Bank Transfer';
  attachments: string[]; // List of file names
  createdBy?: { id: string; name: string; role: string };
  lastEditedBy?: { id: string; name: string; role: string };
}

// Pre-seeded multi-book datasets by User Id
const initialBooksSeed: Book[] = [
  // Rahim Uddin (Seller)
  {
    id: 'book_s1',
    name: 'Aarong Outlet Sales',
    emoji: '🛒',
    color: '#F97316',
    createdAt: '2026-06-10T11:00:00Z',
    updatedAt: '2026-06-18T09:15:00Z',
    userId: 'seller_001',
    role: 'seller'
  },
  {
    id: 'book_s2',
    name: 'Weaving Hub Handloom Supplies',
    emoji: '🧵',
    color: '#10B981',
    createdAt: '2026-06-12T14:30:00Z',
    updatedAt: '2026-06-17T16:50:00Z',
    userId: 'seller_001',
    role: 'seller'
  },
  {
    id: 'book_s3',
    name: 'Dhaka Expo Sponsor Promo',
    emoji: '📢',
    color: '#3B82F6',
    createdAt: '2026-06-14T09:00:00Z',
    updatedAt: '2026-06-16T12:00:00Z',
    userId: 'seller_001',
    role: 'seller'
  },

  // Sumaiya Akter (Creator)
  {
    id: 'book_c1',
    name: 'Sumaiya Lifestyle Sponsorships',
    emoji: '🎥',
    color: '#6366F1',
    createdAt: '2026-06-11T10:00:00Z',
    updatedAt: '2026-06-18T11:00:00Z',
    userId: 'creator_001',
    role: 'creator'
  },
  {
    id: 'book_c2',
    name: 'Amari Affiliate Referral Income',
    emoji: '🛍️',
    color: '#EC4899',
    createdAt: '2026-06-12T09:00:00Z',
    updatedAt: '2026-06-17T18:30:00Z',
    userId: 'creator_001',
    role: 'creator'
  },

  // Tanvir Hossain (Admin)
  {
    id: 'book_a1',
    name: 'Choosify Platform Commissions',
    emoji: '💼',
    color: '#14B8A6',
    createdAt: '2026-06-12T08:00:00Z',
    updatedAt: '2026-06-18T09:00:00Z',
    userId: 'admin_002',
    role: 'admin'
  },
  {
    id: 'book_a2',
    name: 'Creator Incentive Subsidies',
    emoji: '✨',
    color: '#8B5CF6',
    createdAt: '2026-06-13T10:00:00Z',
    updatedAt: '2026-06-16T17:00:00Z',
    userId: 'admin_002',
    role: 'admin'
  }
];

const initialEntriesSeed: Record<string, BookEntry[]> = {
  'book_s1': [
    {
      id: 'bt_s1_1',
      bookId: 'book_s1',
      type: 'Cash In',
      amount: 45000,
      date: '2026-06-16',
      time: '11:05 AM',
      category: 'Sales',
      contactName: 'Sumaiya Akter',
      remarks: 'Bulk purchase of Jamdani sarees for festival review',
      paymentMode: 'Bank Transfer',
      attachments: ['jamdani_invoice_09a.pdf']
    },
    {
      id: 'bt_s1_2',
      bookId: 'book_s1',
      type: 'Cash Out',
      amount: 15000,
      date: '2026-06-16',
      time: '02:15 PM',
      category: 'Inventory',
      contactName: 'Karika Weaving Hub',
      remarks: 'Advanced payment for handloom fabrics thread supply',
      paymentMode: 'bKash',
      attachments: ['receipt_tx152.png']
    },
    {
      id: 'bt_s1_3',
      bookId: 'book_s1',
      type: 'Cash In',
      amount: 28000,
      date: '2026-06-17',
      time: '10:05 AM',
      category: 'Sales',
      contactName: 'Kabir Ahmed',
      remarks: 'Consignment clearance sales invoice #99',
      paymentMode: 'Nagad',
      attachments: []
    },
    {
      id: 'bt_s1_4',
      bookId: 'book_s1',
      type: 'Cash Out',
      amount: 12000,
      date: '2026-06-18',
      time: '09:15 AM',
      category: 'Utilities',
      contactName: 'DESCO Electricity',
      remarks: 'Office & Showroom electricity bill June 2026',
      paymentMode: 'Bank Transfer',
      attachments: ['desco_bill_01.pdf']
    }
  ],
  'book_s2': [
    {
      id: 'bt_s2_1',
      bookId: 'book_s2',
      type: 'Cash Out',
      amount: 35000,
      date: '2026-06-15',
      time: '04:20 PM',
      category: 'Raw Materials',
      contactName: 'Tangail Cotton Mills',
      remarks: 'Procured 150kg high-quality Egyptian cotton reels',
      paymentMode: 'Bank Transfer',
      attachments: ['cotton_mills_receipt.pdf']
    },
    {
      id: 'bt_s2_2',
      bookId: 'book_s2',
      type: 'Cash In',
      amount: 52000,
      date: '2026-06-17',
      time: '03:10 PM',
      category: 'Consignment Refunding',
      contactName: 'RFL Craft Depot',
      remarks: 'Consignment clearance surplus refund transfer',
      paymentMode: 'Nagad',
      attachments: []
    }
  ],
  'book_s3': [
    {
      id: 'bt_s3_1',
      bookId: 'book_s3',
      type: 'Cash Out',
      amount: 8500,
      date: '2026-06-16',
      time: '04:50 PM',
      category: 'Marketing',
      contactName: 'Choosify Promos',
      remarks: 'Sponsored social feed highlight of Summer Edition',
      paymentMode: 'Cash',
      attachments: []
    }
  ],
  'book_c1': [
    {
      id: 'bt_c1_1',
      bookId: 'book_c1',
      type: 'Cash In',
      amount: 60000,
      date: '2026-06-15',
      time: '03:10 PM',
      category: 'Sponsorship',
      contactName: 'Apex Footwear BD',
      remarks: 'Sponsorship payout for Eid Collection Vlog Integration',
      paymentMode: 'Bank Transfer',
      attachments: ['apex_agreement_signed.pdf']
    },
    {
      id: 'bt_c1_2',
      bookId: 'book_c1',
      type: 'Cash Out',
      amount: 5000,
      date: '2026-06-16',
      time: '12:00 PM',
      category: 'Travel & Food',
      contactName: 'Pathao Rides',
      remarks: 'Shoot transport for outfit travel vlogs around Dhaka',
      paymentMode: 'bKash',
      attachments: []
    },
    {
      id: 'bt_c1_3',
      bookId: 'book_c1',
      type: 'Cash Out',
      amount: 18000,
      date: '2026-06-18',
      time: '11:00 AM',
      category: 'Marketing',
      contactName: 'Facebook Ad Desk',
      remarks: 'Boosting Sumaiya Vlog page regional segments campaign',
      paymentMode: 'Bank Transfer',
      attachments: ['fb_boosting_receipt.png']
    }
  ],
  'book_c2': [
    {
      id: 'bt_c2_1',
      bookId: 'book_c2',
      type: 'Cash In',
      amount: 15300,
      date: '2026-06-17',
      time: '06:30 PM',
      category: 'Commission',
      contactName: 'Choosify Affiliate Service',
      remarks: 'Affiliate link referrals commission payout for June week 2',
      paymentMode: 'Nagad',
      attachments: ['commission_invoice.pdf']
    }
  ],
  'book_a1': [
    {
      id: 'bt_a1_1',
      bookId: 'book_a1',
      type: 'Cash In',
      amount: 120000,
      date: '2026-06-15',
      time: '09:00 AM',
      category: 'Commision Cut',
      contactName: 'System Sales Consolidate',
      remarks: 'Compiled weekly platform transaction sales commission cuts',
      paymentMode: 'Bank Transfer',
      attachments: []
    },
    {
      id: 'bt_a1_2',
      bookId: 'book_a1',
      type: 'Cash Out',
      amount: 30000,
      date: '2026-06-16',
      time: '05:00 PM',
      category: 'Salaries',
      contactName: 'Kazi Farhan',
      remarks: 'Support agent monthly incentive payout bonus',
      paymentMode: 'bKash',
      attachments: []
    }
  ],
  'book_a2': [
    {
      id: 'bt_a2_1',
      bookId: 'book_a2',
      type: 'Cash Out',
      amount: 25000,
      date: '2026-06-16',
      time: '11:30 AM',
      category: 'Creator Promo',
      contactName: 'Sumaiya Akter Promo Offer',
      remarks: 'Affiliate onboarding promotion prize matching pool bonus',
      paymentMode: 'Bank Transfer',
      attachments: []
    }
  ]
};

export default function CashBookHub() {
  const { profile } = useAuth();
  const { orders: ordersList } = useOrders();
  const location = useLocation();
  const navigate = useNavigate();
  const { bookId } = useParams<{ bookId?: string }>();

  const currentUserId = profile?.id || 'guest';
  const role = profile?.role || 'super_admin';
  const isAdmin = role === 'admin' || role === 'super_admin';

  // State Management
  const [books, setBooks] = useState<Book[]>([]);
  const [entries, setEntries] = useState<Record<string, BookEntry[]>>({});
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(() => {
    const saved = localStorage.getItem('choosify_drive_connected');
    return saved !== 'false'; // Default to true (Connected)
  });
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [syncingProgress, setSyncingProgress] = useState<number | null>(null);

  // New Book Modal
  const [isNewBookModalOpen, setIsNewBookModalOpen] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [newBookEmoji, setNewBookEmoji] = useState('📒');
  const [newBookColor, setNewBookColor] = useState('#F97316');

  // Book Deletion state
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteConfirmError, setDeleteConfirmError] = useState('');

  // Custom Categories state
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('choosify_cashbook_custom_cats') || '[]');
    } catch {
      return [];
    }
  });
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);

  // Bulk actions state
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [showCopyPanel, setShowCopyPanel] = useState(false);

  // New/Edit Entry Modal
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryModalType, setEntryModalType] = useState<'Cash In' | 'Cash Out'>('Cash In');
  const [editingEntry, setEditingEntry] = useState<BookEntry | null>(null);
  
  // Entry Form Fields
  const [formAmount, setFormAmount] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPaymentMode, setFormPaymentMode] = useState<BookEntry['paymentMode']>('Bank Transfer');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formAttachmentName, setFormAttachmentName] = useState('');
  const [formAttachments, setFormAttachments] = useState<string[]>([]);

  // Entry Detail Modal
  const [selectedEntry, setSelectedEntry] = useState<BookEntry | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Dash filters
  const [dashboardSort, setDashboardSort] = useState<'name' | 'updated' | 'entries'>('updated');
  // Detail filters
  const [filterQuery, setFilterQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Cash In' | 'Cash Out'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'Bank Transfer' | 'bKash' | 'Nagad' | 'Cash'>('all');
  const [filterDateRange, setFilterDateRange] = useState({ start: '', end: '' });

  // Admin Ledger auditing scope (Which user's ledger are they currently auditing?)
  const [adminAuditingUser, setAdminAuditingUser] = useState<string>(() => {
    // defaults to Rahim Uddin
    return 'seller_001';
  });

  // Toast System
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);
  const triggerToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const DEFAULT_CATEGORIES = [
    'Sales', 'Inventory', 'Salary', 'Transport', 'Utilities',
    'Marketing', 'Rent', 'Commission', 'Sponsorship', 'Affiliate',
    'Refund', 'Tax', 'Miscellaneous', 'Loan', 'Investment',
    ...customCategories
  ];

  const CASHBOOK_ROLES = [
    { id: 'moderator_entry', label: 'Entry Level Operator', description: 'Can only log cash flows. No delete, edit, or report viewing permissions.' },
    { id: 'moderator_auditor', label: 'Internal Auditor / Accountant', description: 'Full read and review, report generating. No deletion power.' },
    { id: 'moderator_super', label: 'Co-Owner / Super Moderator', description: 'Full write, delete, export, settings toggling. Equal power.' }
  ];

  // Synchronize dynamic local state
  useEffect(() => {
    const savedBooks = localStorage.getItem('choosify_multi_books');
    const savedEntries = localStorage.getItem('choosify_multi_entries');

    if (savedBooks) {
      setBooks(JSON.parse(savedBooks));
    } else {
      setBooks(initialBooksSeed);
      localStorage.setItem('choosify_multi_books', JSON.stringify(initialBooksSeed));
    }

    if (savedEntries) {
      setEntries(JSON.parse(savedEntries));
    } else {
      setEntries(initialEntriesSeed);
      localStorage.setItem('choosify_multi_entries', JSON.stringify(initialEntriesSeed));
    }
  }, []);

  // Save changes to localStorage helper
  const handleSaveBooks = (updatedBooks: Book[]) => {
    setBooks(updatedBooks);
    localStorage.setItem('choosify_multi_books', JSON.stringify(updatedBooks));
  };

  const handleSaveAllEntries = (updatedEntries: Record<string, BookEntry[]>) => {
    setEntries(updatedEntries);
    localStorage.setItem('choosify_multi_entries', JSON.stringify(updatedEntries));
  };

  const activeUserId = isAdmin ? adminAuditingUser : currentUserId;

  // Derive relevant books based on the current user context or the admin audited user
  const userRole = currentUserId === 'creator_001' ? 'creator' : 'seller';
  const roleToShow = isAdmin ? (adminAuditingUser === 'creator_001' ? 'creator' : adminAuditingUser === 'admin_002' ? 'admin' : 'seller') : role;
  const filteredUserBooks = books.filter(b => b.userId === activeUserId);

  // Sorted books
  const sortedBooks = [...filteredUserBooks].sort((a, b) => {
    if (dashboardSort === 'name') {
      return a.name.localeCompare(b.name);
    } else if (dashboardSort === 'entries') {
      const aCount = (entries[a.id] || []).length;
      const bCount = (entries[b.id] || []).length;
      return bCount - aCount;
    } else {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  // Calculate high-level stats aggregated over all of active user's books
  const aggregatedStats = filteredUserBooks.reduce((acc, book) => {
    const bookEntries = entries[book.id] || [];
    const bookIn = bookEntries.filter(e => e.type === 'Cash In').reduce((sum, e) => sum + e.amount, 0);
    const bookOut = bookEntries.filter(e => e.type === 'Cash Out').reduce((sum, e) => sum + e.amount, 0);
    acc.totalIn += bookIn;
    acc.totalOut += bookOut;
    return acc;
  }, { totalIn: 0, totalOut: 0 });

  const aggregatedNet = aggregatedStats.totalIn - aggregatedStats.totalOut;

  // Detect active view based on path
  const isReportsView = location.pathname.endsWith('/reports');
  const isDetailView = !isReportsView && bookId && bookId !== 'reports';

  // Selected Book context
  const selectedBook = books.find(b => b.id === bookId);
  const selectedBookEntries = bookId ? (entries[bookId] || []) : [];

  // Detail filters
  const filteredBookEntries = selectedBookEntries.filter(e => {
    const matchesSearch = 
      e.contactName.toLowerCase().includes(filterQuery.toLowerCase()) ||
      e.remarks.toLowerCase().includes(filterQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(filterQuery.toLowerCase()) ||
      e.amount.toString().includes(filterQuery);

    const matchesType = filterType === 'all' || e.type === filterType;
    const matchesMode = filterMode === 'all' || e.paymentMode === filterMode;

    let matchesDate = true;
    if (filterDateRange.start) {
      matchesDate = matchesDate && e.date >= filterDateRange.start;
    }
    if (filterDateRange.end) {
      matchesDate = matchesDate && e.date <= filterDateRange.end;
    }

    return matchesSearch && matchesType && matchesMode && matchesDate;
  });

  // Calculate running balances with newest first
  // To do that, we sort oldest-first internally, calculate running, then present newest first (reverse)
  const sortedOldestFirst = [...filteredBookEntries].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.time.localeCompare(b.time);
  });

  let running = 0;
  const entriesWithRunningBalance = sortedOldestFirst.map(e => {
    if (e.type === 'Cash In') {
      running += e.amount;
    } else {
      running -= e.amount;
    }
    return { ...e, runningBalance: running };
  }).reverse(); // back to newest-first

  const activeBookIn = selectedBookEntries.filter(e => e.type === 'Cash In').reduce((sum, e) => sum + e.amount, 0);
  const activeBookOut = selectedBookEntries.filter(e => e.type === 'Cash Out').reduce((sum, e) => sum + e.amount, 0);
  const activeBookNet = activeBookIn - activeBookOut;

  // Connect Google Drive Simulator Flow
  const handleConnectProgress = () => {
    setSyncingProgress(10);
    const interval = setInterval(() => {
      setSyncingProgress(prev => {
        if (prev === null) {
          clearInterval(interval);
          return null;
        }
        if (prev >= 100) {
          clearInterval(interval);
          setIsDriveConnected(true);
          localStorage.setItem('choosify_drive_connected', 'true');
          setIsConsentModalOpen(false);
          triggerToast('Successfully authorized and connected with Google Drive. All cashbooks synchronized!', 'success');
          return null;
        }
        return prev + 25;
      });
    }, 450);
  };

  const handleDisconnectDrive = () => {
    setIsDriveConnected(false);
    localStorage.setItem('choosify_drive_connected', 'false');
    triggerToast('Google Drive integration disconnected. Cache sync restricted.', 'info');
  };

  // Book Creation Handler
  const handleCreateBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookName.trim()) {
      triggerToast('Please type a descriptive book name', 'danger');
      return;
    }

    const newBook: Book = {
      id: 'book_' + Date.now(),
      name: newBookName,
      emoji: newBookEmoji,
      color: newBookColor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: activeUserId,
      role: roleToShow
    };

    const updatedBooks = [newBook, ...books];
    handleSaveBooks(updatedBooks);

    // Initial entries record for this container
    const updatedEntries = { ...entries, [newBook.id]: [] };
    handleSaveAllEntries(updatedEntries);

    setIsNewBookModalOpen(false);
    setNewBookName('');
    triggerToast(`Created new Cashbook "${newBook.name}" successfully!`, 'success');
  };

  // Open entry creation modal
  const handleOpenEntryModal = (type: 'Cash In' | 'Cash Out', existing: BookEntry | null = null) => {
    if (existing) {
      setEditingEntry(existing);
      setFormAmount(existing.amount.toString());
      setFormContact(existing.contactName);
      setFormRemarks(existing.remarks);
      setFormCategory(existing.category);
      setFormPaymentMode(existing.paymentMode);
      setFormDate(existing.date);
      setFormTime(existing.time);
      setFormAttachments(existing.attachments || []);
    } else {
      setEditingEntry(null);
      setFormAmount('');
      setFormContact('');
      setFormRemarks('');
      setFormCategory(type === 'Cash In' ? 'Sales' : 'Inventory');
      setFormPaymentMode('Bank Transfer');
      const now = new Date();
      setFormDate(now.toISOString().split('T')[0]);
      setFormTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setFormAttachments([]);
    }
    setEntryModalType(type);
    setIsEntryModalOpen(true);
  };

  // New/Edit Entry Save Handler
  const handleSaveEntry = (e: React.FormEvent, isAddAnother: boolean = false) => {
    e.preventDefault();
    if (!bookId) return;

    if (!formAmount || parseFloat(formAmount) <= 0) {
      triggerToast('Please enter a valid amount greater than zero', 'danger');
      return;
    }

    const amt = parseFloat(formAmount);

    const isEdit = !!editingEntry;
    const entryId = isEdit ? editingEntry.id : 'entry_' + Date.now();

    const entryToSave: BookEntry = {
      id: entryId,
      bookId: bookId,
      type: entryModalType,
      amount: amt,
      date: formDate || new Date().toISOString().split('T')[0],
      time: formTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: formCategory || (entryModalType === 'Cash In' ? 'Others' : 'Expenses'),
      contactName: formContact || 'General Customer',
      remarks: formRemarks,
      paymentMode: formPaymentMode,
      attachments: formAttachments,
      createdBy: editingEntry?.createdBy || { id: profile?.id || 'system', name: profile?.displayName || profile?.name || 'System', role: profile?.role || 'seller' },
      ...(isEdit ? { lastEditedBy: { id: profile?.id || 'system', name: profile?.displayName || profile?.name || 'System', role: profile?.role || 'seller' } } : {})
    };

    const currentBookEntries = entries[bookId] || [];
    let updatedList: BookEntry[] = [];

    if (isEdit) {
      updatedList = currentBookEntries.map(e => e.id === editingEntry.id ? entryToSave : e);
    } else {
      updatedList = [entryToSave, ...currentBookEntries];
    }

    const allUpdatedEntries = { ...entries, [bookId]: updatedList };

    // Update Book updated time
    const updatedBooks = books.map(b => b.id === bookId ? { ...b, updatedAt: new Date().toISOString() } : b);
    
    handleSaveBooks(updatedBooks);
    handleSaveAllEntries(allUpdatedEntries);

    triggerToast(
      isEdit ? 'Transaction entry updated successfully.' : `Registered standard BDT ${amt.toLocaleString()} ${entryModalType}.`,
      'success'
    );

    if (isAddAnother && !isEdit) {
      // Clear fields to let them add another easily
      setFormAmount('');
      setFormContact('');
      setFormRemarks('');
      setFormAttachments([]);
    } else {
      setIsEntryModalOpen(false);
      setEditingEntry(null);
    }
  };

  // Delete transaction entry
  const handleDeleteEntry = (entryId: string) => {
    if (!bookId) return;
    const currentBookEntries = entries[bookId] || [];
    const updatedList = currentBookEntries.filter(e => e.id !== entryId);
    const allUpdatedEntries = { ...entries, [bookId]: updatedList };

    // Update book update time
    const updatedBooks = books.map(b => b.id === bookId ? { ...b, updatedAt: new Date().toISOString() } : b);
    handleSaveBooks(updatedBooks);
    handleSaveAllEntries(allUpdatedEntries);

    if (selectedEntry && selectedEntry.id === entryId) {
      setSelectedEntry(null);
    }
    triggerToast('Transaction entry has been permanently deleted.', 'info');
  };

  // Delete dynamic CashBook
  const handleDeleteBook = (targetBookId: string) => {
    // Remove the book from books list
    const updatedBooks = books.filter(b => b.id !== targetBookId);
    // Remove its entries
    const updatedEntries = { ...entries };
    delete updatedEntries[targetBookId];

    handleSaveBooks(updatedBooks);
    handleSaveAllEntries(updatedEntries);

    triggerToast('Ledger CashBook has been permanently deleted.', 'info');
    navigate('/admin/cashbook');
  };

  // Synchronize orders into CashBook
  const handleImportOrders = () => {
    if (!ordersList || ordersList.length === 0) {
      triggerToast('No platform orders available to sync.', 'danger');
      return;
    }

    const targetBookName = "Platform Sales Ledger";
    let platformBook = books.find(b => b.name === targetBookName);

    let updatedBooks = [...books];
    let targetBookId = platformBook?.id;

    if (!platformBook) {
      targetBookId = 'book_platform_' + Date.now();
      platformBook = {
        id: targetBookId,
        name: targetBookName,
        emoji: '📦',
        color: '#10B981',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: currentUserId,
        role: 'seller'
      };
      updatedBooks.push(platformBook);
    }

    const existingEntries = entries[targetBookId!] || [];
    const newEntries: BookEntry[] = ordersList.map((ord: any) => ({
      id: 'entry_order_' + ord.id,
      bookId: targetBookId!,
      type: 'Cash In',
      amount: ord.total || ord.totalPrice || 0,
      date: (ord.createdAt || new Date().toISOString()).split('T')[0],
      time: '12:00 PM',
      category: 'Sales',
      contactName: ord.buyerName || ord.customerName || 'General Buyer',
      remarks: `Platform Order #${ord.id} - status: ${ord.status || 'approved'}`,
      paymentMode: 'Bank Transfer',
      attachments: [],
      createdBy: { id: profile?.id || 'system', name: profile?.displayName || profile?.name || 'System', role: profile?.role || 'seller' }
    }));

    const filteredNewEntries = newEntries.filter(
      newE => !existingEntries.some(existingE => existingE.id === newE.id)
    );

    if (filteredNewEntries.length === 0) {
      triggerToast('All existing orders have already been synchronized with the cash book.', 'info');
      return;
    }

    const allUpdatedEntries = {
      ...entries,
      [targetBookId!]: [...filteredNewEntries, ...existingEntries]
    };

    handleSaveBooks(updatedBooks);
    handleSaveAllEntries(allUpdatedEntries);

    triggerToast(`✓ Synchronized ${filteredNewEntries.length} platform orders into "${targetBookName}".`, 'success');
    navigate(`/admin/cashbook/${targetBookId}`);
  };

  // Bulk deletion
  const handleBulkDelete = () => {
    if (!bookId) return;
    const currentBookEntries = entries[bookId] || [];
    const updatedList = currentBookEntries.filter(e => !selectedEntryIds.has(e.id));
    const allUpdatedEntries = { ...entries, [bookId]: updatedList };

    const updatedBooks = books.map(b => b.id === bookId ? { ...b, updatedAt: new Date().toISOString() } : b);
    handleSaveBooks(updatedBooks);
    handleSaveAllEntries(allUpdatedEntries);

    setSelectedEntryIds(new Set());
    triggerToast(`✓ Deleted ${selectedEntryIds.size} transaction entries.`, 'success');
  };

  // Bulk flip transaction type
  const handleBulkToggleType = () => {
    if (!bookId) return;
    const currentBookEntries = entries[bookId] || [];
    const updatedList = currentBookEntries.map(e => {
      if (selectedEntryIds.has(e.id)) {
        return { ...e, type: e.type === 'Cash In' ? 'Cash Out' : 'Cash In' as const };
      }
      return e;
    });
    const allUpdatedEntries = { ...entries, [bookId]: updatedList };
    handleSaveAllEntries(allUpdatedEntries);
    setSelectedEntryIds(new Set());
    triggerToast(`✓ Flipped transaction types for ${selectedEntryIds.size} entries.`, 'success');
  };

  // Bulk move entries
  const handleBulkMove = (targetBookId: string) => {
    if (!bookId || targetBookId === bookId) return;
    const currentBookEntries = entries[bookId] || [];
    const entriesToMove = currentBookEntries.filter(e => selectedEntryIds.has(e.id));
    const entriesToKeep = currentBookEntries.filter(e => !selectedEntryIds.has(e.id));

    const targetBookEntries = entries[targetBookId] || [];
    const updatedTargetEntries = [
      ...entriesToMove.map(e => ({ ...e, bookId: targetBookId })),
      ...targetBookEntries
    ];

    const allUpdatedEntries = {
      ...entries,
      [bookId]: entriesToKeep,
      [targetBookId]: updatedTargetEntries
    };

    handleSaveAllEntries(allUpdatedEntries);
    setSelectedEntryIds(new Set());
    setShowMovePanel(false);
    triggerToast(`✓ Moved ${entriesToMove.length} entries to targeted book.`, 'success');
  };

  // Bulk copy entries
  const handleBulkCopy = (targetBookId: string) => {
    if (!bookId) return;
    const currentBookEntries = entries[bookId] || [];
    const entriesToCopy = currentBookEntries.filter(e => selectedEntryIds.has(e.id));

    const targetBookEntries = entries[targetBookId] || [];
    const updatedTargetEntries = [
      ...entriesToCopy.map(e => ({ ...e, id: 'entry_copy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), bookId: targetBookId })),
      ...targetBookEntries
    ];

    const allUpdatedEntries = {
      ...entries,
      [targetBookId]: updatedTargetEntries
    };

    handleSaveAllEntries(allUpdatedEntries);
    setSelectedEntryIds(new Set());
    setShowCopyPanel(false);
    triggerToast(`✓ Copied ${entriesToCopy.length} entries to targeted book.`, 'success');
  };

  // Handle report downloads mockup
  const handleExportMock = (format: 'PDF' | 'EXCEL' | 'CSV', scope: string = 'Full Book') => {
    triggerToast(`Compiling data... Exporting ${scope} in ${format} format. Check downloads list!`, 'success');
  };

  // Emoji lists
  const emojis = ['📒', '🛒', '🛍️', '💼', '🧵', '🎥', '✨', '🖥️', '💸', '📦', '🏦', '🎨', '🍳'];
  const colors = ['#F97316', '#10B981', '#3B82F6', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#64748B', '#F59E0B', '#EF4444'];

  return (
    <div className="flex-1 w-full min-h-screen bg-app-bg text-app-text-primary p-6 transition-all relative font-sans leading-relaxed">
      
      {/* Toast Alert Banner */}
      {toast && (
        <div className={`fixed top-8 right-8 z-[100] flex items-center gap-3 px-5 py-4 border rounded-[5px] shadow-2xl transition-all duration-300 animate-slide-in ${
          toast.type === 'success' 
            ? 'bg-green-50 border-[#22C55E]/25 text-[#22C55E]' 
            : toast.type === 'danger' 
            ? 'bg-red-50 border-[#EF4444]/25 text-[#EF4444]' 
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <div className="text-base font-bold flex-1">{toast.message}</div>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4 shrink-0 font-bold" />
          </button>
        </div>
      )}

      {/* Admin Role Scope Header Switcher Panel */}
      {isAdmin && !isDetailView && !isReportsView && (
        <div className="mb-6 p-4 bg-app-card border border-app-border rounded-[5px] space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-app-border pb-3">
            <div>
              <div className="text-[10px] font-black text-app-accent uppercase tracking-widest flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-app-accent"></span>
                Platform Management Ledger System
              </div>
              <h3 className="text-sm font-bold text-app-text-primary mt-1">Auditing Accounts Workspace:</h3>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button 
                onClick={() => { setAdminAuditingUser('seller_001'); triggerToast('Switched to Rahim Uddin accounts and ledgers.', 'info'); }}
                className={`px-4 py-2 text-[11px] font-bold border transition-all rounded-[5px] ${
                  adminAuditingUser === 'seller_001' 
                    ? 'bg-app-accent text-white border-app-accent' 
                    : 'bg-white border-app-border text-app-text-secondary hover:bg-slate-50'
                }`}
              >
                Rahim Uddin (Seller)
              </button>
              <button 
                onClick={() => { setAdminAuditingUser('creator_001'); triggerToast('Switched to Sumaiya Akter accounts and ledgers.', 'info'); }}
                className={`px-4 py-2 text-[11px] font-bold border transition-all rounded-[5px] ${
                  adminAuditingUser === 'creator_001' 
                    ? 'bg-app-accent text-white border-app-accent' 
                    : 'bg-white border-app-border text-app-text-secondary hover:bg-slate-50'
                }`}
              >
                Sumaiya Akter (Creator)
              </button>
              <button 
                onClick={() => { setAdminAuditingUser('admin_002'); triggerToast("Switched to Tanvir Hossain personal admin account's assets.", 'info'); }}
                className={`px-4 py-2 text-[11px] font-bold border transition-all rounded-[5px] ${
                  adminAuditingUser === 'admin_002' 
                    ? 'bg-app-accent text-white border-app-accent' 
                    : 'bg-white border-app-border text-app-text-secondary hover:bg-slate-50'
                }`}
              >
                My Admin Cashbook
              </button>
            </div>
          </div>

          {/* Moderator Role Selection with Permission Matrix */}
          <div className="pt-1">
            <span className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block mb-2.5">Configure Cashbook Moderator Role for {adminAuditingUser === 'seller_001' ? 'Rahim Uddin' : adminAuditingUser === 'creator_001' ? 'Sumaiya Akter' : 'Tanvir Hossain'}:</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {CASHBOOK_ROLES.map((roleObj) => {
                const isSelected = (adminAuditingUser === 'seller_001' && roleObj.id === 'moderator_entry') ||
                                    (adminAuditingUser === 'creator_001' && roleObj.id === 'moderator_auditor') ||
                                    (adminAuditingUser === 'admin_002' && roleObj.id === 'moderator_super') ||
                                    (localStorage.getItem(`role_${adminAuditingUser}`) === roleObj.id);

                return (
                  <button
                    key={roleObj.id}
                    type="button"
                    onClick={() => {
                      localStorage.setItem(`role_${adminAuditingUser}`, roleObj.id);
                      triggerToast(`Assigned ${roleObj.label} permissions successfully.`, 'success');
                      // trigger refresh
                      setAdminAuditingUser(prev => prev === 'seller_001' ? 'seller_001' : prev === 'creator_001' ? 'creator_001' : 'admin_002');
                    }}
                    className={`p-3 text-left border rounded-[5px] transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-orange-50/50 border-app-accent ring-1 ring-app-accent' 
                        : 'bg-white border-app-border hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-app-accent' : 'border-slate-300'}`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-app-accent" />}
                      </div>
                      <span className="text-xs font-black text-app-text-primary">{roleObj.label}</span>
                    </div>
                    <p className="text-[10px] text-app-text-muted mt-1 leading-normal">{roleObj.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          VIEW 1 — CASHBOOK DASHBOARD (MAIN HUB)
          ========================================= */}
      {!isDetailView && !isReportsView && (
        <div className="space-y-6">
          
          {/* Header Dashboard section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-app-border pb-6">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black text-app-text-primary tracking-tight">My Cashbook</h1>
                <span className={`text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full ${
                  roleToShow === 'admin' 
                    ? 'bg-purple-100 text-purple-700' 
                    : roleToShow === 'creator' 
                    ? 'bg-pink-100 text-pink-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {roleToShow}
                </span>
              </div>
              <p className="text-xs text-app-text-secondary mt-1.5">Track your personal business finances</p>
            </div>

            {/* Google Drive Status Section */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-app-border rounded-[5px]">
                <div className={`w-2.5 h-2.5 rounded-full ${isDriveConnected ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}></div>
                <div className="text-[11px] font-bold text-app-text-secondary">
                  {isDriveConnected ? 'Drive Connected' : 'Drive Disconnected'}
                </div>
                {isDriveConnected ? (
                  <button 
                    onClick={handleDisconnectDrive}
                    className="text-[9px] hover:underline text-app-text-muted hover:text-[#EF4444] font-bold border-l border-app-border ml-2 pl-2"
                  >
                    Disconnect
                  </button>
                ) : null}
              </div>

              {!isDriveConnected && (
                <button 
                  onClick={() => setIsConsentModalOpen(true)}
                  className="px-4 py-2 bg-app-accent text-white hover:bg-[#EA580C] text-[11px] font-bold rounded-[5px] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Connect Google Drive
                </button>
              )}

              <button 
                onClick={handleImportOrders}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-[5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-md border-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Sync Orders
              </button>

              <button 
                onClick={() => setIsNewBookModalOpen(true)}
                className="px-4 py-2 bg-app-accent text-white hover:bg-[#EA580C] text-[11px] font-bold rounded-[5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                New Book
              </button>
            </div>
          </div>

          {/* Aggregated Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Total In */}
            <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm transform hover:scale-[1.01] transition-all">
              <div className="flex justify-between items-center text-app-text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Total Cash In</span>
                <div className="p-1.5 bg-[#F0FDF4] text-[#22C55E] rounded-[5px]">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-app-text-primary tracking-tight mt-2">
                ৳{aggregatedStats.totalIn.toLocaleString()}
              </div>
              <div className="text-[10px] text-app-text-muted mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                Aggregated across all books
              </div>
            </div>

            {/* Total Out */}
            <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm transform hover:scale-[1.01] transition-all">
              <div className="flex justify-between items-center text-app-text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Total Cash Out</span>
                <div className="p-1.5 bg-red-100 text-[#EF4444] rounded-[5px]">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-app-text-primary tracking-tight mt-2">
                ৳{aggregatedStats.totalOut.toLocaleString()}
              </div>
              <div className="text-[10px] text-app-text-muted mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-app-accent" />
                Aggregated expenses
              </div>
            </div>

            {/* Net Balance */}
            <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm transform hover:scale-[1.01] transition-all">
              <div className="flex justify-between items-center text-app-text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Net Balance</span>
                <div className={`p-1.5 rounded-[5px] ${aggregatedNet >= 0 ? 'bg-[#F0FDF4] text-[#22C55E]' : 'bg-red-100 text-[#EF4444]'}`}>
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black tracking-tight mt-2 text-[#F97316]">
                ৳{aggregatedNet.toLocaleString()}
              </div>
              <div className="text-[10px] text-app-text-muted mt-2 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#22C55E]" />
                Actual ledger available funds
              </div>
            </div>

            {/* Total Books */}
            <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm transform hover:scale-[1.01] transition-all">
              <div className="flex justify-between items-center text-app-text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Total Books</span>
                <div className="p-1.5 bg-orange-100 text-app-accent rounded-[5px]">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-app-text-primary tracking-tight mt-2">
                {filteredUserBooks.length}
              </div>
              <div className="text-[10px] text-app-text-muted mt-2 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-app-accent" />
                Isolated multi-ledger books
              </div>
            </div>

          </div>

          {/* Book Sections & Layout Grid */}
          <div className="bg-app-card border border-app-border rounded-[5px] p-6 shadow-sm">
            
            {/* My Books Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-5 mb-5">
              <h2 className="text-base font-black text-app-text-primary flex items-center gap-2">
                My Books
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-app-text-secondary">
                  {filteredUserBooks.length}
                </span>
              </h2>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-app-text-secondary">
                  <span className="font-bold">Sort:</span>
                  <select 
                    value={dashboardSort} 
                    onChange={(e: any) => setDashboardSort(e.target.value)}
                    className="p-1.5 border border-app-border rounded-[5px] bg-white text-app-text-primary font-bold focus:outline-none"
                  >
                    <option value="updated">Last Updated</option>
                    <option value="name">Alphabetical</option>
                    <option value="entries">Entry Count</option>
                  </select>
                </div>

                <Link 
                  to="/admin/cashbook/reports" 
                  className="px-4 py-1.5 border border-app-border rounded-[5px] text-xs font-bold bg-white text-app-text-secondary hover:bg-slate-50 flex items-center gap-1 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-app-accent" />
                  All Reports
                </Link>
              </div>
            </div>

            {/* List of Books Cards Grid */}
            {filteredUserBooks.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-3xl">📭</div>
                <h3 className="text-sm font-bold text-app-text-primary mt-4">No Cashbooks Found</h3>
                <p className="text-xs text-app-text-muted mt-1.5 max-w-md mx-auto">Create separate individual cashbooks (e.g., Marketing, Outlet Cash, Sponsorship Recs) to classify and isolate transactional listings.</p>
                <button 
                  onClick={() => setIsNewBookModalOpen(true)}
                  className="mt-4 px-5 py-2 bg-app-accent text-white text-xs font-black rounded-[5px] hover:bg-[#EA580C] cursor-pointer"
                >
                  + Create Your First Book
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {sortedBooks.map((book) => {
                  const bookEntriesList = entries[book.id] || [];
                  const bookIn = bookEntriesList.filter(e => e.type === 'Cash In').reduce((sum, e) => sum + e.amount, 0);
                  const bookOut = bookEntriesList.filter(e => e.type === 'Cash Out').reduce((sum, e) => sum + e.amount, 0);
                  const bookNet = bookIn - bookOut;

                  return (
                    <React.Fragment key={book.id}>
                      <div 
                        className="border border-app-border rounded-[5px] overflow-hidden flex flex-col justify-between transition-all hover:shadow-lg bg-white"
                        style={{ borderTop: `4px solid ${book.color}` }}
                      >
                        <div className="p-5 flex-1">
                          <div className="flex justify-between items-start">
                            <span className="text-3xl p-1 bg-slate-50 border border-slate-100 rounded-[5px] inline-block">{book.emoji}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-app-text-muted font-bold block text-right">
                                {new Date(book.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingBookId(book.id);
                                  setDeleteConfirmName('');
                                  setDeleteConfirmError('');
                                }}
                                className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all cursor-pointer border-0"
                                title="Delete Book"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h3 className="text-sm font-black text-app-text-primary mt-3 truncate" title={book.name}>
                            {book.name}
                          </h3>

                          <div className="text-[10px] text-app-text-muted font-black mt-1 flex items-center gap-1 uppercase">
                            <FileText className="w-3.5 h-3.5" />
                            {bookEntriesList.length} Entries
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                            <div>
                              <span className="text-[9px] text-app-text-muted uppercase font-bold block">Inflow</span>
                              <span className="text-xs font-bold text-[#22C55E]">৳{bookIn.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-app-text-muted uppercase font-bold block">Outflow</span>
                              <span className="text-xs font-bold text-[#EF4444]">৳{bookOut.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Balance Action */}
                        <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] text-app-text-muted font-bold block">Net</span>
                            <span className="text-xs font-black text-[#F97316]">
                              ৳{bookNet.toLocaleString()}
                            </span>
                          </div>
                          <button 
                            onClick={() => navigate(`/admin/cashbook/${book.id}`)}
                            className="px-3 py-1 bg-white border border-app-border text-app-text-secondary hover:text-white hover:bg-[#F97316] hover:border-[#F97316] text-[10px] font-black rounded-[5px] transition-all cursor-pointer flex items-center gap-0.5"
                          >
                            Open Book →
                          </button>
                        </div>
                      </div>

                      {deletingBookId === book.id && (
                        <div className="col-span-full bg-red-50 border border-red-200 rounded-[5px] p-5 text-xs space-y-3.5 shadow-md">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-red-700 flex items-center gap-1.5 uppercase tracking-wide">
                              ⚠️ Danger: Confirm Deletion of "{book.name}"
                            </span>
                            <button 
                              type="button" 
                              onClick={() => { setDeletingBookId(null); setDeleteConfirmName(''); }}
                              className="text-slate-400 hover:text-slate-600 font-bold border-0 bg-transparent text-sm cursor-pointer"
                            >
                              ✕ Cancel
                            </button>
                          </div>
                          <p className="text-slate-600 font-medium leading-relaxed">
                            Deleting this book will permanently purge its associated <strong className="font-black text-red-600">{bookEntriesList.length} transaction records</strong> and all meta history logs from local storage.
                          </p>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                              Type the book's name "<span className="font-black text-red-600">{book.name}</span>" below to authorize:
                            </label>
                            <div className="flex gap-3">
                              <input 
                                type="text"
                                value={deleteConfirmName}
                                onChange={(e) => {
                                  setDeleteConfirmName(e.target.value);
                                  setDeleteConfirmError('');
                                }}
                                placeholder={book.name}
                                className="flex-1 px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg text-xs outline-none focus:border-red-500 font-bold text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (deleteConfirmName !== book.name) {
                                    setDeleteConfirmError('Confirmation name does not match.');
                                    return;
                                  }
                                  handleDeleteBook(book.id);
                                  setDeletingBookId(null);
                                  setDeleteConfirmName('');
                                }}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase rounded-lg cursor-pointer border-0 transition-all tracking-wider"
                              >
                                Delete Permanently
                              </button>
                            </div>
                            {deleteConfirmError && (
                              <p className="text-[10px] text-red-500 font-bold mt-1">{deleteConfirmError}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

          </div>

          {/* Privacy Note Block */}
          <div className="text-center py-6 text-[11px] text-app-text-muted flex items-center justify-center gap-1.5 border-t border-app-border">
            <span>🔒</span>
            <span className="font-bold">Only visible to you — data stored securely with robust encryption inside your private Google Drive</span>
          </div>

        </div>
      )}


      {/* =========================================
          VIEW 2 — BOOK DETAIL PAGE
          ========================================= */}
      {isDetailView && selectedBook && (
        <div className="space-y-6">
          
          {/* Header block with metadata, back btn, title */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-app-border pb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/admin/cashbook')}
                className="p-2 border border-app-border bg-white text-app-text-secondary hover:bg-slate-100 rounded-[5px] transition-all shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-app-accent shrink-0 font-bold" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedBook.emoji}</span>
                  <h1 className="text-xl font-black text-app-text-primary tracking-tight">{selectedBook.name}</h1>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] inline-block ml-1" title="Ledger synchronization verified"></span>
                </div>
                <p className="text-xs text-app-text-secondary mt-1">Multi-role cashbook ledger account segment</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleExportMock('PDF', selectedBook.name)}
                className="px-4 py-2 border border-app-border bg-white text-app-text-secondary hover:bg-slate-50 text-xs font-bold rounded-[5px] flex items-center gap-1 transition-all cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-app-accent" />
                Export PDF
              </button>
              <button 
                onClick={() => handleExportMock('CSV', selectedBook.name)}
                className="px-4 py-2 border border-app-border bg-white text-app-text-secondary hover:bg-slate-50 text-xs font-bold rounded-[5px] flex items-center gap-1 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#22C55E]" />
                Excel / CSV
              </button>
              <Link 
                to="/admin/cashbook/reports" 
                className="px-4 py-2 bg-white border border-app-border text-xs text-app-text-secondary font-bold hover:bg-slate-50 rounded-[5px] transition-all flex items-center gap-1 shrink-0"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Detailed Insights
              </Link>
            </div>
          </div>

          {/* Ledger Summary Cards Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* Total In */}
            <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm">
              <div className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block">Total Inflow</div>
              <div className="text-2xl font-black text-[#22C55E] mt-1.5 flex items-center gap-1.5">
                <ArrowUpRight className="w-6 h-6 p-1 bg-[#F0FDF4] text-[#22C55E] rounded-full" />
                ৳{activeBookIn.toLocaleString()}
              </div>
              <p className="text-[10.5px] text-app-text-muted mt-2">Cash received from sales, commission and refunds</p>
            </div>

            {/* Total Out */}
            <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm">
              <div className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block">Total Outflow</div>
              <div className="text-2xl font-black text-[#EF4444] mt-1.5 flex items-center gap-1.5">
                <ArrowDownLeft className="w-6 h-6 p-1 bg-red-100 text-[#EF4444] rounded-full" />
                ৳{activeBookOut.toLocaleString()}
              </div>
              <p className="text-[10.5px] text-app-text-muted mt-2">Paid raw material expenses, marketing & salaries</p>
            </div>

            {/* Net Available Balance */}
            <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block">Net Ledger Balance</div>
                <div className="text-2xl font-black mt-1.5 text-[#F97316]">
                  ৳{activeBookNet.toLocaleString()}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-app-text-muted">Stored automatically inside entries.json</span>
                <Link to="/admin/cashbook/reports" className="text-xs font-bold text-app-accent hover:underline flex items-center gap-0.5">
                  View Reports →
                </Link>
              </div>
            </div>

          </div>

          {/* Entries Workspace (Action buttons, Search, Table) */}
          <div className="bg-app-card border border-app-border rounded-[5px] p-6 shadow-sm">
            
            {/* Filter controls and new transaction creation actions */}
            <div className="flex flex-col xl:flex-row items-stretch justify-between gap-4 border-b border-app-border pb-5 mb-5">
              
              {/* Filters left */}
              <div className="flex flex-wrap items-center gap-3 flex-1">
                
                {/* Search input */}
                <div className="relative min-w-[180px] flex-1 max-w-sm">
                  <span className="absolute left-3 top-2.5 opacity-60">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    value={filterQuery}
                    onChange={(e: any) => setFilterQuery(e.target.value)}
                    placeholder="Search Remarks, contacts..."
                    className="w-full pl-9 pr-4 py-2 text-xs border border-app-border rounded-[5px] bg-white text-app-text-primary focus:outline-none focus:border-app-accent"
                  />
                </div>

                {/* Type selection dropdown */}
                <select 
                  value={filterType}
                  onChange={(e: any) => setFilterType(e.target.value)}
                  className="p-2 border border-app-border rounded-[5px] bg-white text-xs text-app-text-primary font-bold focus:outline-none"
                >
                  <option value="all">All Entries</option>
                  <option value="Cash In">Cash In</option>
                  <option value="Cash Out">Cash Out</option>
                </select>

                {/* Mode selection dropdown */}
                <select 
                  value={filterMode}
                  onChange={(e: any) => setFormPaymentMode(e.target.value as any)}
                  className="p-2 border border-app-border rounded-[5px] bg-white text-xs text-app-text-primary font-bold focus:outline-none"
                >
                  <option value="all">All Payment Modes</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Cash">Cash (Manual)</option>
                </select>

                {/* Reset Filters */}
                {(filterQuery || filterType !== 'all' || filterMode !== 'all' || filterDateRange.start || filterDateRange.end) && (
                  <button 
                    onClick={() => {
                      setFilterQuery('');
                      setFilterType('all');
                      setFilterMode('all');
                      setFilterDateRange({ start: '', end: '' });
                      triggerToast('Filters cleared', 'info');
                    }}
                    className="p-2 text-xs hover:bg-slate-100 rounded-[5px] font-bold text-app-text-muted flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
              </div>

              {/* + CASH IN / - CASH OUT action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    setSelectedEntryIds(new Set());
                    setShowMovePanel(false);
                    setShowCopyPanel(false);
                  }}
                  className={`px-4 py-2.5 text-xs font-black rounded-[5px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                    bulkMode 
                      ? 'bg-orange-500 text-white border-orange-500' 
                      : 'bg-white text-app-text-secondary border-app-border hover:bg-slate-50'
                  }`}
                >
                  {bulkMode ? 'Disable Bulk' : 'Bulk Actions'}
                </button>
                <button 
                  onClick={() => handleOpenEntryModal('Cash In')}
                  className="px-5 py-2.5 bg-[#22C55E] text-white hover:bg-[#1E9E47] text-xs font-black rounded-[5px] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4 font-black" />
                  + CASH IN
                </button>
                <button 
                  onClick={() => handleOpenEntryModal('Cash Out')}
                  className="px-5 py-2.5 bg-[#EF4444] text-white hover:bg-[#DC2626] text-xs font-black rounded-[5px] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4 font-black" />
                  − CASH OUT
                </button>
              </div>

            </div>

            {/* Date period inputs inside filter panel */}
            <div className="flex flex-wrap items-center gap-3 mb-5 pl-2">
              <span className="text-[10px] font-black uppercase text-app-text-muted">Filter Date Range:</span>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={filterDateRange.start} 
                  onChange={(e: any) => setFilterDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="p-1.5 border border-app-border text-[11px] rounded-[5px] text-app-text-primary focus:outline-none"
                />
                <span className="text-xs text-app-text-muted">to</span>
                <input 
                  type="date" 
                  value={filterDateRange.end} 
                  onChange={(e: any) => setFilterDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="p-1.5 border border-app-border text-[11px] rounded-[5px] text-app-text-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Bulk Actions Control bar */}
            {bulkMode && selectedEntryIds.size > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-[5px] p-4 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-bold text-[#EA580C]">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-orange-600" />
                  <span>
                    <strong className="text-orange-700 text-sm">{selectedEntryIds.size}</strong> entries selected for batch processing
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkToggleType}
                    className="px-3.5 py-2 bg-white hover:bg-orange-100 border border-orange-200 rounded-[5px] text-[10.5px] text-[#EA580C] transition-all cursor-pointer flex items-center gap-1"
                  >
                    🔄 Flip Type
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMovePanel(!showMovePanel);
                      setShowCopyPanel(false);
                    }}
                    className={`px-3.5 py-2 border rounded-[5px] text-[10.5px] transition-all cursor-pointer flex items-center gap-1 ${
                      showMovePanel
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white hover:bg-orange-100 border-orange-200 text-[#EA580C]'
                    }`}
                  >
                    📦 Move to...
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCopyPanel(!showCopyPanel);
                      setShowMovePanel(false);
                    }}
                    className={`px-3.5 py-2 border rounded-[5px] text-[10.5px] transition-all cursor-pointer flex items-center gap-1 ${
                      showCopyPanel
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white hover:bg-orange-100 border-orange-200 text-[#EA580C]'
                    }`}
                  >
                    📋 Copy to...
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-[5px] text-[10.5px] transition-all cursor-pointer flex items-center gap-1 border-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            {/* Move target selection sub-panel */}
            {bulkMode && showMovePanel && (
              <div className="bg-slate-50 border border-app-border rounded-[5px] p-4 mb-5">
                <p className="text-[10px] font-black uppercase text-app-text-muted mb-2 tracking-wider">Select destination Ledger Cashbook to MOVE items to:</p>
                {books.filter(b => b.id !== bookId).length === 0 ? (
                  <p className="text-xs text-app-text-muted">No other cashbooks exist. Create another book first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {books.filter(b => b.id !== bookId).map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleBulkMove(b.id)}
                        className="px-4 py-2 bg-white border border-app-border hover:border-[#EA580C] hover:bg-orange-50 text-xs font-bold text-app-text-primary rounded-[5px] transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{b.emoji}</span>
                        <span>{b.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Copy target selection sub-panel */}
            {bulkMode && showCopyPanel && (
              <div className="bg-slate-50 border border-app-border rounded-[5px] p-4 mb-5">
                <p className="text-[10px] font-black uppercase text-app-text-muted mb-2 tracking-wider">Select destination Ledger Cashbook to COPY items to:</p>
                {books.filter(b => b.id !== bookId).length === 0 ? (
                  <p className="text-xs text-app-text-muted">No other cashbooks exist. Create another book first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {books.filter(b => b.id !== bookId).map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleBulkCopy(b.id)}
                        className="px-4 py-2 bg-white border border-app-border hover:border-[#EA580C] hover:bg-orange-50 text-xs font-bold text-app-text-primary rounded-[5px] transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{b.emoji}</span>
                        <span>{b.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transaction Entries Table List */}
            {entriesWithRunningBalance.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-2xl border border-slate-100">📒</div>
                <h3 className="text-sm font-bold text-app-text-primary mt-3">No Transactions Found</h3>
                <p className="text-xs text-app-text-muted mt-1 max-w-sm mx-auto">None of your list entries match the filter selection scope. Write some transactions to ledger using the buttons above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-app-border text-app-text-muted uppercase text-[10px] font-black tracking-wider bg-slate-50/50">
                      {bulkMode && (
                        <th className="py-3.5 px-4 font-extrabold w-10">
                          <input 
                            type="checkbox"
                            checked={entriesWithRunningBalance.length > 0 && entriesWithRunningBalance.every(e => selectedEntryIds.has(e.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEntryIds(new Set(entriesWithRunningBalance.map(entry => entry.id)));
                              } else {
                                setSelectedEntryIds(new Set());
                              }
                            }}
                            className="w-4 h-4 rounded text-[#F97316] focus:ring-[#F97316] cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="py-3.5 px-4 font-extrabold">Date & Time</th>
                      <th className="py-3.5 px-4 font-extrabold">Details / Contact</th>
                      <th className="py-3.5 px-4 font-extrabold">Category</th>
                      <th className="py-3.5 px-4 font-extrabold">Payment Mode</th>
                      <th className="py-3.5 px-4 font-extrabold text-right">Inflow (+ / -)</th>
                      <th className="py-3.5 px-4 font-extrabold text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entriesWithRunningBalance.map((item) => (
                      <tr 
                        key={item.id} 
                        onClick={() => {
                          if (bulkMode) {
                            const newSelected = new Set(selectedEntryIds);
                            if (newSelected.has(item.id)) {
                              newSelected.delete(item.id);
                            } else {
                              newSelected.add(item.id);
                            }
                            setSelectedEntryIds(newSelected);
                          } else {
                            setSelectedEntry(item);
                          }
                        }}
                        className="hover:bg-slate-50/80 transition-all cursor-pointer text-xs group"
                      >
                        {bulkMode && (
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              checked={selectedEntryIds.has(item.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedEntryIds);
                                if (e.target.checked) {
                                  newSelected.add(item.id);
                                } else {
                                  newSelected.delete(item.id);
                                }
                                setSelectedEntryIds(newSelected);
                              }}
                              className="w-4 h-4 rounded text-[#F97316] focus:ring-[#F97316] cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="py-3.5 px-4">
                          <span className="font-bold block text-app-text-primary">{item.date}</span>
                          <span className="text-[10px] text-app-text-muted block mt-0.5">{item.time}</span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <span className="font-black block text-app-text-primary truncate" title={item.remarks}>
                            {item.remarks || 'No remarks provided'}
                          </span>
                          <span className="text-[10px] text-app-text-muted flex items-center gap-1 uppercase font-bold mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-app-accent"></span>
                            {item.contactName}
                          </span>
                          {(item.createdBy || item.lastEditedBy) && (
                            <div className="flex items-center gap-2 mt-1.5 pt-1 border-t border-[#E5E7EB]/50">
                              {item.createdBy && (
                                <span className="text-[9px] text-slate-400 font-medium">
                                  Entered by <span className="font-black text-slate-500">{item.createdBy.name}</span>
                                </span>
                              )}
                              {item.lastEditedBy && (
                                <span className="text-[9px] text-slate-400 font-medium">
                                  · Edited by <span className="font-black text-slate-500">{item.lastEditedBy.name}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-[5px] bg-slate-100 text-app-text-secondary text-[10px] font-bold">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-black text-blue-600">
                          {item.paymentMode}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-black text-sm select-none ${
                          item.type === 'Cash In' ? 'text-blue-600' : 'text-red-500 font-black'
                        }`}>
                          {item.type === 'Cash In' ? '+' : '−'} ৳{item.amount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-[#F97316] font-mono bg-slate-50/20">
                          ৳{item.runningBalance.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* Privacy Note Bottom */}
          <div className="text-center py-6 text-[11px] text-app-text-muted flex items-center justify-center gap-1.5 border-t border-app-border">
            <span>🔒</span>
            <span className="font-bold">Only visible to you — data stored securely with robust encryption inside your private Google Drive</span>
          </div>

        </div>
      )}


      {/* =========================================
          VIEW 3 — REPORTS PAGE
          ========================================= */}
      {isReportsView && (
        <div className="space-y-6">
          
          {/* Header section with export options */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-app-border pb-6">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/admin/cashbook')}
                className="p-2 border border-app-border bg-white text-app-text-secondary hover:bg-slate-100 rounded-[5px] transition-all shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-app-accent shrink-0 font-bold" />
              </button>
              <div>
                <h1 className="text-xl font-black text-app-text-primary tracking-tight">Consolidated Ledger Reports</h1>
                <p className="text-xs text-app-text-secondary mt-1">Generate multi-role audit-compliant ledger lists</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => handleExportMock('EXCEL', 'Consolidated Filtered')}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-black rounded-[5px] flex items-center gap-1 transition-all shadow-md cursor-pointer border-t border-emerald-500/30"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                Export Excel XLS
              </button>
              <button 
                onClick={() => handleExportMock('PDF', 'Consolidated Filtered')}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-black rounded-[5px] flex items-center gap-1 transition-all shadow-md cursor-pointer border-t border-red-500/30"
              >
                <FileDown className="w-3.5 h-3.5 shrink-0" />
                Export Secure PDF
              </button>
              <button 
                onClick={() => handleExportMock('CSV', 'Consolidated Filtered')}
                className="px-4 py-2 border border-app-border bg-white text-app-text-secondary hover:bg-slate-50 text-xs font-bold rounded-[5px] flex items-center gap-1 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 shrink-0 text-app-accent" />
                Plain CSV
              </button>
            </div>
          </div>

          {/* Filtering Layout Block */}
          <div className="bg-app-card border border-[#CBD5E1] rounded-[5px] p-5 shadow-sm">
            <h3 className="text-xs font-black uppercase text-app-text-secondary tracking-widest border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-app-accent" />
              Select Report Scope Filters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Duration filter selection */}
              <div>
                <label className="text-[10px] font-black uppercase text-app-text-muted block mb-1.5">Reporting Duration</label>
                <select className="w-full p-2 border border-app-border rounded-[5px] text-xs font-bold bg-white text-app-text-primary focus:outline-none focus:border-app-accent">
                  <option>June 2026 (Active month)</option>
                  <option>Last 30 Days</option>
                  <option>Last 3 Months Balance</option>
                  <option>Complete Financial Fiscal Year</option>
                </select>
              </div>

              {/* Entry type filter selection */}
              <div>
                <label className="text-[10px] font-black uppercase text-app-text-muted block mb-1.5">Filter Entry Type</label>
                <select className="w-full p-2 border border-app-border rounded-[5px] text-xs font-bold bg-white text-app-text-primary focus:outline-none focus:border-app-accent">
                  <option>All Transaction types (Aggregate)</option>
                  <option>Only Cash Inflows</option>
                  <option>Only Cash Outflows</option>
                </select>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-[10px] font-black uppercase text-app-text-muted block mb-1.5">Payment Channel</label>
                <select className="w-full p-2 border border-app-border rounded-[5px] text-xs font-bold bg-white text-app-text-primary focus:outline-none focus:border-app-accent">
                  <option>All Channels</option>
                  <option>Bank Transfers</option>
                  <option>bKash / Mobile Wallet</option>
                  <option>Nagad / Mobile Wallet</option>
                  <option>Cash (Physical Currency)</option>
                </select>
              </div>

              {/* Quick Search */}
              <div>
                <label className="text-[10px] font-black uppercase text-app-text-muted block mb-1.5">Account / Contact Keyword</label>
                <input 
                  type="text" 
                  placeholder="e.g., Summit, Sumaiya..."
                  className="w-full p-2 border border-app-border rounded-[5px] text-xs bg-white text-app-text-primary focus:outline-none focus:border-app-accent font-bold"
                />
              </div>

            </div>
          </div>

          {/* Consolidated Summary Matrices */}
          <div className="bg-app-card border border-app-border rounded-[5px] p-6 shadow-sm">
            <h3 className="text-sm font-black text-app-text-primary border-b border-app-border pb-4 mb-5">
              Consolidated Summary Metrics (Platform Aggregated Preview)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              
              <div className="p-4 border border-slate-100 rounded-[5px] bg-slate-50/50">
                <span className="text-[9.5px] font-black text-app-text-muted uppercase tracking-wider block">All Entries</span>
                <span className="text-xl font-black text-app-text-primary mt-1 block">15 Logs</span>
                <span className="text-[9px] text-[#22C55E] block mt-1 font-bold">100% Google Drive audited</span>
              </div>

              <div className="p-4 border border-slate-100 rounded-[5px] bg-slate-50/50">
                <span className="text-[9.5px] font-black text-app-text-muted uppercase tracking-wider block">Daily Active Summary</span>
                <span className="text-xl font-black text-app-text-primary mt-1 block">৳12,100 / Day</span>
                <span className="text-[9px] text-app-text-muted block mt-1">Average transaction volume</span>
              </div>

              <div className="p-4 border border-slate-100 rounded-[5px] bg-slate-50/50">
                <span className="text-[9.5px] font-black text-app-text-muted uppercase tracking-wider block">Sponsors & Vendors matched</span>
                <span className="text-xl font-black text-[#22C55E] mt-1 block">+ ৳103,450 net</span>
                <span className="text-[9px] text-app-text-muted block mt-1">Active vendor clearances</span>
              </div>

              <div className="p-4 border border-slate-100 rounded-[5px] bg-slate-50/50">
                <span className="text-[9.5px] font-black text-app-text-muted uppercase tracking-wider block">Categorized expenses</span>
                <span className="text-xl font-black text-[#EF4444] mt-1 block">৳32,120</span>
                <span className="text-[9px] text-app-text-muted block mt-1">Mostly raw material materials</span>
              </div>

            </div>

            {/* Simulated Data Preview lists */}
            <div className="mt-8 border border-[#CBD5E1] rounded-[5px] p-4 bg-white">
              <div className="text-xs font-black text-app-text-secondary uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">
                📋 Dynamic Report Preview Listing Dataset
              </div>
              
              <div className="space-y-2">
                {[
                  { desc: 'Consolidated Weekly Sales commission settlement payouts', cat: 'Sales Commission', mode: 'Bank Transfer', val: 120000, type: 'Cash In' },
                  { desc: 'Procured raw cotton Egyptian reelsTangail mills thread lines', cat: 'Raw Materials', mode: 'Bank Transfer', val: 35000, type: 'Cash Out' },
                  { desc: 'Sponsorship payout for Lifestyle vlogger vlog references', cat: 'Sponsorship', mode: 'Nagad', val: 60000, type: 'Cash In' }
                ].map((l, i) => (
                  <div key={i} className="flex justify-between items-center text-xs p-2.5 border border-slate-100 rounded-[5px] hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${l.type === 'Cash In' ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}></span>
                      <div>
                        <span className="font-bold text-app-text-primary block">{l.desc}</span>
                        <span className="text-[10px] text-app-text-muted block mt-0.5">{l.cat} — payment mode: {l.mode}</span>
                      </div>
                    </div>
                    <span className={`font-black ${l.type === 'Cash In' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {l.type === 'Cash In' ? '+' : '−'} ৳{l.val.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom security info */}
          <div className="text-center py-6 text-[11px] text-app-text-muted flex items-center justify-center gap-1.5 border-t border-app-border">
            <span>🔒</span>
            <span className="font-bold">Only visible to you — data stored securely with robust encryption inside your private Google Drive</span>
          </div>

        </div>
      )}


      {/* =========================================
          MODALS SECTION
          ========================================= */}

      {/* MODAL 1: NEW BOOK MODAL */}
      {isNewBookModalOpen && (
        <div className="fixed inset-0 bg-[#000435]/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#CBD5E1] rounded-[5px] shadow-2xl p-6 w-full max-w-md animate-scale-up">
            
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-app-border pb-4 mb-4">
              <h3 className="text-base font-black text-app-text-primary flex items-center gap-2">
                📒 Create Separate Cashbook Book
              </h3>
              <button 
                onClick={() => setIsNewBookModalOpen(false)}
                className="p-1 text-app-text-muted hover:text-app-text-primary rounded-full hover:bg-slate-100 shrink-0"
              >
                <X className="w-4 h-4 shrink-0 font-bold" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateBook} className="space-y-4">
              
              <div>
                <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-1.5">Book Name</label>
                <input 
                  type="text" 
                  value={newBookName}
                  onChange={(e: any) => setNewBookName(e.target.value)}
                  placeholder="e.g., Shop Daily Sales, Export Consignments..."
                  className="w-full p-2.5 text-xs font-bold border border-app-border rounded-[5px] bg-white text-app-text-primary focus:outline-none focus:border-app-accent"
                />
              </div>

              {/* Emoji selector */}
              <div>
                <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-2">Selected Icon Emoji</label>
                <div className="grid grid-cols-6 gap-2 bg-slate-50 p-2.5 border border-app-border rounded-[5px]">
                  {emojis.map(emo => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setNewBookEmoji(emo)}
                      className={`text-2xl p-1.5 rounded-[5px] transition-all hover:scale-115 text-center ${
                        newBookEmoji === emo ? 'bg-app-accent text-white scale-110 shadow-sm' : 'hover:bg-slate-200'
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color selector */}
              <div>
                <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-2">Book Theme Color Tag</label>
                <div className="flex flex-wrap gap-2.5 bg-slate-50 p-2.5 border border-app-border rounded-[5px]">
                  {colors.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewBookColor(col)}
                      className="w-6 h-6 rounded-full border border-white relative transition-all hover:scale-115 shrink-0"
                      style={{ backgroundColor: col }}
                    >
                      {newBookColor === col && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-black">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-app-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewBookModalOpen(false)}
                  className="px-4 py-2 border border-app-border text-xs text-app-text-secondary hover:bg-slate-50 font-bold rounded-[5px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-app-accent text-white hover:bg-[#EA580C] text-xs font-black rounded-[5px]"
                >
                  Create Book
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* MODAL 2: CASH IN / CASH OUT TRANSACTION MODAL */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 bg-[#000435]/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#CBD5E1] rounded-[5px] shadow-2xl p-6 w-full max-w-4xl animate-scale-up">
            
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-app-border pb-4 mb-5">
              <h3 className="text-base font-black text-app-text-primary flex items-center gap-2">
                {entryModalType === 'Cash In' ? (
                  <span className="flex items-center gap-1.5 text-[#22C55E]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]"></span>
                    + ADD CASH IN (Income Record)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[#EF4444]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
                    − ADD CASH OUT (Expense Record)
                  </span>
                )}
              </h3>
              <button 
                onClick={() => setIsEntryModalOpen(false)}
                className="p-1 text-app-text-muted hover:text-app-text-primary rounded-full hover:bg-slate-100 shrink-0"
              >
                <X className="w-4 h-4 shrink-0 font-bold" />
              </button>
            </div>

            {/* Double column input form layout */}
            <form onSubmit={(e) => handleSaveEntry(e)} className="space-y-5">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left Side fields */}
                <div className="space-y-4">
                  
                  {/* Amount input */}
                  <div>
                    <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-1.5">Amount (BDT)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-xs text-app-text-muted font-bold">৳</span>
                      <input 
                        type="number" 
                        value={formAmount}
                        onChange={(e: any) => setFormAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full pl-7 pr-4 py-2.5 font-bold border border-app-border rounded-[5px] bg-white text-app-text-primary focus:outline-none focus:border-app-accent"
                      />
                    </div>
                  </div>

                  {/* Contact client name */}
                  <div>
                    <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-1.5">Contact Name (Supplier / Customer)</label>
                    <input 
                      type="text" 
                      value={formContact}
                      onChange={(e: any) => setFormContact(e.target.value)}
                      placeholder="e.g. Apex Hub, Sumaiya, Tangail Cotton..."
                      className="w-full p-2.5 border border-app-border rounded-[5px] text-xs font-bold bg-white text-app-text-primary focus:outline-none focus:border-app-accent"
                    />
                  </div>

                  {/* Remarks details */}
                  <div>
                    <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-1.5">Remarks / Transaction Description</label>
                    <textarea 
                      value={formRemarks}
                      onChange={(e: any) => setFormRemarks(e.target.value)}
                      placeholder="Write billing receipts details, references..."
                      rows={3}
                      className="w-full p-2.5 border border-app-border rounded-[5px] text-xs font-medium bg-white text-app-text-primary focus:outline-none focus:border-app-accent"
                    />
                  </div>

                  {/* Attach files mockup */}
                  <div>
                    <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-1.5">Attach Bills / Receipts references</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Paste document filename or invoice code (e.g. invoice_vlog_99b.pdf)"
                        value={formAttachmentName}
                        onChange={(e: any) => setFormAttachmentName(e.target.value)}
                        className="flex-1 p-2 border border-app-border rounded-[5px] text-xs bg-white text-app-text-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (formAttachmentName.trim()) {
                            setFormAttachments(prev => [...prev, formAttachmentName.trim()]);
                            setFormAttachmentName('');
                            triggerToast('Reference file attachment registered!', 'success');
                          }
                        }}
                        className="px-4 py-2 border border-app-border bg-slate-50 text-app-text-secondary hover:bg-slate-100 text-xs font-bold rounded-[5px]"
                      >
                        Attach
                      </button>
                    </div>

                    {formAttachments.length > 0 && (
                      <div className="mt-2.5 p-2 bg-slate-50 border border-app-border rounded-[5px] space-y-1">
                        <span className="text-[10px] font-black text-app-text-muted uppercase block">Attached ({formAttachments.length}):</span>
                        {formAttachments.map((f, i) => (
                          <div key={i} className="flex justify-between items-center text-[11px] text-app-text-secondary py-1 px-1.5 bg-white border border-slate-100 rounded-sm">
                            <span className="font-bold truncate max-w-[200px]" title={f}>{f}</span>
                            <button 
                              type="button" 
                              onClick={() => setFormAttachments(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-app-text-muted hover:text-[#EF4444]"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Right Side fields */}
                <div className="space-y-4">
                  
                  {/* Category */}
                  <div>
                    <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-1.5">Transaction Classification Category</label>
                    <select 
                      value={formCategory}
                      onChange={(e: any) => {
                        if (e.target.value === '__add_custom__') {
                          setShowAddCategory(true);
                        } else {
                          setFormCategory(e.target.value);
                        }
                      }}
                      className="w-full p-2.5 border border-app-border rounded-[5px] text-xs font-bold bg-white text-app-text-primary focus:outline-none focus:border-app-accent"
                    >
                      <option value="">-- Select Category --</option>
                      {DEFAULT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__add_custom__" className="text-app-accent font-black">➕ Create Custom Category...</option>
                    </select>

                    {showAddCategory && (
                      <div className="mt-2.5 p-3 bg-orange-50 border border-orange-200 rounded-[5px] space-y-2">
                        <label className="text-[10px] font-black uppercase text-orange-700 block">Create Custom Category:</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={newCategoryInput}
                            onChange={(e) => setNewCategoryInput(e.target.value)}
                            placeholder="e.g. Photography, Server Hosting"
                            className="flex-1 px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md text-xs font-bold text-slate-800 focus:outline-none focus:border-app-accent"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newCategoryInput.trim();
                              if (!trimmed) return;
                              if (DEFAULT_CATEGORIES.includes(trimmed)) {
                                triggerToast('Category already exists.', 'info');
                                setFormCategory(trimmed);
                                setShowAddCategory(false);
                                setNewCategoryInput('');
                                return;
                              }
                              const updatedCats = [...customCategories, trimmed];
                              setCustomCategories(updatedCats);
                              localStorage.setItem('choosify_cashbook_custom_cats', JSON.stringify(updatedCats));
                              setFormCategory(trimmed);
                              setShowAddCategory(false);
                              setNewCategoryInput('');
                              triggerToast(`✓ Added custom category "${trimmed}"`, 'success');
                            }}
                            className="px-3.5 py-1.5 bg-app-accent text-white font-black text-xs rounded-md cursor-pointer border-0"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddCategory(false);
                              setNewCategoryInput('');
                            }}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-md cursor-pointer border-0"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-1.5">Payment Mode</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {['Bank Transfer', 'bKash', 'Nagad', 'Cash'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFormPaymentMode(m as any)}
                          className={`p-2.5 text-xs text-center border rounded-[5px] transition-all font-black ${
                            formPaymentMode === m 
                              ? 'bg-app-accent text-white border-app-accent' 
                              : 'bg-white border-app-border text-app-text-secondary hover:bg-slate-50'
                          }`}
                        >
                          {m === 'Cash' ? 'Cash (Manual)' : m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date selection field */}
                  <div>
                    <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-1.5">Billing Record Date</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 opacity-60">
                        <Calendar className="w-4 h-4" />
                      </span>
                      <input 
                        type="date" 
                        value={formDate} 
                        onChange={(e: any) => setFormDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-app-border rounded-[5px] text-xs font-bold text-app-text-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Time selection field */}
                  <div>
                    <label className="text-[11px] font-black uppercase text-app-text-secondary block mb-1.5">Time Stamp</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 11:30 AM"
                      value={formTime}
                      onChange={(e: any) => setFormTime(e.target.value)}
                      className="w-full p-2.5 border border-app-border rounded-[5px] text-xs font-bold bg-white text-app-text-primary focus:outline-none"
                    />
                  </div>

                </div>

              </div>

              {/* Footer actions */}
              <div className="pt-5 border-t border-app-border flex items-center justify-between">
                <div>
                  <button 
                    type="button" 
                    onClick={() => {
                      setFormAmount('12000');
                      setFormContact('Choosify BD Tech');
                      setFormRemarks('Clearing consolidated hosting invoices billing week 2');
                    }}
                    className="text-[10px] text-app-text-muted hover:underline"
                  >
                    Load Mock Sample
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEntryModalOpen(false)}
                    className="px-4 py-2 border border-app-border text-xs text-app-text-secondary hover:bg-slate-50 font-bold rounded-[5px]"
                  >
                    Cancel
                  </button>

                  {!editingEntry && (
                    <button
                      type="button"
                      onClick={(e) => handleSaveEntry(e, true)}
                      className="px-4 py-2 border border-[#CBD5E1] text-[#CBD5E1] hover:bg-slate-50 text-xs font-black rounded-[5px] hover:text-[#EA580C]"
                    >
                      Save & Add New
                    </button>
                  )}

                  <button
                    type="submit"
                    className="px-6 py-2 bg-app-accent text-white hover:bg-[#EA580C] text-xs font-black rounded-[5px] shadow-sm cursor-pointer"
                  >
                    Save Entry
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* MODAL 3: TRANSACTION DETAIL OVERLAY LOCK MODAL */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-[#000435]/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#CBD5E1] shadow-2xl p-6 w-full max-w-lg rounded-[5px] animate-scale-up">
            
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-app-border pb-4 mb-5">
              <h3 className="text-base font-black text-app-text-primary">
                📒 Consolidated Entry Audit Details
              </h3>
              <button 
                onClick={() => setSelectedEntry(null)}
                className="p-1 text-app-text-muted hover:text-app-text-primary rounded-full hover:bg-slate-100 shrink-0"
              >
                <X className="w-4 h-4 shrink-0 font-bold" />
              </button>
            </div>

            {/* Core Info block */}
            <div className="space-y-4">
              
              <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-app-text-muted font-black block uppercase tracking-wider">Classification</span>
                  <span className={`px-2.5 py-0.5 rounded-[5px] text-[10px] uppercase font-black tracking-widest inline-block mt-1 ${
                    selectedEntry.type === 'Cash In' ? 'bg-[#F0FDF4] text-[#22C55E]' : 'bg-red-50 text-[#EF4444]'
                  }`}>
                    {selectedEntry.type}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-app-text-muted font-black block uppercase tracking-wider">Amount BDT</span>
                  <span className={`text-2xl font-black block mt-0.5 ${
                    selectedEntry.type === 'Cash In' ? 'text-[#22C55E]' : 'text-[#EF4444]'
                  }`}>
                    {selectedEntry.type === 'Cash In' ? '+' : '−'} ৳{selectedEntry.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-app-text-muted font-black uppercase block tracking-wider">Contact Target:</span>
                  <span className="font-black text-app-text-primary mt-1 block">{selectedEntry.contactName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-app-text-muted font-black uppercase block tracking-wider">Payment Channel:</span>
                  <span className="font-bold text-app-text-primary mt-1 block">{selectedEntry.paymentMode}</span>
                </div>
                <div>
                  <span className="text-[10px] text-app-text-muted font-black uppercase block tracking-wider">Classification Tag:</span>
                  <span className="font-bold text-app-text-primary mt-1 block">{selectedEntry.category}</span>
                </div>
                <div>
                  <span className="text-[10px] text-app-text-muted font-black uppercase block tracking-wider">Time Registered:</span>
                  <span className="font-bold text-app-text-primary mt-1 block">{selectedEntry.date} ({selectedEntry.time})</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-[5px] text-xs">
                <span className="text-[10px] text-app-text-muted font-black block uppercase tracking-wider mb-1">Remarks & Descriptions:</span>
                <p className="font-medium text-app-text-secondary leading-relaxed">{selectedEntry.remarks || 'No remarks descriptions attached.'}</p>
              </div>

              {selectedEntry.attachments && selectedEntry.attachments.length > 0 && (
                <div>
                  <span className="text-[10px] text-app-text-muted font-black block uppercase tracking-wider mb-1.5">Verification Documents Attached:</span>
                  <div className="space-y-1.5">
                    {selectedEntry.attachments.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-[5px] text-xs text-app-text-secondary cursor-pointer">
                        <FileText className="w-4 h-4 text-app-accent shrink-0" />
                        <span className="font-black flex-1 truncate">{f}</span>
                        <span className="text-[10px] text-app-accent hover:underline">Download</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Actions Footer detail */}
            <div className="pt-5 mt-5 border-t border-app-border flex items-center justify-end gap-3">
              <button 
                onClick={() => {
                  const toEdit = { ...selectedEntry };
                  setSelectedEntry(null);
                  handleOpenEntryModal(toEdit.type, toEdit);
                }}
                className="px-4 py-2 border border-app-border bg-white text-app-text-secondary hover:bg-slate-50 text-xs font-black rounded-[5px] flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Record
              </button>
              {confirmingDelete ? (
                <div className="p-2 bg-red-50 border border-red-200 rounded-[5px] flex items-center gap-2 animate-fade-in">
                  <span className="text-[10px] font-black text-red-600">Are you sure?</span>
                  <button
                    onClick={() => {
                      handleDeleteEntry(selectedEntry.id);
                      setConfirmingDelete(false);
                    }}
                    className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-[9px] font-bold uppercase rounded border-none cursor-pointer"
                  >Confirm</button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 text-[9px] font-bold uppercase rounded border border-slate-200 cursor-pointer"
                  >Cancel</button>
                </div>
              ) : (
                <button 
                  onClick={() => setConfirmingDelete(true)}
                  className="px-4 py-2 border border-red-200 bg-red-50 text-[#EF4444] hover:bg-red-100 text-xs font-black rounded-[5px] flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Record
                </button>
              )}
              <button 
                onClick={() => { setSelectedEntry(null); setConfirmingDelete(false); }}
                className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-[5px] cursor-pointer"
              >
                Close Audit
              </button>
            </div>

          </div>
        </div>
      )}


      {/* MODAL 4: INTERMEDIATE INTRODUCTORY GOOGLE CONSENT LOADING POPUP */}
      {isConsentModalOpen && (
        <div className="fixed inset-0 bg-[#000435]/65 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-6 tracking-tight max-w-md w-full shadow-2xl border border-app-border rounded-[5px] animate-scale-up text-left">
            
            {/* Google Logo */}
            <div className="flex items-center gap-2 border-b border-app-border pb-4 mb-4">
              <span className="text-xl shrink-0 font-extrabold tracking-tighter text-slate-800">
                G<span className="text-red-500">o</span><span className="text-yellow-500">o</span>g<span className="text-green-500">l</span>e
              </span>
              <span className="text-xs font-bold text-app-text-muted">Cloud Consent Platform</span>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-black text-slate-800">Choose an account to continue to Choosify Drive Sync</h2>
              <p className="text-[11px] text-app-text-muted leading-relaxed">Choosify requires write access approvals to construct private secure container mappings `Choosify/CashBook/[BookID]` inside your isolated Google Drive workspace.</p>

              {syncingProgress !== null ? (
                <div className="space-y-2 py-4">
                  <div className="flex justify-between items-center text-[10px] font-black text-app-accent uppercase tracking-widest animate-pulse">
                    <span>Synchronizing ledger assets...</span>
                    <span>{syncingProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-app-accent h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${syncingProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-2">
                  {[
                    { name: profile?.displayName || 'User', email: profile?.email || 'user@choosify.com.bd' },
                    { name: 'Kazi Farhan (Support)', email: 'kazi@choosify.com.bd' }
                  ].map((acc, i) => (
                    <button
                      key={i}
                      onClick={handleConnectProgress}
                      className="w-full text-left p-3 border border-slate-100 rounded-[5px] hover:bg-slate-50 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <span className="text-xs font-black text-slate-800 block">{acc.name}</span>
                        <span className="text-[10px] text-app-text-muted block mt-0.5">{acc.email}</span>
                      </div>
                      <span className="text-[10.5px] font-bold text-app-accent group-hover:underline">Verify Account</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 text-xs">
                <button 
                  onClick={() => setIsConsentModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-[5px] text-slate-500 font-bold"
                >
                  Cancel Consent
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
