/**
 * Category search for the two-level category picker (community profiles, seller
 * sign-up, Brand Studio). A person types what they sell ("shoes", "gift",
 * "উপহার") and gets ranked Main › Subcategory matches from the live catalog
 * taxonomy. Extra search words per category live here so plain words find the
 * right place without inventing new categories.
 */

export type SearchableCategory = { id: string; name: string; slug?: string; parentId?: string | null; enabled?: boolean };

export type CategoryMatch = {
  main: SearchableCategory;
  /** Absent = the main category itself. */
  sub?: SearchableCategory;
  score: number;
};

/** Extra search words (English + common Bangla) keyed by category id. */
export const CATEGORY_SEARCH_WORDS: Record<string, string[]> = {
  'cat-gifts': ['gift', 'gifts', 'present', 'উপহার', 'গিফট', 'occasion'],
  'sub-gifts-occasions-gift-items-showpieces': ['showpiece', 'souvenir', 'decor gift', 'gift shop', 'gift item'],
  'sub-gifts-occasions-gift-hampers-baskets': ['hamper', 'basket', 'gift box', 'box'],
  'sub-gifts-occasions-personalised-custom-gifts': ['personalized', 'custom', 'customised', 'customized', 'name print', 'engraved', 'photo frame'],
  'sub-gifts-occasions-corporate-gifts': ['corporate', 'office gift', 'promotional', 'branded merchandise', 'crest'],
  'sub-gifts-occasions-festival-eid-gifts': ['eid', 'puja', 'boishakh', 'christmas', 'festival', 'ঈদ'],
  'sub-gifts-occasions-flowers-bouquets': ['flower', 'flowers', 'bouquet', 'florist', 'ফুল'],
  'sub-gifts-occasions-party-supplies-decorations': ['party', 'birthday', 'balloon', 'decoration'],
  'sub-gifts-occasions-greeting-cards-gift-wrap': ['card', 'greeting', 'wrap', 'wrapping'],
  'cat-fashion': ['clothing', 'clothes', 'apparel', 'fashion', 'পোশাক', 'জামা'],
  'sub-fashion-lifestyle-mens-fashion': ['shirt', 'tshirt', 't-shirt', 'panjabi', 'pant', 'jeans', 'menswear', 'casualwear', 'casual wear', 'formal wear', 'পাঞ্জাবি'],
  'sub-fashion-lifestyle-womens-fashion': ['dress', 'kurti', 'tops', 'womenswear', 'ladies', 'casualwear', 'casual wear', 'western wear'],
  'cat-mobile': ['phone', 'smartphone', 'mobile', 'iphone', 'android', 'ফোন', 'মোবাইল'],
  'sub-electronics-computers': ['laptop', 'desktop', 'pc', 'computer', 'macbook', 'monitor', 'ল্যাপটপ'],
  'sub-electronics-tv-entertainment': ['tv', 'television', 'led tv', 'projector'],
  'cat-appliances': ['fridge', 'refrigerator', 'ac', 'air conditioner', 'washing machine', 'oven', 'fan', 'blender'],
  'sub-travel-hospitality-accommodation-booking': ['hotel', 'hotel booking', 'room booking', 'resort', 'guest house'],
  'sub-fashion-lifestyle-footwear': ['shoe', 'shoes', 'sandal', 'sneaker', 'boot', 'loafer', 'slipper', 'জুতা'],
  'sub-fashion-lifestyle-bags-luggage': ['bag', 'handbag', 'backpack', 'wallet', 'luggage', 'ব্যাগ'],
  'sub-fashion-lifestyle-fashion-accessories': ['accessories', 'belt', 'cap', 'scarf', 'tie'],
  'sub-fashion-lifestyle-traditional-ethnic-wear': ['saree', 'sari', 'salwar', 'lehenga', 'sherwani', 'ethnic', 'traditional', 'শাড়ি'],
  'sub-fashion-lifestyle-modest-wear-hijab-abaya': ['hijab', 'abaya', 'borka', 'burqa', 'niqab', 'modest', 'হিজাব'],
  'sub-fashion-lifestyle-kids-fashion': ['kids clothing', 'kids wear', 'children clothes', 'baby dress'],
  'sub-fashion-lifestyle-innerwear-sleepwear': ['innerwear', 'lingerie', 'nightwear', 'pajama', 'underwear'],
  'sub-fashion-lifestyle-watches': ['watch', 'watches', 'ঘড়ি'],
  'sub-fashion-lifestyle-leather-goods': ['leather', 'leather goods', 'leather products', 'wallet', 'belt', 'leather bag', 'leather shoes', 'handcrafted leather', 'চামড়া'],
  'sub-fashion-lifestyle-eyewear': ['eyeglass', 'eyeglasses', 'glasses', 'sunglass', 'sunglasses', 'optical', 'lens', 'চশমা'],
  'cat-jewelry': ['jewellery', 'jewelry', 'jewelleries', 'ornament', 'গহনা', 'অলংকার'],
  'sub-jewelry-luxury-fashion-artificial-jewellery': ['artificial', 'imitation', 'fashion jewellery', 'earring', 'necklace', 'bangle', 'ring'],
  'sub-jewelry-luxury-gold': ['gold', 'সোনা'],
  'sub-jewelry-luxury-silver': ['silver', 'রুপা'],
  'cat-beauty': ['beauty', 'cosmetics', 'health', 'pharmacy', 'medicine'],
  'sub-beauty-health-pharmacy-fragrances-perfumes': ['perfume', 'fragrance', 'attar', 'itr', 'body spray', 'decant', 'আতর'],
  'sub-beauty-health-pharmacy-personal-care': ['soap', 'shampoo', 'toiletries', 'hygiene', 'sanitary'],
  'sub-beauty-health-pharmacy-health-supplements-wellness': ['supplement', 'vitamin', 'protein', 'wellness', 'herbal'],
  'cat-tech': ['gadget', 'gadgets', 'tech', 'electronic'],
  'sub-electronics-mobile-computer-accessories': ['gadget', 'gadgets', 'charger', 'cable', 'power bank', 'case', 'cover', 'keyboard', 'mouse', 'earphone'],
  'sub-electronics-smart-watches-wearables': ['smartwatch', 'smart watch', 'fitness band', 'wearable'],
  'sub-electronics-smart-home-networking': ['router', 'wifi', 'cctv', 'smart home', 'camera security'],
  'cat-home': ['home', 'household', 'living'],
  'sub-home-furniture-appliances-home-decor': ['decor', 'decore', 'home decor', 'interior decor', 'decoration', 'vase', 'candle', 'cushion', 'curtain', 'showpiece'],
  'sub-home-furniture-appliances-paintings-wall-art': ['art', 'painting', 'paintings', 'wall art', 'canvas', 'frame', 'artist'],
  'sub-home-furniture-appliances-bedding-bath': ['bedsheet', 'bed sheet', 'pillow', 'towel', 'blanket', 'comforter', 'kantha'],
  'sub-home-furniture-appliances-cleaning-laundry': ['cleaning', 'detergent', 'mop', 'laundry'],
  'sub-home-furniture-appliances-garden-plants': ['plant', 'plants', 'garden', 'nursery', 'pot', 'গাছ'],
  'sub-home-furniture-appliances-tools-hardware': ['tools', 'hardware', 'paint', 'electrical', 'plumbing'],
  'sub-home-furniture-appliances-handicrafts-handloom': ['handicraft', 'handmade', 'handloom', 'pottery', 'ceramic', 'nakshi', 'jute', 'bamboo', 'craft'],
  'sub-home-furniture-appliances-kitchen-dining': ['cookware', 'crockery', 'dinner set', 'utensil'],
  'cat-food': ['food', 'grocery', 'খাবার', 'বাজার'],
  'sub-grocery-food-bakery-cakes-sweets': ['cake', 'bakery', 'sweets', 'mishti', 'dessert', 'মিষ্টি', 'কেক'],
  'sub-grocery-food-restaurants-home-kitchens': ['restaurant', 'cafe', 'home kitchen', 'home cook', 'meal', 'food delivery', 'tiffin'],
  'sub-grocery-food-snacks-instant-food': ['snacks', 'chips', 'noodles', 'biscuit'],
  'sub-grocery-food-cooking-essentials': ['oil', 'rice', 'spice', 'masala', 'flour', 'chal', 'dal'],
  'sub-grocery-food-organic-health-food': ['organic', 'honey', 'ghee', 'healthy food', 'মধু'],
  'cat-baby': ['baby', 'kids', 'child', 'toy', 'শিশু'],
  'cat-books': ['book', 'books', 'education', 'art', 'বই'],
  'sub-books-education-arts-religious-books-items': ['islamic', 'quran', 'prayer mat', 'tasbih', 'religious'],
  'cat-automotive': ['car', 'vehicle', 'auto'],
  'sub-automotive-motorbikes-accessories': ['motorbike', 'bike', 'motorcycle', 'helmet', 'scooter'],
  'cat-sporting': ['sport', 'fitness', 'gym', 'outdoor'],
  'sub-sports-fitness-outdoor-sportswear': ['jersey', 'sportswear', 'activewear', 'trackpant'],
  'cat-pets': ['pet', 'cat food', 'dog', 'agri'],
  'cat-travel': ['travel', 'tour', 'hotel', 'resort'],
  'cat-events': ['event', 'wedding', 'biye', 'বিয়ে'],
  'cat-services': ['service', 'repair'],
  'sub-professional-home-services-interior-design': ['interior', 'interior design', 'interior decor', 'interior decoration', 'renovation', 'ইন্টেরিয়র'],
  'sub-professional-home-services-pest-control': ['pest', 'pest control', 'termite', 'cockroach', 'mosquito', 'rat'],
  'sub-professional-home-services-cleaning-services': ['cleaning service', 'house cleaning', 'deep cleaning', 'sofa cleaning', 'tank cleaning'],
  'sub-professional-home-services-laundry-dry-cleaning': ['laundry', 'dry cleaning', 'dry clean', 'ironing', 'wash'],
  'sub-professional-home-services-printing-packaging': [
    'printing', 'print', 'press', 'packaging', 'box printing', 'sticker', 'stickers', 'banner', 'flex', 'festoon', 'signboard',
    'visiting card', 'business card', 'label', 'leaflet', 'brochure', 'poster', 't-shirt printing', 'mug printing', 'screen print', 'ছাপা', 'প্রিন্টিং',
  ],
  'sub-books-education-arts-stationery': ['stationery', 'stationary', 'stationeries', 'stationaries', 'pen', 'pencil', 'notebook', 'diary', 'khata', 'paper', 'school supplies', 'খাতা', 'কলম'],
  'sub-industrial-business-business-supplies': ['office supplies', 'office stationery', 'files', 'printer paper', 'toner'],
  'sub-professional-home-services-courier-delivery': ['courier', 'delivery', 'parcel', 'logistics', 'shipping'],
  'sub-professional-home-services-tutoring-coaching': ['tutor', 'tuition', 'coaching', 'teacher', 'home tutor', 'প্রাইভেট'],
  'sub-professional-home-services-salon-beauty-services': ['salon', 'parlour', 'parlor', 'beauty parlour', 'spa', 'haircut', 'makeover', 'bridal makeup', 'mehedi'],
  'sub-pets-agriculture-pet-care-grooming': ['pet care', 'grooming', 'pet grooming', 'pet hotel', 'pet boarding', 'cat care', 'dog care'],  'cat-digital': ['digital', 'software', 'online'],
};

// \p{M} keeps Bangla vowel signs inside the word (জুতা is one word, not জ + ত).
const tokenise = (v: string) =>
  v
    .toLowerCase()
    .replace(/&/g, ' ')
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((t) => t.length > 0);

/** Singular form for comparison (shoes → shoe, boxes → box); short words untouched. */
const singular = (t: string) => (t.length > 4 && t.endsWith('es') ? t.slice(0, -2) : t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t);

/** How well `query` matches a label/word list: phrase > all words > some words (prefix-aware). */
function matchScore(query: string, haystack: string[]): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const phrases = haystack.map((h) => h.toLowerCase());
  if (phrases.some((h) => h === q)) return 100;
  if (phrases.some((h) => h.startsWith(q))) return 80;
  if (phrases.some((h) => h.includes(q))) return 60;
  const qTokens = tokenise(q);
  const hTokens = new Set(phrases.flatMap(tokenise));
  // A typed word matches a word that equals it, is its singular/plural, or that it begins (typing "shoe" finds "shoes").
  const hit = (t: string) => [...hTokens].some((h) => h === t || singular(h) === singular(t) || (t.length >= 3 && h.startsWith(t)));
  const hits = qTokens.filter(hit).length;
  if (!hits) return 0;
  return hits === qTokens.length ? 50 : 20 * (hits / qTokens.length);
}

/**
 * Ranked Main › Subcategory matches for `query` (empty query = no matches; the
 * picker then shows the browse list). Disabled categories are never offered.
 */
export function searchCategories(categories: SearchableCategory[], query: string, limit = 12): CategoryMatch[] {
  const live = categories.filter((c) => c.enabled !== false);
  const mains = live.filter((c) => !c.parentId);
  const byId = new Map(mains.map((m) => [m.id, m]));
  const words = (c: SearchableCategory) => [c.name, ...(CATEGORY_SEARCH_WORDS[c.id] ?? [])];
  const out: CategoryMatch[] = [];
  for (const main of mains) {
    const s = matchScore(query, words(main));
    if (s > 0) out.push({ main, score: s + 1 }); // a main ranks just above an equally good sub
  }
  for (const sub of live.filter((c) => c.parentId)) {
    const main = byId.get(String(sub.parentId));
    if (!main) continue;
    const own = matchScore(query, words(sub));
    // A sub also matches weakly through its main ("fashion" lists Footwear too).
    const viaMain = matchScore(query, words(main)) * 0.4;
    const s = Math.max(own, viaMain);
    if (s > 0) out.push({ main, sub, score: s });
  }
  // With a strong match, leave out matches on only part of what was typed.
  const best = Math.max(0, ...out.map((m) => m.score));
  return out
    .filter((m) => best < 50 || m.score >= 30)
    .sort((a, b) => b.score - a.score || (a.sub ? 1 : 0) - (b.sub ? 1 : 0) || labelOf(a).localeCompare(labelOf(b)))
    .slice(0, limit);
}

export const labelOf = (m: { main: SearchableCategory; sub?: SearchableCategory }) =>
  m.sub ? `${m.main.name} › ${m.sub.name}` : m.main.name;
