import type { CatalogCategory } from './catalogTypes';

/** Bump when the storefront category tree changes. */
export const CATEGORY_CATALOG_VERSION = '2026-10-11';

/**
 * The platform's 26 main categories — the same taxonomy the storefront shows.
 * Ids of categories that already existed are kept so stored products stay valid.
 */
export const STOREFRONT_CATEGORY_DEFS = [
  {
    id: "cat-fashion",
    slug: "fashion-lifestyle",
    name: "Fashion & Lifestyle",
    icon: "Shirt",
    description: "Apparel, footwear, bags and fashion accessories.",
    displayOrder: 0,
  },
  {
    id: "cat-jewelry",
    slug: "jewelry-luxury",
    name: "Jewelry & Luxury",
    icon: "Gem",
    description: "Jewelry, precious metals and luxury watches.",
    displayOrder: 1,
  },
  {
    id: "cat-beauty",
    slug: "beauty-health-pharmacy",
    name: "Beauty, Health & Pharmacy",
    icon: "HeartPulse",
    description: "Makeup, skincare, grooming and over-the-counter health.",
    displayOrder: 2,
  },
  {
    id: "cat-tech",
    slug: "electronics",
    name: "Electronics",
    icon: "Cpu",
    description: "Phones, computers, TVs, cameras and audio.",
    displayOrder: 3,
  },
  {
    id: "cat-home",
    slug: "home-furniture-appliances",
    name: "Home, Furniture & Appliances",
    icon: "Sofa",
    description: "Furniture, decor, art, kitchen and home appliances.",
    displayOrder: 4,
  },
  {
    id: "cat-food",
    slug: "grocery-food",
    name: "Grocery & Food",
    icon: "ShoppingBasket",
    description: "Groceries, fresh food and beverages.",
    displayOrder: 5,
  },
  {
    id: "cat-baby",
    slug: "baby-kids-toys",
    name: "Baby, Kids & Toys",
    icon: "Baby",
    description: "Baby care, feeding, gear and toys.",
    displayOrder: 6,
  },
  {
    id: "cat-sporting",
    slug: "sports-fitness-outdoor",
    name: "Sports, Fitness & Outdoor",
    icon: "Dumbbell",
    description: "Sports gear, gym equipment, camping and cycling.",
    displayOrder: 7,
  },
  {
    id: "cat-gaming",
    slug: "gaming-entertainment",
    name: "Gaming & Entertainment",
    icon: "Gamepad2",
    description: "Consoles, games, accessories and streaming.",
    displayOrder: 8,
  },
  {
    id: "cat-automotive",
    slug: "automotive",
    name: "Automotive",
    icon: "Car",
    description: "Vehicles, parts, tires, batteries and car accessories.",
    displayOrder: 9,
  },
  {
    id: "cat-books",
    slug: "books-education-arts",
    name: "Books, Education & Arts",
    icon: "BookOpen",
    description: "Books, stationery, courses, instruments and arts & crafts.",
    displayOrder: 10,
  },
  {
    id: "cat-pets",
    slug: "pets-agriculture",
    name: "Pets & Agriculture",
    icon: "PawPrint",
    description: "Pet food and care, veterinary, farming and seeds.",
    displayOrder: 11,
  },
  {
    id: "cat-travel",
    slug: "travel-hospitality",
    name: "Travel & Hospitality",
    icon: "Plane",
    description: "Stays, travel packages, transport and tickets.",
    displayOrder: 12,
  },
  {
    id: "cat-real-estate",
    slug: "real-estate",
    name: "Real Estate",
    icon: "Building2",
    description: "Property to buy or rent, apartments, commercial and land.",
    displayOrder: 13,
  },
  {
    id: "cat-events",
    slug: "events-wedding",
    name: "Events & Wedding",
    icon: "PartyPopper",
    description: "Weddings, venues, photography, decoration and catering.",
    displayOrder: 14,
  },
  {
    id: "cat-services",
    slug: "professional-home-services",
    name: "Professional & Home Services",
    icon: "Wrench",
    description: "Home services, repairs, professional and IT services.",
    displayOrder: 15,
  },
  {
    id: "cat-industrial",
    slug: "industrial-business",
    name: "Industrial & Business",
    icon: "Factory",
    description: "Industrial equipment, tools and business supplies.",
    displayOrder: 16,
  },
  {
    id: "cat-digital",
    slug: "digital-products",
    name: "Digital Products",
    icon: "Download",
    description: "Software, domains, hosting, templates and gift cards.",
    displayOrder: 17,
  },
  {
    id: "cat-financial",
    slug: "financial-government-services",
    name: "Financial & Government Services",
    icon: "Landmark",
    description: "Banking, insurance, bills, government and tax services.",
    displayOrder: 18,
  },
  {
    id: "cat-jobs",
    slug: "jobs-recruitment",
    name: "Jobs & Recruitment",
    icon: "Briefcase",
    description: "Jobs, recruitment, resumes and career coaching.",
    displayOrder: 19,
  },
  {
    id: "cat-b2b",
    slug: "b2b-marketplace",
    name: "B2B Marketplace",
    icon: "Boxes",
    description: "Wholesale, import & export, manufacturers and distributors.",
    displayOrder: 20,
  },
  {
    id: "cat-rental",
    slug: "rental-marketplace",
    name: "Rental Marketplace",
    icon: "Key",
    description: "Rent vehicles, electronics, furniture and equipment.",
    displayOrder: 21,
  },
  {
    id: "cat-used",
    slug: "used-products",
    name: "Used Products",
    icon: "Recycle",
    description: "Pre-owned electronics, vehicles, furniture and more.",
    displayOrder: 22,
  },
  {
    id: "cat-auctions",
    slug: "auctions",
    name: "Auctions",
    icon: "Gavel",
    description: "Auctions for electronics, vehicles, property, art and antiques.",
    displayOrder: 23,
  },
  {
    id: "cat-community",
    slug: "community-social-impact",
    name: "Community & Social Impact",
    icon: "HeartHandshake",
    description: "Donations, volunteering, relief and sponsorship.",
    displayOrder: 24,
  },
  {
    id: "cat-bookings",
    slug: "bookings-appointments",
    name: "Bookings & Appointments",
    icon: "CalendarCheck",
    description: "Reservations and appointments.",
    displayOrder: 25,
  },
] as const;

/**
 * Starting branch categories under each main category. Sellers add more from the
 * product editor (POST /catalog/categories/:id/subcategories); those are shared.
 */
export const STOREFRONT_SUBCATEGORY_DEFS: ReadonlyArray<{
  id: string;
  slug: string;
  name: string;
  parentId: string;
  displayOrder: number;
}> = [
  { id: "sub-fashion-lifestyle-mens-fashion", slug: "fashion-lifestyle-mens-fashion", name: "Men's Fashion", parentId: "cat-fashion", displayOrder: 0 },
  { id: "sub-fashion-lifestyle-womens-fashion", slug: "fashion-lifestyle-womens-fashion", name: "Women's Fashion", parentId: "cat-fashion", displayOrder: 1 },
  { id: "sub-fashion-lifestyle-footwear", slug: "fashion-lifestyle-footwear", name: "Footwear", parentId: "cat-fashion", displayOrder: 2 },
  { id: "sub-fashion-lifestyle-bags-luggage", slug: "fashion-lifestyle-bags-luggage", name: "Bags & Luggage", parentId: "cat-fashion", displayOrder: 3 },
  { id: "sub-fashion-lifestyle-fashion-accessories", slug: "fashion-lifestyle-fashion-accessories", name: "Fashion Accessories", parentId: "cat-fashion", displayOrder: 4 },
  { id: "sub-jewelry-luxury-gold", slug: "jewelry-luxury-gold", name: "Gold", parentId: "cat-jewelry", displayOrder: 0 },
  { id: "sub-jewelry-luxury-silver", slug: "jewelry-luxury-silver", name: "Silver", parentId: "cat-jewelry", displayOrder: 1 },
  { id: "sub-jewelry-luxury-diamond", slug: "jewelry-luxury-diamond", name: "Diamond", parentId: "cat-jewelry", displayOrder: 2 },
  { id: "sub-jewelry-luxury-bridal", slug: "jewelry-luxury-bridal", name: "Bridal", parentId: "cat-jewelry", displayOrder: 3 },
  { id: "sub-jewelry-luxury-luxury-watches", slug: "jewelry-luxury-luxury-watches", name: "Luxury Watches", parentId: "cat-jewelry", displayOrder: 4 },
  { id: "sub-beauty-health-pharmacy-makeup", slug: "beauty-health-pharmacy-makeup", name: "Makeup", parentId: "cat-beauty", displayOrder: 0 },
  { id: "sub-beauty-health-pharmacy-skincare", slug: "beauty-health-pharmacy-skincare", name: "Skincare", parentId: "cat-beauty", displayOrder: 1 },
  { id: "sub-beauty-health-pharmacy-hair-care", slug: "beauty-health-pharmacy-hair-care", name: "Hair Care", parentId: "cat-beauty", displayOrder: 2 },
  { id: "sub-beauty-health-pharmacy-mens-grooming", slug: "beauty-health-pharmacy-mens-grooming", name: "Men's Grooming", parentId: "cat-beauty", displayOrder: 3 },
  { id: "sub-beauty-health-pharmacy-otc-medicines", slug: "beauty-health-pharmacy-otc-medicines", name: "OTC Medicines", parentId: "cat-beauty", displayOrder: 4 },
  { id: "cat-mobile", slug: "mobile-phones", name: "Mobile Phones", parentId: "cat-tech", displayOrder: 0 },
  { id: "sub-electronics-computers", slug: "electronics-computers", name: "Computers", parentId: "cat-tech", displayOrder: 1 },
  { id: "sub-electronics-tv-entertainment", slug: "electronics-tv-entertainment", name: "TV & Entertainment", parentId: "cat-tech", displayOrder: 2 },
  { id: "sub-electronics-cameras", slug: "electronics-cameras", name: "Cameras", parentId: "cat-tech", displayOrder: 3 },
  { id: "sub-electronics-audio", slug: "electronics-audio", name: "Audio", parentId: "cat-tech", displayOrder: 4 },
  { id: "sub-home-furniture-appliances-furniture", slug: "home-furniture-appliances-furniture", name: "Furniture", parentId: "cat-home", displayOrder: 0 },
  { id: "sub-home-furniture-appliances-home-decor", slug: "home-furniture-appliances-home-decor", name: "Home Decor", parentId: "cat-home", displayOrder: 1 },
  { id: "sub-home-furniture-appliances-paintings-wall-art", slug: "home-furniture-appliances-paintings-wall-art", name: "Paintings & Wall Art", parentId: "cat-home", displayOrder: 2 },
  { id: "sub-home-furniture-appliances-kitchen-dining", slug: "home-furniture-appliances-kitchen-dining", name: "Kitchen & Dining", parentId: "cat-home", displayOrder: 3 },
  { id: "cat-appliances", slug: "home-appliances", name: "Home Appliances", parentId: "cat-home", displayOrder: 4 },
  { id: "sub-home-furniture-appliances-lighting", slug: "home-furniture-appliances-lighting", name: "Lighting", parentId: "cat-home", displayOrder: 5 },
  { id: "sub-grocery-food-grocery", slug: "grocery-food-grocery", name: "Grocery", parentId: "cat-food", displayOrder: 0 },
  { id: "sub-grocery-food-fruits-vegetables", slug: "grocery-food-fruits-vegetables", name: "Fruits & Vegetables", parentId: "cat-food", displayOrder: 1 },
  { id: "sub-grocery-food-meat-fish", slug: "grocery-food-meat-fish", name: "Meat & Fish", parentId: "cat-food", displayOrder: 2 },
  { id: "sub-grocery-food-dairy-eggs", slug: "grocery-food-dairy-eggs", name: "Dairy & Eggs", parentId: "cat-food", displayOrder: 3 },
  { id: "sub-grocery-food-beverages", slug: "grocery-food-beverages", name: "Beverages", parentId: "cat-food", displayOrder: 4 },
  { id: "sub-baby-kids-toys-baby-care", slug: "baby-kids-toys-baby-care", name: "Baby Care", parentId: "cat-baby", displayOrder: 0 },
  { id: "sub-baby-kids-toys-baby-feeding", slug: "baby-kids-toys-baby-feeding", name: "Baby Feeding", parentId: "cat-baby", displayOrder: 1 },
  { id: "sub-baby-kids-toys-baby-gear", slug: "baby-kids-toys-baby-gear", name: "Baby Gear", parentId: "cat-baby", displayOrder: 2 },
  { id: "sub-baby-kids-toys-toys", slug: "baby-kids-toys-toys", name: "Toys", parentId: "cat-baby", displayOrder: 3 },
  { id: "sub-baby-kids-toys-educational-toys", slug: "baby-kids-toys-educational-toys", name: "Educational Toys", parentId: "cat-baby", displayOrder: 4 },
  { id: "sub-sports-fitness-outdoor-sports", slug: "sports-fitness-outdoor-sports", name: "Sports", parentId: "cat-sporting", displayOrder: 0 },
  { id: "sub-sports-fitness-outdoor-gym-equipment", slug: "sports-fitness-outdoor-gym-equipment", name: "Gym Equipment", parentId: "cat-sporting", displayOrder: 1 },
  { id: "sub-sports-fitness-outdoor-fitness-accessories", slug: "sports-fitness-outdoor-fitness-accessories", name: "Fitness Accessories", parentId: "cat-sporting", displayOrder: 2 },
  { id: "sub-sports-fitness-outdoor-camping", slug: "sports-fitness-outdoor-camping", name: "Camping", parentId: "cat-sporting", displayOrder: 3 },
  { id: "sub-sports-fitness-outdoor-cycling", slug: "sports-fitness-outdoor-cycling", name: "Cycling", parentId: "cat-sporting", displayOrder: 4 },
  { id: "sub-gaming-entertainment-gaming-consoles", slug: "gaming-entertainment-gaming-consoles", name: "Gaming Consoles", parentId: "cat-gaming", displayOrder: 0 },
  { id: "sub-gaming-entertainment-gaming-accessories", slug: "gaming-entertainment-gaming-accessories", name: "Gaming Accessories", parentId: "cat-gaming", displayOrder: 1 },
  { id: "sub-gaming-entertainment-video-games", slug: "gaming-entertainment-video-games", name: "Video Games", parentId: "cat-gaming", displayOrder: 2 },
  { id: "sub-gaming-entertainment-pc-games", slug: "gaming-entertainment-pc-games", name: "PC Games", parentId: "cat-gaming", displayOrder: 3 },
  { id: "sub-gaming-entertainment-streaming-subscription", slug: "gaming-entertainment-streaming-subscription", name: "Streaming Subscription", parentId: "cat-gaming", displayOrder: 4 },
  { id: "sub-automotive-vehicle-marketplace", slug: "automotive-vehicle-marketplace", name: "Vehicle Marketplace", parentId: "cat-automotive", displayOrder: 0 },
  { id: "sub-automotive-auto-parts", slug: "automotive-auto-parts", name: "Auto Parts", parentId: "cat-automotive", displayOrder: 1 },
  { id: "sub-automotive-tires", slug: "automotive-tires", name: "Tires", parentId: "cat-automotive", displayOrder: 2 },
  { id: "sub-automotive-batteries", slug: "automotive-batteries", name: "Batteries", parentId: "cat-automotive", displayOrder: 3 },
  { id: "sub-automotive-car-accessories", slug: "automotive-car-accessories", name: "Car Accessories", parentId: "cat-automotive", displayOrder: 4 },
  { id: "sub-books-education-arts-books", slug: "books-education-arts-books", name: "Books", parentId: "cat-books", displayOrder: 0 },
  { id: "sub-books-education-arts-stationery", slug: "books-education-arts-stationery", name: "Stationery", parentId: "cat-books", displayOrder: 1 },
  { id: "sub-books-education-arts-online-courses", slug: "books-education-arts-online-courses", name: "Online Courses", parentId: "cat-books", displayOrder: 2 },
  { id: "sub-books-education-arts-musical-instruments", slug: "books-education-arts-musical-instruments", name: "Musical Instruments", parentId: "cat-books", displayOrder: 3 },
  { id: "sub-books-education-arts-arts-crafts", slug: "books-education-arts-arts-crafts", name: "Arts & Crafts", parentId: "cat-books", displayOrder: 4 },
  { id: "sub-pets-agriculture-pet-food", slug: "pets-agriculture-pet-food", name: "Pet Food", parentId: "cat-pets", displayOrder: 0 },
  { id: "sub-pets-agriculture-pet-accessories", slug: "pets-agriculture-pet-accessories", name: "Pet Accessories", parentId: "cat-pets", displayOrder: 1 },
  { id: "sub-pets-agriculture-veterinary", slug: "pets-agriculture-veterinary", name: "Veterinary", parentId: "cat-pets", displayOrder: 2 },
  { id: "sub-pets-agriculture-agriculture", slug: "pets-agriculture-agriculture", name: "Agriculture", parentId: "cat-pets", displayOrder: 3 },
  { id: "sub-pets-agriculture-seeds", slug: "pets-agriculture-seeds", name: "Seeds", parentId: "cat-pets", displayOrder: 4 },
  { id: "sub-travel-hospitality-accommodation-booking", slug: "travel-hospitality-accommodation-booking", name: "Accommodation Booking", parentId: "cat-travel", displayOrder: 0 },
  { id: "sub-travel-hospitality-travel-packages", slug: "travel-hospitality-travel-packages", name: "Travel Packages", parentId: "cat-travel", displayOrder: 1 },
  { id: "sub-travel-hospitality-transportation-booking", slug: "travel-hospitality-transportation-booking", name: "Transportation Booking", parentId: "cat-travel", displayOrder: 2 },
  { id: "sub-travel-hospitality-vehicle-rental", slug: "travel-hospitality-vehicle-rental", name: "Vehicle Rental", parentId: "cat-travel", displayOrder: 3 },
  { id: "sub-travel-hospitality-event-ticket-booking", slug: "travel-hospitality-event-ticket-booking", name: "Event & Ticket Booking", parentId: "cat-travel", displayOrder: 4 },
  { id: "sub-real-estate-buy-property", slug: "real-estate-buy-property", name: "Buy Property", parentId: "cat-real-estate", displayOrder: 0 },
  { id: "sub-real-estate-rent-property", slug: "real-estate-rent-property", name: "Rent Property", parentId: "cat-real-estate", displayOrder: 1 },
  { id: "sub-real-estate-apartments", slug: "real-estate-apartments", name: "Apartments", parentId: "cat-real-estate", displayOrder: 2 },
  { id: "sub-real-estate-commercial", slug: "real-estate-commercial", name: "Commercial", parentId: "cat-real-estate", displayOrder: 3 },
  { id: "sub-real-estate-land", slug: "real-estate-land", name: "Land", parentId: "cat-real-estate", displayOrder: 4 },
  { id: "sub-events-wedding-wedding", slug: "events-wedding-wedding", name: "Wedding", parentId: "cat-events", displayOrder: 0 },
  { id: "sub-events-wedding-event-venue", slug: "events-wedding-event-venue", name: "Event Venue", parentId: "cat-events", displayOrder: 1 },
  { id: "sub-events-wedding-photography-videography", slug: "events-wedding-photography-videography", name: "Photography & Videography", parentId: "cat-events", displayOrder: 2 },
  { id: "sub-events-wedding-decoration", slug: "events-wedding-decoration", name: "Decoration", parentId: "cat-events", displayOrder: 3 },
  { id: "sub-events-wedding-catering", slug: "events-wedding-catering", name: "Catering", parentId: "cat-events", displayOrder: 4 },
  { id: "sub-professional-home-services-home-services", slug: "professional-home-services-home-services", name: "Home Services", parentId: "cat-services", displayOrder: 0 },
  { id: "sub-professional-home-services-repair-maintenance", slug: "professional-home-services-repair-maintenance", name: "Repair & Maintenance", parentId: "cat-services", displayOrder: 1 },
  { id: "sub-professional-home-services-professional-services", slug: "professional-home-services-professional-services", name: "Professional Services", parentId: "cat-services", displayOrder: 2 },
  { id: "sub-professional-home-services-it-services", slug: "professional-home-services-it-services", name: "IT Services", parentId: "cat-services", displayOrder: 3 },
  { id: "sub-professional-home-services-digital-marketing", slug: "professional-home-services-digital-marketing", name: "Digital Marketing", parentId: "cat-services", displayOrder: 4 },
  { id: "sub-industrial-business-industrial-equipment", slug: "industrial-business-industrial-equipment", name: "Industrial Equipment", parentId: "cat-industrial", displayOrder: 0 },
  { id: "sub-industrial-business-power-tools", slug: "industrial-business-power-tools", name: "Power Tools", parentId: "cat-industrial", displayOrder: 1 },
  { id: "sub-industrial-business-business-supplies", slug: "industrial-business-business-supplies", name: "Business Supplies", parentId: "cat-industrial", displayOrder: 2 },
  { id: "sub-industrial-business-hotel-supplies", slug: "industrial-business-hotel-supplies", name: "Hotel Supplies", parentId: "cat-industrial", displayOrder: 3 },
  { id: "sub-industrial-business-medical-supplies", slug: "industrial-business-medical-supplies", name: "Medical Supplies", parentId: "cat-industrial", displayOrder: 4 },
  { id: "sub-digital-products-software", slug: "digital-products-software", name: "Software", parentId: "cat-digital", displayOrder: 0 },
  { id: "sub-digital-products-domain", slug: "digital-products-domain", name: "Domain", parentId: "cat-digital", displayOrder: 1 },
  { id: "sub-digital-products-hosting", slug: "digital-products-hosting", name: "Hosting", parentId: "cat-digital", displayOrder: 2 },
  { id: "sub-digital-products-digital-templates", slug: "digital-products-digital-templates", name: "Digital Templates", parentId: "cat-digital", displayOrder: 3 },
  { id: "sub-digital-products-gift-cards", slug: "digital-products-gift-cards", name: "Gift Cards", parentId: "cat-digital", displayOrder: 4 },
  { id: "sub-financial-government-services-banking", slug: "financial-government-services-banking", name: "Banking", parentId: "cat-financial", displayOrder: 0 },
  { id: "sub-financial-government-services-insurance", slug: "financial-government-services-insurance", name: "Insurance", parentId: "cat-financial", displayOrder: 1 },
  { id: "sub-financial-government-services-utility-bill-payment", slug: "financial-government-services-utility-bill-payment", name: "Utility Bill Payment", parentId: "cat-financial", displayOrder: 2 },
  { id: "sub-financial-government-services-government-services", slug: "financial-government-services-government-services", name: "Government Services", parentId: "cat-financial", displayOrder: 3 },
  { id: "sub-financial-government-services-tax-services", slug: "financial-government-services-tax-services", name: "Tax Services", parentId: "cat-financial", displayOrder: 4 },
  { id: "sub-jobs-recruitment-job-marketplace", slug: "jobs-recruitment-job-marketplace", name: "Job Marketplace", parentId: "cat-jobs", displayOrder: 0 },
  { id: "sub-jobs-recruitment-recruitment-services", slug: "jobs-recruitment-recruitment-services", name: "Recruitment Services", parentId: "cat-jobs", displayOrder: 1 },
  { id: "sub-jobs-recruitment-resume-writing", slug: "jobs-recruitment-resume-writing", name: "Resume Writing", parentId: "cat-jobs", displayOrder: 2 },
  { id: "sub-jobs-recruitment-interview-coaching", slug: "jobs-recruitment-interview-coaching", name: "Interview Coaching", parentId: "cat-jobs", displayOrder: 3 },
  { id: "sub-jobs-recruitment-hr-consultancy", slug: "jobs-recruitment-hr-consultancy", name: "HR Consultancy", parentId: "cat-jobs", displayOrder: 4 },
  { id: "sub-b2b-marketplace-wholesale", slug: "b2b-marketplace-wholesale", name: "Wholesale", parentId: "cat-b2b", displayOrder: 0 },
  { id: "sub-b2b-marketplace-import-export", slug: "b2b-marketplace-import-export", name: "Import & Export", parentId: "cat-b2b", displayOrder: 1 },
  { id: "sub-b2b-marketplace-manufacturers", slug: "b2b-marketplace-manufacturers", name: "Manufacturers", parentId: "cat-b2b", displayOrder: 2 },
  { id: "sub-b2b-marketplace-distributors", slug: "b2b-marketplace-distributors", name: "Distributors", parentId: "cat-b2b", displayOrder: 3 },
  { id: "sub-b2b-marketplace-oem-odm", slug: "b2b-marketplace-oem-odm", name: "OEM & ODM", parentId: "cat-b2b", displayOrder: 4 },
  { id: "sub-rental-marketplace-vehicles", slug: "rental-marketplace-vehicles", name: "Vehicles", parentId: "cat-rental", displayOrder: 0 },
  { id: "sub-rental-marketplace-electronics", slug: "rental-marketplace-electronics", name: "Electronics", parentId: "cat-rental", displayOrder: 1 },
  { id: "sub-rental-marketplace-furniture", slug: "rental-marketplace-furniture", name: "Furniture", parentId: "cat-rental", displayOrder: 2 },
  { id: "sub-rental-marketplace-construction-equipment", slug: "rental-marketplace-construction-equipment", name: "Construction Equipment", parentId: "cat-rental", displayOrder: 3 },
  { id: "sub-rental-marketplace-event-equipment", slug: "rental-marketplace-event-equipment", name: "Event Equipment", parentId: "cat-rental", displayOrder: 4 },
  { id: "sub-used-products-electronics", slug: "used-products-electronics", name: "Electronics", parentId: "cat-used", displayOrder: 0 },
  { id: "sub-used-products-vehicles", slug: "used-products-vehicles", name: "Vehicles", parentId: "cat-used", displayOrder: 1 },
  { id: "sub-used-products-furniture", slug: "used-products-furniture", name: "Furniture", parentId: "cat-used", displayOrder: 2 },
  { id: "sub-used-products-appliances", slug: "used-products-appliances", name: "Appliances", parentId: "cat-used", displayOrder: 3 },
  { id: "sub-used-products-books", slug: "used-products-books", name: "Books", parentId: "cat-used", displayOrder: 4 },
  { id: "sub-auctions-electronics", slug: "auctions-electronics", name: "Electronics", parentId: "cat-auctions", displayOrder: 0 },
  { id: "sub-auctions-vehicles", slug: "auctions-vehicles", name: "Vehicles", parentId: "cat-auctions", displayOrder: 1 },
  { id: "sub-auctions-property", slug: "auctions-property", name: "Property", parentId: "cat-auctions", displayOrder: 2 },
  { id: "sub-auctions-art", slug: "auctions-art", name: "Art", parentId: "cat-auctions", displayOrder: 3 },
  { id: "sub-auctions-antiques", slug: "auctions-antiques", name: "Antiques", parentId: "cat-auctions", displayOrder: 4 },
  { id: "sub-community-social-impact-ngo-donations", slug: "community-social-impact-ngo-donations", name: "NGO Donations", parentId: "cat-community", displayOrder: 0 },
  { id: "sub-community-social-impact-volunteer-programs", slug: "community-social-impact-volunteer-programs", name: "Volunteer Programs", parentId: "cat-community", displayOrder: 1 },
  { id: "sub-community-social-impact-disaster-relief", slug: "community-social-impact-disaster-relief", name: "Disaster Relief", parentId: "cat-community", displayOrder: 2 },
  { id: "sub-community-social-impact-educational-sponsorship", slug: "community-social-impact-educational-sponsorship", name: "Educational Sponsorship", parentId: "cat-community", displayOrder: 3 },
  { id: "sub-bookings-appointments-restaurant-reservation", slug: "bookings-appointments-restaurant-reservation", name: "Restaurant Reservation", parentId: "cat-bookings", displayOrder: 0 },
  { id: "sub-bookings-appointments-doctors-appointment", slug: "bookings-appointments-doctors-appointment", name: "Doctor's Appointment", parentId: "cat-bookings", displayOrder: 1 },
  { id: "sub-bookings-appointments-massage-appointment", slug: "bookings-appointments-massage-appointment", name: "Massage Appointment", parentId: "cat-bookings", displayOrder: 2 },
  { id: "sub-bookings-appointments-therapy-appointment", slug: "bookings-appointments-therapy-appointment", name: "Therapy Appointment", parentId: "cat-bookings", displayOrder: 3 },
  { id: "sub-bookings-appointments-gym-membership", slug: "bookings-appointments-gym-membership", name: "Gym Membership", parentId: "cat-bookings", displayOrder: 4 },
];

export const CANONICAL_CATEGORY_IDS = new Set(
  STOREFRONT_CATEGORY_DEFS.map((category) => category.id),
);

export const STALE_CATEGORY_IDS = new Set([
  'cat-sarees',
  'cat-panjabis',
  'cat-electronics',
  'cat-smartphones',
  'cat-groceries',
]);

const STALE_CATEGORY_NAMES = new Set([
  'Fashion & Apparel',
  'Jamdani & Silk Sarees',
  'Panjabis',
  'Electronics & Gadgets',
  'Smartphones',
  'Organic Groceries',
  'Eyewear & Fragrances',
  'Beauty & Personal Care',
  'Mobile & Wearable',
  'Vehicles & Automotive',
  'Family & Kids',
  'Food & Essentials',
  'Hobbies & Creativity',
  'Health & Wellness',
  'Education & Learning',
]);

export const storefrontCategoryNames = (): string[] =>
  STOREFRONT_CATEGORY_DEFS.map((category) => category.name);

export const buildDefaultCatalogCategories = (): CatalogCategory[] => {
  const ts = new Date().toISOString();
  const parentIcons = new Map<string, string>(
    STOREFRONT_CATEGORY_DEFS.map((category) => [category.id, category.icon]),
  );
  return [
    ...STOREFRONT_CATEGORY_DEFS.map((category) => ({
      ...category,
      parentId: null,
      enabled: true,
      createdAt: ts,
      updatedAt: ts,
    })),
    ...STOREFRONT_SUBCATEGORY_DEFS.map((sub) => ({
      ...sub,
      icon: parentIcons.get(sub.parentId) ?? 'Folder',
      description: '',
      enabled: true,
      createdAt: ts,
      updatedAt: ts,
    })),
  ];
};

type CategoryLike = { id: string; name: string; parentId?: string | null };

export const isStaleCategorySet = (categories: CategoryLike[]): boolean => {
  if (!categories.length) return true;

  const hasStaleId = categories.some((category) => STALE_CATEGORY_IDS.has(category.id));
  const hasStaleName = categories.some((category) => STALE_CATEGORY_NAMES.has(category.name));
  const topLevelIds = new Set(
    categories.filter((category) => !category.parentId).map((category) => category.id),
  );
  const missingCanonical = [...CANONICAL_CATEGORY_IDS].some((id) => !topLevelIds.has(id));

  return hasStaleId || hasStaleName || missingCanonical;
};
