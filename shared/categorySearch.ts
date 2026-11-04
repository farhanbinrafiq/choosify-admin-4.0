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
  'sub-gifts-occasions-gift-items-showpieces': ['showpiece', 'decor gift', 'gift shop', 'gift item'],
  'sub-gifts-occasions-gift-hampers-baskets': ['hamper', 'basket', 'gift box', 'box'],
  'sub-gifts-occasions-personalised-custom-gifts': ['personalized', 'custom', 'customised', 'customized', 'name print', 'engraved', 'photo frame'],
  'sub-gifts-occasions-corporate-gifts': ['corporate', 'office gift', 'promotional', 'branded merchandise'],
  'sub-gifts-occasions-festival-eid-gifts': ['eid', 'puja', 'boishakh', 'christmas', 'festival', 'ঈদ'],
  'sub-gifts-occasions-flowers-bouquets': ['flower', 'flowers', 'bouquet', 'florist', 'ফুল'],
  'sub-gifts-occasions-party-supplies-decorations': ['party', 'birthday', 'balloon', 'decoration'],
  'sub-gifts-occasions-greeting-cards-gift-wrap': ['card', 'greeting', 'wrap', 'wrapping'],
  'cat-fashion': ['clothing', 'clothes', 'apparel', 'fashion', 'পোশাক', 'জামা'],
  'sub-fashion-lifestyle-mens-fashion': ['shirt', 'tshirt', 't-shirt', 'pant', 'jeans', 'menswear', 'casualwear', 'casual wear', 'mens clothing', "men's clothing", 'mens wear', 'gents', 'trouser', 'trousers', 'chinos', 'formal shirt', 'formal pant', 'polo shirt'],
  'sub-fashion-lifestyle-womens-fashion': ['dress', 'tops', 'womenswear', 'ladies', 'casualwear', 'casual wear', 'western wear'],
  'cat-mobile': ['phone', 'smartphone', 'mobile', 'iphone', 'android', 'ফোন', 'মোবাইল'],
  'sub-electronics-computers': ['laptop', 'desktop', 'pc', 'computer', 'macbook', 'monitor', 'ল্যাপটপ'],
  'sub-electronics-tv-entertainment': ['tv', 'television', 'led tv', 'projector'],
  'cat-appliances': ['fridge', 'refrigerator', 'ac', 'air conditioner', 'washing machine', 'oven', 'fan', 'blender'],
  'sub-travel-hospitality-accommodation-booking': ['hotel', 'hotel booking', 'room booking', 'resort', 'guest house'],
  'sub-fashion-lifestyle-footwear': ['shoe', 'shoes', 'sandal', 'boot', 'slipper', 'জুতা', 'fashion shoes', 'fashion footwear', 'footwear brand', 'kids shoes'],
  'sub-fashion-lifestyle-bags-luggage': ['bag', 'handbag', 'backpack', 'wallet', 'luggage', 'ব্যাগ'],
  'sub-fashion-lifestyle-fashion-accessories': ['accessories', 'belt', 'cap', 'scarf'],
  'sub-fashion-lifestyle-traditional-ethnic-wear': ['ethnic', 'ethnic wear', 'traditional', 'traditional wear', 'traditional dress', 'traditional clothing', 'deshi', 'deshi wear'],
  'sub-fashion-lifestyle-modest-wear-hijab-abaya': ['hijab', 'abaya', 'borka', 'burqa', 'niqab', 'modest', 'হিজাব'],
  'sub-fashion-lifestyle-kids-fashion': ['kids clothing', 'kids wear', 'children clothes', 'baby dress'],
  'sub-fashion-lifestyle-innerwear-sleepwear': ['innerwear', 'nightwear', 'pajama', 'underwear'],
  'sub-fashion-lifestyle-watches': ['watch', 'watches', 'ঘড়ি'],
  'sub-fashion-lifestyle-leather-goods': ['leather', 'leather goods', 'leather products', 'wallet', 'belt', 'leather bag', 'leather shoes', 'handcrafted leather', 'চামড়া'],
  'sub-fashion-lifestyle-eyewear': ['eyeglass', 'eyeglasses', 'glasses', 'sunglass', 'sunglasses', 'optical', 'lens', 'চশমা'],
  'cat-jewelry': ['jewellery', 'jewelry', 'jewelleries', 'ornament', 'গহনা', 'অলংকার'],
  'sub-jewelry-luxury-fashion-artificial-jewellery': ['artificial', 'imitation', 'fashion jewellery', 'costume jewellery'],
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

/** More search words (2026-11-02 audit of ~120 common seller/shopper terms), merged with the list above. */
const MORE_SEARCH_WORDS: Record<string, string[]> = {
  'sub-beauty-health-pharmacy-makeup': ['cosmetics', 'cosmetic', 'lipstick', 'lip', 'nail polish', 'nail', 'foundation', 'kajal', 'eyeliner', 'mascara', 'compact powder', 'makeup', 'মেকআপ'],
  'sub-beauty-health-pharmacy-skincare': ['skin care', 'skincare', 'skin', 'face wash', 'facewash', 'serum', 'sunscreen', 'sunblock', 'moisturizer', 'moisturiser', 'cream', 'lotion', 'toner', 'face mask', 'k-beauty', 'korean skincare'],
  'sub-beauty-health-pharmacy-hair-care': ['hair oil', 'shampoo', 'conditioner', 'hair color', 'hair colour', 'hair serum'],
  'sub-beauty-health-pharmacy-mens-grooming': ['beard', 'beard oil', 'trimmer', 'shaving', 'razor', 'grooming'],
  'sub-beauty-health-pharmacy-herbal-unani-homeopathy': ['herbal', 'ayurvedic', 'ayurveda', 'unani', 'homeopathy', 'homeopathic', 'natural remedy', 'kabiraji', 'হোমিওপ্যাথি'],
  'sub-beauty-health-pharmacy-medical-devices': ['hearing aid', 'wheelchair', 'bp machine', 'blood pressure', 'glucometer', 'thermometer', 'nebulizer', 'oximeter'],
  'sub-beauty-health-pharmacy-personal-care': ['toothpaste', 'toothbrush', 'dental', 'dental care', 'oral care', 'deodorant'],
  'sub-beauty-health-pharmacy-otc-medicines': ['medicine', 'pharmacy', 'ঔষধ', 'ওষুধ'],
  'sub-baby-kids-toys-baby-care': ['diaper', 'diapers', 'baby wipes', 'baby lotion', 'baby soap'],
  'sub-baby-kids-toys-baby-feeding': ['baby food', 'feeder', 'baby bottle', 'formula milk'],
  'sub-baby-kids-toys-toys': ['toy car', 'rc car', 'doll', 'lego', 'action figure', 'kids toys'],
  'sub-baby-kids-toys-educational-toys': ['board game', 'puzzle', 'learning toys', 'montessori'],
  'sub-electronics-gadgets-accessories': ['gadget', 'gadgets', 'gadget accessories', 'gadgets & accessories', 'accessories', 'tech accessories', 'smart gadgets', 'mobile accessories', 'electronic accessories'],
  'sub-electronics-audio': ['headphone', 'headphones', 'earphone', 'earbuds', 'earbud', 'airpods', 'speaker', 'speakers', 'bluetooth speaker', 'soundbox', 'neckband'],
  'cat-mobile': ['tablet', 'ipad', 'feature phone', 'used phone'],
  'sub-electronics-tv-entertainment': ['smart tv', 'android tv', 'led tv'],
  'sub-gaming-entertainment-gaming-consoles': ['ps5', 'ps4', 'playstation', 'xbox', 'nintendo', 'console'],
  'sub-gaming-entertainment-video-games': ['esports', 'e-sports', 'game top up', 'gaming'],
  'sub-home-furniture-appliances-furniture': ['sofa', 'bed', 'bed frame', 'table', 'chair', 'wardrobe', 'almirah', 'dining table', 'shelf', 'আসবাব'],
  'sub-home-furniture-appliances-home-decor': ['carpet', 'rug', 'doormat', 'mat', 'wall clock', 'decor items'],
  'sub-home-furniture-appliances-lighting': ['lights', 'light', 'lamp', 'led light', 'bulb', 'chandelier', 'fairy lights'],
  'sub-home-furniture-appliances-bedding-bath': ['mosquito net', 'mattress', 'bed cover', 'quilt'],
  'cat-appliances': ['rice cooker', 'microwave', 'iron', 'water purifier', 'geyser', 'kettle'],
  'sub-grocery-food-beverages': ['tea', 'coffee', 'juice', 'soft drink', 'drinks', 'water', 'cha', 'চা', 'কফি'],
  'sub-grocery-food-dairy-eggs': ['milk', 'butter', 'cheese', 'yogurt', 'doi', 'ghee', 'দুধ', 'ডিম'],
  'sub-grocery-food-cooking-essentials': ['spices', 'spice', 'masala', 'salt', 'sugar', 'মসলা'],
  'sub-grocery-food-organic-health-food': ['dates', 'khejur', 'dry fruits', 'nuts', 'almond', 'খেজুর'],
  'sub-grocery-food-snacks-instant-food': ['frozen food', 'frozen', 'ready to cook', 'nuggets'],
  'sub-fashion-lifestyle-traditional-ethnic-wear': ['lungi', 'gamcha', 'fatua', 'লুঙ্গি', 'গামছা'],
  'sub-fashion-lifestyle-womens-fashion': ['boutique', 'ladies wear', 'womens clothing'],
  'sub-fashion-lifestyle-bags-luggage': ['wallet', 'small bag', 'chest bag', 'sling bag', 'crossbody', 'clutch', 'ladies clutch', 'clutch bag', 'hand bag', 'handbag', 'purse', 'tote', 'laptop bag', 'school bag', 'travel bag', 'luggage', 'trolley'],
  'sub-fashion-lifestyle-leather-goods': ['wallet', 'leather wallet', 'leather belt', 'leather jacket', 'chest bag'],
  'sub-sports-fitness-outdoor-sports': ['cricket', 'cricket bat', 'football', 'badminton', 'tennis', 'sports equipment', 'jersey'],
  'sub-books-education-arts-musical-instruments': ['guitar', 'piano', 'tabla', 'violin', 'drum', 'ukulele', 'harmonium'],
  'sub-pets-agriculture-agriculture': ['fertilizer', 'fertiliser', 'pesticide', 'farming', 'agro', 'compost'],
  'sub-pets-agriculture-pet-accessories': ['cat litter', 'litter', 'pet toys', 'cage', 'aquarium'],
  'sub-professional-home-services-repair-maintenance': ['plumber', 'electrician', 'ac repair', 'ac service', 'appliance repair', 'mobile repair', 'carpenter', 'painter'],
  'sub-professional-home-services-it-services': ['website development', 'web development', 'website', 'app development', 'software development', 'web design'],
  'sub-professional-home-services-graphic-design-branding': ['graphic design', 'logo design', 'branding', 'designer', 'ui ux', 'creative design'],
  'sub-professional-home-services-tailoring-alterations': ['tailor', 'tailoring', 'alteration', 'darji', 'stitching', 'custom tailoring', 'দর্জি'],
  'sub-professional-home-services-salon-beauty-services': ['mehendi', 'mehndi', 'mehedi artist', 'makeup artist', 'bridal makeup'],
  'sub-events-wedding-decoration': ['decorator', 'event decoration', 'stage decoration', 'holud decoration'],
  'sub-travel-hospitality-vehicle-rental': ['rent a car', 'car rental', 'car rent', 'microbus rent'],
  'sub-real-estate-rent-property': ['flat rent', 'to-let', 'to let', 'apartment rent', 'house rent', 'বাসা ভাড়া'],
  'cat-business': ['company', 'business', 'corporate', 'firm', 'enterprise', 'startup'],
  'sub-business-corporate-e-commerce-online-marketplace': ['ecommerce', 'e-commerce', 'e-commerce marketplace', 'online shop', 'online store', 'online marketplace', 'marketplace', 'f-commerce', 'online business'],
  'sub-business-corporate-saas-software-company': ['saas', 'software company', 'software firm', 'tech company', 'it company', 'platform'],
  'sub-business-corporate-corporate-conglomerate': ['corporate', 'conglomerate', 'group of companies', 'limited company', 'ltd'],
  'sub-business-corporate-b2b-company': ['b2b', 'b2b company', 'supplier', 'manufacturer company', 'trading company'],
  'sub-business-corporate-marketing-creative-agency': ['agency', 'marketing agency', 'creative agency', 'ad agency', 'advertising agency', 'pr agency'],
  'sub-business-corporate-design-house': ['design house', 'design studio', 'fashion house', 'design firm'],
  'sub-business-corporate-consultancy-advisory': ['consultancy', 'consultant', 'advisory', 'consulting', 'business consultant'],
};

/** Accessories, jewellery by type, souvenirs and gift terms (2026-11-03 audit), merged with the lists above. */
const ACCESSORY_SEARCH_WORDS: Record<string, string[]> = {
  'sub-fashion-lifestyle-mens-accessories': ["men's accessories", 'mens accessories', 'men accessories', 'money clip', 'keychain', 'key chain', 'key ring', 'keyring', 'handkerchief', 'men belt'],
  'sub-fashion-lifestyle-ties-bow-ties-cufflinks': ['tie', 'ties', 'necktie', 'neck tie', 'neckties', 'bow tie', 'bowtie', 'bow ties', 'bow', 'cufflinks', 'cufflink', 'cuff links', 'tie pin', 'tie clip', 'tie bar', 'pocket square', 'pocket squares', 'suspenders', 'braces', 'lapel pin', 'টাই'],
  'sub-fashion-lifestyle-gowns-party-wear': ['gown', 'gowns', 'evening gown', 'ball gown', 'party gown', 'party dress', 'party dresses', 'party wear', 'partywear', 'party outfit', 'cocktail dress', 'gala', 'gala night', 'galla night', 'gala dress', 'prom', 'prom dress', 'evening wear', 'evening dress', 'night out dress', 'পার্টি ড্রেস', 'গাউন'],
  'sub-fashion-lifestyle-bridal-wedding-wear': ['bridal wear', 'bridal dress', 'bridal gown', 'bridal outfit', 'bridal lehenga', 'bridal saree', 'wedding dress', 'wedding gown', 'wedding lehenga', 'wedding saree', 'wedding outfit', 'wedding wear', 'wedding collection', 'groom wear', 'groom outfit', 'holud outfit', 'holud saree', 'gaye holud dress', 'mehendi outfit', 'বিয়ের পোশাক', 'বিয়ের শাড়ি'],
  'sub-fashion-lifestyle-costumes-cosplay': ['costume', 'costumes', 'cosplay', 'cosplayer', 'fancy dress', 'halloween', 'halloween costume', 'kids costume', 'anime cosplay', 'theatre costume', 'drama costume', 'stage costume', 'mascot costume', 'dress up', 'superhero costume'],
  'sub-fashion-lifestyle-lighters-smoking-accessories': ['lighter', 'lighters', 'zippo', 'gas lighter', 'torch lighter', 'jet lighter', 'electric lighter', 'cigarette box', 'cigarette case', 'cigar case', 'cigar box', 'ashtray', 'hookah', 'shisha', 'smoking accessories', 'smoking pipe', 'matchbox', 'match box', 'rolling paper', 'লাইটার'],
  'sub-fashion-lifestyle-hair-accessories': ['hair accessories', 'hair clip', 'claw clip', 'hair pin', 'hairpin', 'hair band', 'hairband', 'headband', 'scrunchie', 'scrunchies', 'hair tie', 'tiara'],
  'sub-fashion-lifestyle-caps-hats-scarves': ['cap', 'caps', 'hat', 'hats', 'beanie', 'bucket hat', 'baseball cap', 'scarf', 'scarves', 'muffler', 'shawl', 'stole', 'bandana', 'টুপি'],
  'sub-jewelry-luxury-mens-jewellery': ["men's jewellery", "men's jewelry", 'mens jewellery', 'mens jewelry', 'men jewellery', "men's bracelet", 'mens bracelet', 'men bracelet', 'leather bracelet', 'mens ring', 'mens chain', 'kada', 'stainless steel jewellery', 'titanium ring', 'mens jewelries'],
  'sub-jewelry-luxury-bracelets-bangles': ['bracelet', 'bracelets', 'bangle', 'bangles', 'churi', 'charm bracelet', 'cuff bracelet', 'চুড়ি'],
  'sub-jewelry-luxury-rings': ['ring', 'rings', 'finger ring', 'stone ring', 'engagement ring', 'couple ring', 'wedding ring', 'আংটি'],
  'sub-jewelry-luxury-necklaces-chains-pendants': ['necklace', 'necklaces', 'chain', 'neck chain', 'gold chain', 'pendant', 'locket', 'choker', 'mala', 'হার'],
  'sub-jewelry-luxury-earrings-nose-pins': ['earring', 'earrings', 'ear ring', 'studs', 'jhumka', 'jhumki', 'nose pin', 'nosepin', 'nose ring', 'nakfool', 'কানের দুল', 'নাকফুল'],
  'sub-jewelry-luxury-handmade-beaded-jewellery': ['handmade jewellery', 'handmade jewelry', 'beaded jewellery', 'beaded jewelry', 'beads', 'terracotta jewellery', 'oxidised jewellery', 'oxidized jewelry', 'tribal jewellery', 'resin jewellery', 'fabric jewellery'],
  'sub-jewelry-luxury-gemstones-birthstones': ['gemstone', 'gemstones', 'gem stone', 'birthstone', 'birth stone', 'ruby', 'emerald', 'sapphire', 'pearl', 'rashi stone', 'রত্ন পাথর'],
  'sub-jewelry-luxury-luxury-pens-accessories': ['luxury pen', 'luxury pens', 'designer pen', 'luxury lighter', 'luxury accessories', 'cigar accessories', 'luxury cufflinks', 'mont blanc', 'montblanc', 'parker pen'],
  'sub-gifts-occasions-souvenirs-keepsakes': ['souvenir', 'souvenirs', 'souveniers', 'souvenier', 'keepsake', 'keepsakes', 'fridge magnet', 'travel souvenir', 'tourist souvenir', 'স্যুভেনির'],
  'sub-gifts-occasions-crests-trophies-awards': ['crest', 'crests', 'memento', 'trophy', 'trophies', 'award', 'awards', 'medal', 'medals', 'plaque', 'shield', 'ক্রেস্ট'],
  'sub-gifts-occasions-collectibles-miniatures': ['collectible', 'collectibles', 'collection', 'miniature', 'miniatures', 'figurine', 'figurines', 'die cast', 'diecast', 'model car', 'scale model', 'coin collection', 'stamp collection'],
  'sub-home-furniture-appliances-candles-home-fragrance': ['candle', 'candles', 'scented candle', 'incense', 'incense sticks', 'agarbatti', 'diffuser', 'reed diffuser', 'room freshener', 'air freshener', 'aroma', 'bakhoor', 'আগরবাতি'],
  'sub-fashion-lifestyle-fashion-accessories': ['umbrella', 'gloves', 'safety pin'],
  'sub-fashion-lifestyle-footwear': ['nagra', 'nagra shoes', 'mojari', 'khussa', 'kolhapuri'],
  'sub-fashion-lifestyle-bespoke-custom-tailoring': ['bespoke', 'bespoke tailoring', 'bespoke tailor', 'bespoke suit', 'bespoke shirt', 'custom tailoring', 'custom tailor', 'custom suit', 'custom made', 'custom made clothing', 'made to measure', 'made-to-measure', 'mtm', 'sartorial', 'sartorial tailoring', 'tailor made', 'tailor-made', 'tailored suit', 'custom shirt'],
  'sub-fashion-lifestyle-suits-blazers-formal-wear': ['suit', 'suits', 'blazer', 'blazers', 'tuxedo', 'formal suit', 'wedding suit', 'groom suit', 'business suit', 'three piece suit', '3 piece suit', 'two piece suit', 'coat', 'sport coat', 'formal wear', 'formalwear', 'স্যুট', 'কোট', 'ব্লেজার'],
  'sub-fashion-lifestyle-formal-dress-shoes': ['formal shoes', 'dress shoes', 'oxford', 'oxfords', 'oxford shoes', 'derby', 'derby shoes', 'brogue', 'brogues', 'monk strap', 'monk shoes', 'loafer', 'loafers', 'chelsea boots', 'office shoes', 'party shoes', 'wedding shoes', 'formal footwear'],
  'sub-fashion-lifestyle-womens-footwear': ["women's footwear", 'womens footwear', 'ladies shoes', 'ladies footwear', 'heels', 'high heels', 'heel', 'block heels', 'stilettos', 'wedges', 'flats', 'ballet flats', 'pumps', 'ladies sandals', 'mules'],
  'sub-fashion-lifestyle-sneakers-sports-shoes': ['sneaker', 'sneakers', 'sports shoes', 'running shoes', 'trainers', 'canvas shoes', 'casual shoes', 'gym shoes', 'football boots', 'cricket shoes', 'walking shoes'],
  'sub-fashion-lifestyle-panjabi-sherwani': ['panjabi', 'panjabis', 'punjabi', 'eid panjabi', 'kabli', 'kabli panjabi', 'kabuli', 'panjabi pajama', 'kurta', 'mens kurta', "men's kurta", 'kurta pajama', 'sherwani', 'wedding sherwani', 'groom sherwani', 'achkan', 'koti', 'waistcoat', 'nehru coat', 'mujib coat', 'jubba', 'jubbah', 'thobe', 'pagri', 'turban', 'পাঞ্জাবি', 'শেরওয়ানি', 'কাবলি', 'কোটি'],
  'sub-fashion-lifestyle-sarees-blouses': ['saree', 'sarees', 'sari', 'jamdani', 'jamdani saree', 'katan', 'katan saree', 'silk saree', 'tant', 'tant saree', 'cotton saree', 'muslin', 'muslin saree', 'benarasi', 'banarasi', 'half silk', 'tangail saree', 'rajshahi silk', 'blouse', 'saree blouse', 'readymade blouse', 'শাড়ি', 'জামদানি', 'ব্লাউজ'],
  'sub-fashion-lifestyle-salwar-kameez-three-piece': ['salwar', 'salwar kameez', 'shalwar kameez', 'kameez', 'three piece', '3 piece', 'thri piece', 'three pcs', 'unstitched three piece', 'stitched three piece', 'two piece', 'kurti', 'tunic', 'lehenga', 'gharara', 'sharara', 'orna', 'dupatta', 'থ্রি পিস', 'সালোয়ার কামিজ', 'ওড়না'],
  'sub-beauty-health-pharmacy-cosmetics-beauty-products': ['cosmetics', 'cosmetic', 'cosmetics shop', 'cosmetic shop', 'cosmetics store', 'beauty products', 'beauty product', 'beauty shop', 'beauty store', 'korean cosmetics', 'k-beauty products', 'imported cosmetics', 'original cosmetics', 'halal cosmetics', 'organic cosmetics', 'natural cosmetics', 'makeup kit', 'makeup products', 'beauty box', 'cosmetics wholesale', 'কসমেটিকস', 'কসমেটিক্স', 'প্রসাধনী', 'বিউটি প্রোডাক্ট'],
  'sub-fashion-lifestyle-innerwear-sleepwear': ['socks', 'stockings', 'sleepwear', 'nighty', 'nightie', 'nightgown', 'night dress', 'night suit', 'pyjama', 'pajamas', 'loungewear', 'robe', 'bathrobe', 'thermal', 'thermal wear', 'thermals', 'petticoat', 'saree petticoat', 'slip', 'leggings'],
  'sub-fashion-lifestyle-lingerie-bras': ['lingerie', 'lingeries', 'ligneries', 'lingery', 'bra', 'bras', 'brassiere', 'sports bra', 'push up bra', 'padded bra', 'nursing bra', 'maternity bra', 'panty', 'panties', 'ladies underwear', 'womens underwear', "women's underwear", 'ladies innerwear', 'womens innerwear', 'camisole', 'cami', 'bridal lingerie', 'babydoll', 'nightwear set', 'ব্রা'],
  'sub-fashion-lifestyle-mens-innerwear': ["men's innerwear", 'mens innerwear', 'men innerwear', "men's underwear", 'mens underwear', 'men underwear', 'gents underwear', 'boxer', 'boxers', 'boxer shorts', 'brief', 'briefs', 'trunk', 'trunks', 'vest', 'gents vest', 'sando', 'sando genji', 'genji', 'undershirt', 'গেঞ্জি', 'জাঙ্গিয়া'],
  'sub-fashion-lifestyle-swimwear-beachwear': ['swimwear', 'swim wear', 'swimsuit', 'swimming costume', 'swimming suit', 'bikini', 'bikinis', 'burkini', 'modest swimwear', 'swim shorts', 'swimming trunks', 'beachwear', 'beach wear', 'cover up', 'sarong', 'swimming cap', 'swimming goggles'],
  'sub-fashion-lifestyle-shapewear': ['shapewear', 'shape wear', 'body shaper', 'shaper', 'tummy control', 'tummy tucker', 'waist trainer', 'waist cincher', 'corset', 'slimming belt'],
  'sub-jewelry-luxury-fashion-artificial-jewellery': ['anklet', 'anklets', 'nupur', 'payel', 'brooch', 'jewellery', 'jewelry', 'jewelries', 'jewellries', 'jewelleries', 'গয়না'],
  'sub-home-furniture-appliances-kitchen-dining': ['mug', 'mugs', 'cup', 'plate', 'crockery'],
  'sub-books-education-arts-religious-books-items': ['janamaz', 'jainamaz', 'prayer mat', 'tasbih', 'tasbeeh', 'quran stand', 'rehal', 'attar'],
};

// \p{M} keeps Bangla vowel signs inside the word (জুতা is one word, not জ + ত).
const tokenise = (v: string) =>
  v
    .toLowerCase()
    .replace(/&/g, ' ')
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((t) => t.length > 0);

/** Singular form for comparison (shoes → shoe, boxes → box); short words untouched. */
/** Singular forms for comparison (shoes -> shoe, spices -> spice, accessories -> accessory); short words untouched. */
const singulars = (t: string): string[] => {
  const out = [t];
  if (t.length > 4 && t.endsWith('ies')) out.push(`${t.slice(0, -3)}y`);
  if (t.length > 4 && t.endsWith('es')) out.push(t.slice(0, -2));
  if (t.length > 3 && t.endsWith('s')) out.push(t.slice(0, -1));
  return out;
};
const sameWord = (a: string, b: string) => singulars(a).some((x) => singulars(b).includes(x));

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
  const hit = (t: string) => [...hTokens].some((h) => h === t || sameWord(h, t) || (t.length >= 3 && h.startsWith(t)));
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
  const words = (c: SearchableCategory) => [
    c.name,
    ...(CATEGORY_SEARCH_WORDS[c.id] ?? []),
    ...(MORE_SEARCH_WORDS[c.id] ?? []),
    ...(ACCESSORY_SEARCH_WORDS[c.id] ?? []),
  ];
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
