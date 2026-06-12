import { Package, Star, Tag, Lightbulb } from 'lucide-react';

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  specs: Record<string, string>;
}

export const mockProducts: Product[] = [
  {
    id: 'p1',
    name: 'iPhone 15 Pro',
    brand: 'Apple',
    price: 125000,
    rating: 4.8,
    reviews: 1240,
    image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?w=400&q=80',
    specs: { 'Display': '6.1" OLED', 'Chip': 'A17 Pro', 'Camera': '48MP Main' }
  },
  {
    id: 'p2',
    name: 'Galaxy S24 Ultra',
    brand: 'Samsung',
    price: 135000,
    rating: 4.7,
    reviews: 890,
    image: 'https://images.unsplash.com/photo-1707201366969-952467d5813f?w=400&q=80',
    specs: { 'Display': '6.8" AMOLED', 'Chip': 'Snapdragon 8 Gen 3', 'Camera': '200MP Main' }
  }
];

// Unified Compare System
export const compareProducts = (p1Id: string, p2Id: string) => {
  const product1 = mockProducts.find(p => p.id === p1Id);
  const product2 = mockProducts.find(p => p.id === p2Id);
  return { product1, product2 };
};

// Deals Lifecycle System
export interface Deal {
  id: string;
  productId: string;
  discount: number;
  expiry: string;
  status: 'active' | 'expired';
}

export const mockDeals: Deal[] = [
  { id: 'd1', productId: 'p1', discount: 10, expiry: '2026-06-01', status: 'active' },
  { id: 'd2', productId: 'p2', discount: 15, expiry: '2026-05-15', status: 'expired' },
];

// Recommendation Feed System
export const mockRecommendations = [
  {
    id: 'r1',
    title: 'Top 5 Gadgets for University Students',
    creator: 'Samiul Islam',
    products: ['p1', 'p2'],
    status: 'published'
  },
  {
    id: 'r2',
    title: 'Best Eco-friendly Smartphones 2026',
    creator: 'Sumaiya Khan',
    products: ['p1'],
    status: 'draft'
  }
];
