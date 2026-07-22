export type OpsCouponType = 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y';

export interface OpsCouponRule {
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  maxUsages?: number;
  maxUsagesPerUser?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  applicableBrands?: string[];
  excludeCategories?: string[];
  excludeProducts?: string[];
  excludeBrands?: string[];
  buyQuantity?: number;
  getQuantity?: number;
}

export interface OpsCoupon {
  id: string;
  code: string;
  type: OpsCouponType;
  discountTarget: 'all_products' | 'specific_product' | 'specific_category' | 'specific_brand';
  discountValue: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
  deleted?: boolean;
  rules: OpsCouponRule;
  description: string;
  totalUsages: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  createdAt: string;
  updatedAt: string;
}

export interface OpsCouponUsage {
  id: string;
  couponId: string;
  couponCode: string;
  orderId: string;
  userId: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  timestamp: string;
  status: 'applied' | 'redeemed' | 'failed';
}

export interface OpsStorefrontOrder {
  id: string;
  orderId: string;
  buyerId: string;
  isCOD: boolean;
  isSplit: boolean;
  overallTotal: number;
  subtotal?: number;
  deliveryTotal?: number;
  subOrders: unknown[];
  promoCode?: string;
  promoDiscount?: number;
  promoType?: string;
  sourceMode?: 'retail';
  paymentMethod?: 'cod' | 'credit';
  shipping?: {
    fullName: string;
    phone: string;
    address: string;
    region: string;
    deliveryNotes?: string;
  };
  tradeLicense?: string;
  companyName?: string;
  isQuotationRequest?: boolean;
  /** Booking / service orders use pending_payment until paid, then confirmed */
  status: 'pending_payment' | 'active' | 'confirmed' | 'cancelled' | 'completed';
  bookingRequestId?: string;
  paymentDueAt?: string;
  paidAt?: string;
  invoiceGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type OpsReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'flagged'
  | 'published'
  | 'deleted'
  | 'hidden';

export interface OpsReview {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  productTitle: string;
  brandName: string;
  storeName: string;
  rating: number;
  comment: string;
  status: OpsReviewStatus;
  reports: number;
  flags?: string[];
  response?: {
    id: string;
    author: string;
    comment: string;
    timestamp: string;
  };
  isAuthentic?: boolean;
  authenticityScore?: number;
  authenticityReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type OpsLeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';

export interface OpsLead {
  id: string;
  source: string;
  brandName: string;
  contactPerson?: string;
  email: string;
  budget?: string;
  placementInterest?: string;
  message?: string;
  status: OpsLeadStatus;
  createdAt: string;
  updatedAt: string;
}

export type OpsJobEmploymentType = 'full_time' | 'part_time' | 'internship' | 'contract';
export type OpsJobStatus = 'open' | 'closed' | 'draft';

export interface OpsJobPosting {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: OpsJobEmploymentType;
  summary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  status: OpsJobStatus;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type OpsJobApplicationStatus = 'new' | 'reviewed' | 'interviewing' | 'rejected' | 'hired';

export interface OpsJobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone: string;
  resumeUrl: string;
  resumeFileName?: string;
  coverLetter: string;
  status: OpsJobApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export type PermissionKey = 'content' | 'users' | 'finance' | 'brand' | 'system' | 'analytics';

export type RolePermissionsMap = Record<string, Record<PermissionKey, boolean>>;
