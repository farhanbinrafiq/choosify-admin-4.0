/**
 * Canonical booking-field config for service listings.
 * Single source of truth for:
 * - Admin Product Studio (seller setup)
 * - Storefront Message Seller popup (via GET /api/v1/booking/field-config)
 *
 * Do not duplicate this dictionary in Choosify-Web — consume the API instead.
 */

export type ServiceCategory =
  | 'hotels'
  | 'restaurants'
  | 'travel'
  | 'doctors'
  | 'education'
  | 'beauty'
  | 'real_estate'
  | 'transport'
  | 'events'
  | 'tickets'
  | 'home_services'
  | 'gov_services'
  | 'recruitment'
  | 'b2b'
  | 'rental'
  | 'donation';

export type ProductListingType = 'physical' | 'service';
export type RelatedInfoType = 'price_across_stores' | 'whats_nearby' | 'before_your_visit';

export type BookingRequestFieldType = 'text' | 'number' | 'date' | 'time' | 'select' | 'textarea';

export interface BookingRequestField {
  key: string;
  label: string;
  type: BookingRequestFieldType;
  required?: boolean;
  options?: string[];
  min?: number;
}

export type WhatsNearbyFieldKey =
  | 'restaurantCafe'
  | 'entertainmentAttraction'
  | 'hospitalPoliceStation'
  | 'transportAirport'
  | 'shoppingAtm';

export type BeforeYourVisitFieldKey =
  | 'parkingAvailability'
  | 'cancellationPolicy'
  | 'whatToBring'
  | 'wheelchairAccess'
  | 'insuranceAccepted';

export interface RelatedInfoConfig {
  relatedInfoType: RelatedInfoType;
  mandatory: boolean;
  beforeYourVisitFields: BeforeYourVisitFieldKey[];
}

export const WHATS_NEARBY_FIELD_LABELS: Record<WhatsNearbyFieldKey, string> = {
  restaurantCafe: 'Restaurant & Cafe',
  entertainmentAttraction: 'Entertainment & Attraction',
  hospitalPoliceStation: 'Hospital & Police Station',
  transportAirport: 'Transport & Airport',
  shoppingAtm: 'Shopping & ATM',
};

export const BEFORE_YOUR_VISIT_FIELD_LABELS: Record<BeforeYourVisitFieldKey, string> = {
  parkingAvailability: 'Parking Availability',
  cancellationPolicy: 'Cancellation Policy',
  whatToBring: 'What to Bring',
  wheelchairAccess: 'Wheelchair Access',
  insuranceAccepted: 'Insurance Accepted',
};

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  'hotels',
  'restaurants',
  'travel',
  'doctors',
  'education',
  'beauty',
  'real_estate',
  'transport',
  'events',
  'tickets',
  'home_services',
  'gov_services',
  'recruitment',
  'b2b',
  'rental',
  'donation',
] as const;

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  hotels: 'Hotels',
  restaurants: 'Restaurants',
  travel: 'Travel & Tours',
  doctors: 'Doctors',
  education: 'Education',
  beauty: 'Beauty',
  real_estate: 'Real Estate',
  transport: 'Transport',
  events: 'Events & Wedding',
  tickets: 'Tickets & Entry Passes',
  home_services: 'Home & Professional Services',
  gov_services: 'Government & Financial Services',
  recruitment: 'Jobs & Recruitment',
  b2b: 'B2B Marketplace',
  rental: 'Rental Marketplace',
  donation: 'Donations & Community',
};

const notes: BookingRequestField = {
  key: 'notes',
  label: 'Notes',
  type: 'textarea',
};

/** Field set buyers fill when messaging to book — keyed by serviceCategory */
export const SERVICE_BOOKING_FIELDS: Record<ServiceCategory, BookingRequestField[]> = {
  hotels: [
    { key: 'checkInDate', label: 'Check-in date', type: 'date', required: true },
    { key: 'checkInTime', label: 'Check-in time', type: 'time' },
    { key: 'checkOutDate', label: 'Check-out date', type: 'date', required: true },
    { key: 'checkOutTime', label: 'Check-out time', type: 'time' },
    { key: 'nights', label: 'Nights of stay', type: 'number', required: true, min: 1 },
    { key: 'adults', label: 'Adults', type: 'number', required: true, min: 1 },
    { key: 'children', label: 'Children', type: 'number', min: 0 },
    { key: 'guests', label: 'Total guests', type: 'number', required: true, min: 1 },
    notes,
  ],
  restaurants: [
    { key: 'reservationDate', label: 'Date', type: 'date', required: true },
    { key: 'reservationTime', label: 'Time', type: 'time', required: true },
    { key: 'partySize', label: 'Party size', type: 'number', required: true, min: 1 },
    notes,
  ],
  doctors: [
    { key: 'appointmentDate', label: 'Appointment date', type: 'date', required: true },
    { key: 'appointmentTime', label: 'Time', type: 'time', required: true },
    { key: 'patientName', label: 'Patient name', type: 'text', required: true },
    { key: 'patientAge', label: 'Patient age', type: 'number', required: true, min: 0 },
    { key: 'reason', label: 'Reason for visit', type: 'textarea', required: true },
    notes,
  ],
  education: [
    { key: 'preferredStartDate', label: 'Preferred start date', type: 'date', required: true },
    { key: 'seats', label: 'Seats', type: 'number', required: true, min: 1 },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      required: true,
      options: ['Online', 'In person', 'Hybrid'],
    },
    notes,
  ],
  beauty: [
    { key: 'appointmentDate', label: 'Date', type: 'date', required: true },
    { key: 'appointmentTime', label: 'Time', type: 'time', required: true },
    { key: 'guests', label: 'Guests', type: 'number', required: true, min: 1 },
    notes,
  ],
  real_estate: [
    { key: 'viewingDate', label: 'Viewing date', type: 'date', required: true },
    { key: 'viewingTime', label: 'Time', type: 'time', required: true },
    { key: 'visitors', label: 'Visitors', type: 'number', required: true, min: 1 },
    notes,
  ],
  transport: [
    { key: 'pickupDate', label: 'Pickup date', type: 'date', required: true },
    { key: 'pickupTime', label: 'Pickup time', type: 'time', required: true },
    { key: 'dropOffLocation', label: 'Drop-off location', type: 'text', required: true },
    { key: 'passengers', label: 'Passengers', type: 'number', required: true, min: 1 },
    notes,
  ],
  travel: [
    { key: 'travelDate', label: 'Preferred travel date', type: 'date', required: true },
    { key: 'travellers', label: 'Travellers', type: 'number', required: true, min: 1 },
    { key: 'destination', label: 'Destination', type: 'text', required: true },
    notes,
  ],
  events: [
    { key: 'eventDate', label: 'Event date', type: 'date', required: true },
    { key: 'eventLocation', label: 'Event location', type: 'text', required: true },
    { key: 'guestCount', label: 'Guest count', type: 'number', min: 1 },
    notes,
  ],
  tickets: [
    { key: 'visitDate', label: 'Visit / event date', type: 'date', required: true },
    { key: 'quantity', label: 'Number of tickets', type: 'number', required: true, min: 1 },
    notes,
  ],
  home_services: [
    { key: 'serviceDate', label: 'Preferred date', type: 'date', required: true },
    { key: 'serviceTime', label: 'Preferred time', type: 'time' },
    { key: 'address', label: 'Service address', type: 'text', required: true },
    notes,
  ],
  gov_services: [
    { key: 'preferredDate', label: 'Preferred date', type: 'date', required: true },
    { key: 'applicantName', label: 'Applicant name', type: 'text', required: true },
    notes,
  ],
  recruitment: [
    { key: 'preferredStartDate', label: 'Preferred start date', type: 'date', required: true },
    { key: 'rolesNeeded', label: 'Roles needed', type: 'number', required: true, min: 1 },
    notes,
  ],
  b2b: [
    { key: 'preferredDate', label: 'Preferred date', type: 'date', required: true },
    { key: 'quantity', label: 'Order quantity', type: 'number', required: true, min: 1 },
    notes,
  ],
  rental: [
    { key: 'rentalStartDate', label: 'Rental start date', type: 'date', required: true },
    { key: 'rentalEndDate', label: 'Rental end date', type: 'date', required: true },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true, min: 1 },
    notes,
  ],
  donation: [
    { key: 'amount', label: 'Donation amount', type: 'number', required: true, min: 1 },
    notes,
  ],
};

const CATEGORY_ALIASES: Record<string, ServiceCategory> = {
  hotel: 'hotels',
  hotels: 'hotels',
  restaurant: 'restaurants',
  restaurants: 'restaurants',
  reservation: 'restaurants',
  travel: 'travel',
  tour: 'travel',
  tours: 'travel',
  doctor: 'doctors',
  doctors: 'doctors',
  healthcare: 'doctors',
  education: 'education',
  beauty: 'beauty',
  salon: 'beauty',
  spa: 'beauty',
  appointment: 'beauty',
  appointments: 'beauty',
  'real estate': 'real_estate',
  'real-estate': 'real_estate',
  real_estate: 'real_estate',
  property: 'real_estate',
  transport: 'transport',
  transportation: 'transport',
  event: 'events',
  events: 'events',
  wedding: 'events',
  ticket: 'tickets',
  tickets: 'tickets',
  'home service': 'home_services',
  'home services': 'home_services',
  home_services: 'home_services',
  cleaning: 'home_services',
  'gov service': 'gov_services',
  'gov services': 'gov_services',
  gov_services: 'gov_services',
  government: 'gov_services',
  recruitment: 'recruitment',
  hiring: 'recruitment',
  jobs: 'recruitment',
  b2b: 'b2b',
  wholesale: 'b2b',
  rental: 'rental',
  rent: 'rental',
  donation: 'donation',
  donations: 'donation',
  charity: 'donation',
};

export function normalizeServiceCategory(value?: string | null): ServiceCategory {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[&/]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');
  if (CATEGORY_ALIASES[normalized]) return CATEGORY_ALIASES[normalized];
  const match = Object.keys(CATEGORY_ALIASES).find((key) => normalized.includes(key));
  return match ? CATEGORY_ALIASES[match] : 'travel';
}

export function serviceBookingFields(serviceCategory?: string | null): BookingRequestField[] {
  return SERVICE_BOOKING_FIELDS[normalizeServiceCategory(serviceCategory)];
}

export function listingSectionLabels(productType?: string | null) {
  const service = String(productType || '').toLowerCase() === 'service';
  return {
    specifications: service ? 'Service Specifications' : 'Product Specifications',
    overview: service ? 'Service Overview' : 'Product Overview',
    boxContent: service ? 'Complimentary Features' : 'Box Content',
    physicalSpecs: service ? 'Property Specs' : 'Physical Specs',
  };
}

const MANDATORY_WHATS_NEARBY = new Set<ServiceCategory>(['hotels', 'real_estate']);
const OPTIONAL_WHATS_NEARBY = new Set<ServiceCategory>(['restaurants', 'travel']);
const MANDATORY_BEFORE_VISIT = new Set<ServiceCategory>(['doctors', 'beauty']);
const OPTIONAL_BEFORE_VISIT = new Set<ServiceCategory>(['education', 'transport']);
const BASE_BEFORE_VISIT_FIELDS: BeforeYourVisitFieldKey[] = [
  'parkingAvailability',
  'cancellationPolicy',
  'whatToBring',
  'wheelchairAccess',
];

export function resolveRelatedInfoConfig(
  productType?: ProductListingType | string | null,
  serviceCategory?: ServiceCategory | string | null,
): RelatedInfoConfig {
  const listingType = String(productType || 'physical').toLowerCase() === 'service' ? 'service' : 'physical';
  if (listingType === 'physical') {
    return {
      relatedInfoType: 'price_across_stores',
      mandatory: false,
      beforeYourVisitFields: [],
    };
  }

  const normalizedCategory = normalizeServiceCategory(serviceCategory);
  if (MANDATORY_WHATS_NEARBY.has(normalizedCategory) || OPTIONAL_WHATS_NEARBY.has(normalizedCategory)) {
    return {
      relatedInfoType: 'whats_nearby',
      mandatory: MANDATORY_WHATS_NEARBY.has(normalizedCategory),
      beforeYourVisitFields: [],
    };
  }

  if (MANDATORY_BEFORE_VISIT.has(normalizedCategory) || OPTIONAL_BEFORE_VISIT.has(normalizedCategory)) {
    return {
      relatedInfoType: 'before_your_visit',
      mandatory: MANDATORY_BEFORE_VISIT.has(normalizedCategory),
      beforeYourVisitFields:
        normalizedCategory === 'doctors'
          ? [...BASE_BEFORE_VISIT_FIELDS, 'insuranceAccepted']
          : BASE_BEFORE_VISIT_FIELDS,
    };
  }

  return {
    relatedInfoType: 'before_your_visit',
    mandatory: false,
    beforeYourVisitFields: BASE_BEFORE_VISIT_FIELDS,
  };
}

export const BOOKING_SELLER_RESPONSE_HOURS = 24;
export const BOOKING_PAYMENT_WINDOW_HOURS = 8;

export function getBookingFieldConfigPayload() {
  return {
    categories: SERVICE_CATEGORIES.map((id) => ({
      id,
      label: SERVICE_CATEGORY_LABELS[id],
      fields: SERVICE_BOOKING_FIELDS[id],
    })),
    fieldsByCategory: SERVICE_BOOKING_FIELDS,
    sellerResponseHours: BOOKING_SELLER_RESPONSE_HOURS,
    paymentWindowHours: BOOKING_PAYMENT_WINDOW_HOURS,
    sectionLabels: {
      service: listingSectionLabels('service'),
      physical: listingSectionLabels('physical'),
    },
  };
}
