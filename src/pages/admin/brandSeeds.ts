// brandSeeds.ts
// Robust data seeds for Choosify Brand Studio V2

export interface CreatorVideoItem {
  id: string;
  title: string;
  sourceUrl: string;
  platform: "youtube" | "instagram" | "tiktok" | "facebook";
  thumbnailUrl: string;
  duration: string;
  creatorName: string;
  views: number;
  clicks: number;
  status: "Pending" | "Approved" | "Rejected";
}

export interface BrandProductItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  featured: boolean;
  status: "Live" | "Hidden" | "Draft";
  thumbnail: string;
}

export interface BrandDealItem {
  id: string;
  title: string;
  discountType: "Percentage" | "Flat";
  discountValue: number;
  status: "Active" | "Scheduled" | "Expired";
  startDate: string;
  endDate: string;
}

export interface PromoCodeItem {
  id: string;
  code: string;
  discountType: "Percentage" | "Flat";
  discountValue: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  enabled: boolean;
}

export interface AuditAlertItem {
  id: string;
  type: "positive" | "negative";
  scoreChange: string;
  message: string;
  timestamp: string;
}

export interface TeamMemberItem {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Marketing Manager" | "Product Manager" | "Support Manager" | "Creator Manager";
  status: "Active" | "Suspended" | "Invited";
}

export interface BrandReviewItem {
  id: string;
  author: string;
  rating: number;
  date: string;
  text: string;
  verified: boolean;
  helpfulCount: number;
  flagged?: boolean;
}

export interface BrandCMSModel {
  id: string;
  brandName: string;
  slug: string;
  logo: string;
  coverImage: string;
  tagline: string;
  category: string;
  socialFbUrl: string;
  socialInstaUrl: string;
  socialTiktokUrl: string;
  socialYtUrl: string;
  website: string;
  description: string;
  missionStatement: string;
  brandStory: string;
  values: string;
  verificationStatus: "Verified" | "Standard" | "Suspended";
  status: "LIVE" | "DRAFT" | "SUSPENDED";
  
  // Trust metrics
  choosifyScore: number;
  qualityScore: number;
  serviceScore: number;
  deliveryScore: number;
  packagingScore: number;
  recommendationScore: number;
  verifiedPurchasePercentage: number;
  returnRate: string;
  complaintRate: string;
  responseTime: string;
  recentTrustAlerts: AuditAlertItem[];

  // Catalog and promos
  products: BrandProductItem[];
  deals: BrandDealItem[];
  promoCodes: PromoCodeItem[];
  creators: CreatorVideoItem[];
  reviews: BrandReviewItem[];
  team: TeamMemberItem[];
  
  // General details
  address: string;
  contactEmail: string;
  phone: string;
  mapLink: string;
  audienceType: string;
  ageRange: string;
  genderFocus: string;
  priceRange: string;
  services: string[];
  specialties: string[];
  bestForTags: string[];
  returnPolicy: string;
  warrantyInfo: string;
  deliveryCoverage: string;
  customerServiceHours: string;

  // Visibility Controls
  visibility: {
    overview: boolean;
    products: boolean;
    featuredProducts: boolean;
    deals: boolean;
    promoCodes: boolean;
    creatorReviews: boolean;
    publicReviews: boolean;
    trustSection: boolean;
    brandInformation: boolean;
  };
}

export const initialBrandSeeds: Record<string, BrandCMSModel> = {
  "1": {
    id: "1",
    brandName: "Samsung Bangladesh",
    slug: "samsung-bd",
    logo: "https://images.unsplash.com/photo-1622434641406-a158123450f9?w=120&auto=format&fit=crop&q=80",
    coverImage: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=1200",
    tagline: "Inspire the World, Create the Future",
    category: "Electronics & Mobile",
    socialFbUrl: "https://facebook.com/samsungbangladesh",
    socialInstaUrl: "https://instagram.com/samsungbd",
    socialTiktokUrl: "",
    socialYtUrl: "https://youtube.com/samsungbd",
    website: "https://samsung.com/bd",
    description: "Samsung Electronics offers cutting edge smartphones, premium QLED televisions, and smart eco-bubble home appliances, backed by official retail guarantees.",
    missionStatement: "To devote our talent and technology to creating superior products and services that contribute to a better global society.",
    brandStory: "Founded in suwon, we've brought unparalleled tech innovation directly into the homes of millions in Bangladesh over the past two decades.",
    values: "People, Excellence, Change, Integrity, Co-prosperity",
    verificationStatus: "Verified",
    status: "LIVE",
    choosifyScore: 4.8,
    qualityScore: 98,
    serviceScore: 92,
    deliveryScore: 95,
    packagingScore: 94,
    recommendationScore: 96,
    verifiedPurchasePercentage: 92,
    returnRate: "1.2%",
    complaintRate: "0.4%",
    responseTime: "under 15 mins",
    
    recentTrustAlerts: [
      { id: "a1", type: "positive", scoreChange: "+2", message: "Successful Deliveries milestone", timestamp: "Today 10:15 AM" },
      { id: "a2", type: "positive", scoreChange: "+5", message: "Complaint Resolved within 1 hour limit", timestamp: "Yesterday" },
      { id: "a3", type: "negative", scoreChange: "-3", message: "Return Rate Increase on Galaxy Buds bundle", timestamp: "3 days ago" },
      { id: "a4", type: "negative", scoreChange: "-10", message: "Fake Review Detected from guest cluster", timestamp: "1 week ago" }
    ],

    products: [
      { id: "p1", name: "Samsung Galaxy S26 Ultra", sku: "SAM-S26U-512", category: "Smartphones", price: 185000, stock: 45, featured: true, status: "Live", thumbnail: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=150" },
      { id: "p2", name: "65 Inch QLED Frame Art TV", sku: "SAM-TV65-FRM", category: "Televisions", price: 145000, stock: 12, featured: true, status: "Live", thumbnail: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=150" },
      { id: "p3", name: "Smart EcoBubble Front Load Washer", sku: "SAM-WSH-ECO10", category: "Home Appliances", price: 78000, stock: 18, featured: true, status: "Live", thumbnail: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=150" },
      { id: "p4", name: "Galaxy Tab S9 Plus Pro", sku: "SAM-TABS9-PL", category: "Smartphones", price: 92000, stock: 25, featured: false, status: "Live", thumbnail: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=150" },
      { id: "p5", name: "Galaxy Active ANC Buds 3", sku: "SAM-ANC-BUDS3", category: "Accessories", price: 18000, stock: 80, featured: false, status: "Hidden", thumbnail: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=150" }
    ],

    deals: [
      { id: "d1", title: "Joyful Monsoon Tech Savefest 2026", discountType: "Percentage", discountValue: 12, status: "Active", startDate: "2026-06-01", endDate: "2026-06-30" },
      { id: "d2", title: "Official Student Galaxy Bundle Discount", discountType: "Flat", discountValue: 8000, status: "Scheduled", startDate: "2026-07-01", endDate: "2026-08-31" }
    ],

    promoCodes: [
      { id: "pr1", code: "SAMSUNGMONSOON", discountType: "Percentage", discountValue: 10, startDate: "2026-06-01", endDate: "2026-06-30", usageLimit: 500, enabled: true },
      { id: "pr2", code: "SAMSUNGINSIDER", discountType: "Flat", discountValue: 5000, startDate: "2026-06-10", endDate: "2026-12-31", usageLimit: 100, enabled: true }
    ],

    creators: [
      { id: "cr1", title: "In-depth Galaxy S26 Ultra BD Longtest Review", sourceUrl: "https://youtube.com/watch?v=S26U", platform: "youtube", thumbnailUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400", duration: "14:20", creatorName: "ATC Android Toto Company", views: 45000, clicks: 3400, status: "Approved" },
      { id: "cr2", title: "Is the Smart EcoBubble Washer worth it?", sourceUrl: "https://instagram.com/reel/Washer", platform: "instagram", thumbnailUrl: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400", duration: "1:00", creatorName: "SamInBD Reels", views: 24700, clicks: 1250, status: "Approved" },
      { id: "cr3", title: "Samsung Premium QLED TV Display Setup Aesthetic Tour", sourceUrl: "https://tiktok.com/setup", platform: "tiktok", thumbnailUrl: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400", duration: "0:45", creatorName: "TechInsiderBD", views: 18000, clicks: 920, status: "Approved" }
    ],

    reviews: [
      { id: "rv1", author: "Fahim Al-Muktadir", rating: 5, date: "June 10, 2026", text: "The Galaxy S26 Ultra is an absolute beast. Camera output is second to none, and Choosify's fast delivery partner seal was pristine.", verified: true, helpfulCount: 22 },
      { id: "rv2", author: "Nusrath Jahan Riya", rating: 4, date: "June 08, 2026", text: "Loving the Frame TV aesthetic. It fits like an architectural masterpiece in my salon lobby.", verified: true, helpfulCount: 15 },
      { id: "rv3", author: "Imran Chowdhury", rating: 5, date: "May 25, 2026", text: "EcoBubble has made laundry tasks incredibly fast. Water efficient and totally silent performance.", verified: true, helpfulCount: 8 }
    ],

    team: [
      { id: "tm1", name: "Ziaul Huq Munim", email: "munim.ziaul@samsung.com", role: "Owner", status: "Active" },
      { id: "tm2", name: "Safana Tarannum", email: "safana.t@samsung-dist.bd", role: "Admin", status: "Active" },
      { id: "tm3", name: "Ayon Rahman", email: "ayon.mkt@samsung-dist.bd", role: "Marketing Manager", status: "Active" }
    ],

    address: "Samsung Prestige Flagship Store, House 14, Road 11, Banani, Dhaka 1213",
    contactEmail: "support.bd@samsung.com",
    phone: "09612-300300",
    mapLink: "https://maps.google.com/?q=Samsung+Prestige+Banani",
    audienceType: "Power Tech Seekers, Tech Enthusiasts, Smart Home Upgrade Seekers",
    ageRange: "18 - 55 Years",
    genderFocus: "Unisex / All Demographics",
    priceRange: "৳ 12,000 - ৳ 350,000",
    services: ["Official Brand Panel Warranty", "Home Delivery Inside Dhaka", "Same Day Store Pickup"],
    specialties: ["Artificial Intelligence Tech Integration", "Superior Organic LED Displays"],
    bestForTags: ["Gamers", "Corporate Offices", "Creative Photographers", "Modern Homes"],
    returnPolicy: "7 Days replacement guarantee for verified manufacturer defects.",
    warrantyInfo: "2 Years official brand panel and spare-parts warranty card.",
    deliveryCoverage: "Dhaka, Chittagong, Sylhet, Khulna, Rajshahi & nationwide logistics.",
    customerServiceHours: "10:00 AM - 08:30 PM (Saturday - Thursday)",

    visibility: {
      overview: true,
      products: true,
      featuredProducts: true,
      deals: true,
      promoCodes: true,
      creatorReviews: true,
      publicReviews: true,
      trustSection: true,
      brandInformation: true
    }
  },
  "2": {
    id: "2",
    brandName: "Aarong",
    slug: "aarong-heritage",
    logo: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=120&auto=format&fit=crop&q=80",
    coverImage: "https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?auto=format&fit=crop&q=80&w=1200",
    tagline: "Celebrate Your Traditional Roots with Pride",
    category: "Fashion & Lifestyle",
    socialFbUrl: "https://facebook.com/aarong",
    socialInstaUrl: "https://instagram.com/aarong",
    socialTiktokUrl: "",
    socialYtUrl: "https://youtube.com/aarong",
    website: "https://aarong.com",
    description: "Aarong is Bangladesh's premier lifestyle brand and a social enterprise of BRAC, supporting over 65,000 rural artisans with sustainable wages.",
    missionStatement: "To empower rural artisans, preserve heritage craftsmanship, and deliver premium natural garments worldwide.",
    brandStory: "Starting with a single counter under BRAC's development umbrella, Aarong has become the national standard-bearer of Bengal luxury folk artistry.",
    values: "Empowerment, Conservation, Integrity, Quality Craft, Creativity",
    verificationStatus: "Verified",
    status: "LIVE",
    choosifyScore: 4.9,
    qualityScore: 99,
    serviceScore: 96,
    deliveryScore: 91,
    packagingScore: 98,
    recommendationScore: 99,
    verifiedPurchasePercentage: 98,
    returnRate: "0.5%",
    complaintRate: "0.1%",
    responseTime: "under 10 mins",
    
    recentTrustAlerts: [
      { id: "a1", type: "positive", scoreChange: "+10", message: "Artisan Quality Assurance verified by BRAC", timestamp: "Yesterday" },
      { id: "a2", type: "positive", scoreChange: "+5", message: "Organic cotton tag integrity audit completed", timestamp: "3 days ago" }
    ],

    products: [
      { id: "ap1", name: "Premium Handloom Jamdani Saree", sku: "AAR-JAM-SR1", category: "Ethnic Saree", price: 34000, stock: 5, featured: true, status: "Live", thumbnail: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=150" },
      { id: "ap2", name: "Exclusive Hand-Stitched Silk Panjabi", sku: "AAR-PAN-SLK", category: "Men's Panjabi", price: 8500, stock: 24, featured: true, status: "Live", thumbnail: "https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?w=150" },
      { id: "ap3", name: "Heritage Handloomed Nakshi Kantha Blanket", sku: "AAR-NKS-KNT", category: "Home Linens", price: 12000, stock: 6, featured: true, status: "Live", thumbnail: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=150" },
      { id: "ap4", name: "Leather Floral Block Print Clutch", sku: "AAR-LHR-CL", category: "Bags & Leather", price: 3200, stock: 60, featured: false, status: "Live", thumbnail: "https://images.unsplash.com/photo-1566150905458-1bf1fc15aae9?w=150" }
    ],

    deals: [
      { id: "d1", title: "Artisanal Heritage Eid Collection 2026", discountType: "Percentage", discountValue: 10, status: "Active", startDate: "2026-06-01", endDate: "2026-06-30" }
    ],

    promoCodes: [
      { id: "pr1", code: "AARONGHERITAGE", discountType: "Percentage", discountValue: 5, startDate: "2026-06-01", endDate: "2026-06-30", usageLimit: 1000, enabled: true }
    ],

    creators: [
      { id: "cr1", title: "Aarong Eid Heritage Runway Highlights & Reviews", sourceUrl: "https://youtube.com/fashion", platform: "youtube", thumbnailUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400", duration: "8:50", creatorName: "Bangla Style Vogue", views: 24000, clicks: 1200, status: "Approved" }
    ],

    reviews: [
      { id: "rv1", author: "Nafisa Chowdhury", rating: 5, date: "June 11, 2026", text: "The weave density on the Jamdani saree is stunning. Genuine BRAC artisan stamp included.", verified: true, helpfulCount: 45 }
    ],

    team: [
      { id: "tm1", name: "Sajedul Hasan BRAC", email: "sajedul.hasan@brac-retail.com", role: "Owner", status: "Active" }
    ],

    address: "Aarong Centre, 34-36 Tejgaon Industrial Area, Dhaka 1208",
    contactEmail: "customerservice@aarong.com",
    phone: "02-8891530",
    mapLink: "https://maps.google.com/?q=Aarong+Tejgaon",
    audienceType: "Lovers of sustainable fabric, traditional handloom patterns, and heritage aesthetics",
    ageRange: "16 - 70 Years",
    genderFocus: "Women, Men, Children & Home Decor buyers",
    priceRange: "৳ 1,500 - ৳ 450,000",
    services: ["Artisan Authenticity Stamps", "Physical Outlet Exchange Program", "Premium Gift Wrap Boxes"],
    specialties: ["100% Hand-woven Jamdani Stitching", "Nakshi Kantha Heritage Craft Preservation"],
    bestForTags: ["Family Festive Gifts", "Diplomatic Delegations", "Traditional Weddings"],
    returnPolicy: "30 Days exchange program at any brick-and-mortar outlet across BD.",
    warrantyInfo: "100% Cotton, linen and organic silk certificate validation.",
    deliveryCoverage: "Whole Bangladesh flat rate home courier delivery.",
    customerServiceHours: "10:00 AM - 08:00 PM (Everyday)",

    visibility: {
      overview: true,
      products: true,
      featuredProducts: true,
      deals: true,
      promoCodes: true,
      creatorReviews: true,
      publicReviews: true,
      trustSection: true,
      brandInformation: true
    }
  }
};
