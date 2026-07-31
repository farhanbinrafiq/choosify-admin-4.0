export type CreatorPlatform = 'YouTube' | 'Instagram' | 'Facebook' | 'TikTok';

export interface CreatorCMSModel {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  coverImage: string;
  title: string;
  location: string;
  bio: string;
  bestForTags: string[];
  platforms: CreatorPlatform[];
  email: string;
  phone: string;
  responseTime: string;
  preferredContact: string;
  brandPartners: { name: string; color?: string }[];
  collabTypes: string[];
  socialLinks: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    tiktok?: string;
  };
  featuredVideoUrl?: string;
  verified?: boolean;
}

export const initialCreatorSeeds: CreatorCMSModel[] = [
  {
    id: 'creator-farhan',
    name: 'Farhan Bin Rafiq',
    handle: '@farhan_tech',
    avatar: 'https://res.cloudinary.com/djdyqr8yd/image/upload/v1781880900/FBR_n3eycm.png',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1600&q=80',
    title: 'Creator & Product Researcher',
    location: 'Dhaka, Bangladesh',
    bio: 'Senior Tech Analyst & Digital Product Researcher with 10+ years of experience analyzing electronic imports, consumer durables, and PC components in the Bangladesh market.',
    bestForTags: ['Smartphones', 'Laptops', 'Gadget Guides', 'Dhaka Tech Hubs'],
    platforms: ['YouTube', 'Facebook'],
    email: 'farhan.outreach@choosify.bd',
    phone: '+880 1712-345678',
    responseTime: '24 - 48 hours',
    preferredContact: 'Email',
    brandPartners: [
      { name: 'SAMSUNG', color: '#1428A0' },
      { name: 'mi Xiaomi', color: '#FF6900' },
      { name: 'ASUS', color: '#1A1A2E' },
    ],
    collabTypes: ['Product Reviews', 'Buying Guides', 'Tech Analysis', 'Comparisons'],
    socialLinks: {
      youtube: 'https://www.youtube.com/@farhan_tech',
      facebook: 'https://www.facebook.com/farhan.tech',
    },
    featuredVideoUrl: '',
    verified: true,
  },
  {
    id: 'creator-nusrat',
    name: 'Nusrat Jahan',
    handle: '@nusrat_styles',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
    coverImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80',
    title: 'Lifestyle Creator & Style Editor',
    location: 'Dhaka, Bangladesh',
    bio: 'Lifestyle and fashion curator covering deshi apparel, sustainable wear, and everyday shopping guides for modern Bangladeshi audiences.',
    bestForTags: ['Fashion', 'Lifestyle', 'Sustainable Wear'],
    platforms: ['Instagram', 'TikTok', 'YouTube'],
    email: 'nusrat.collab@choosify.bd',
    phone: '+880 1811-223344',
    responseTime: '24 - 48 hours',
    preferredContact: 'Email',
    brandPartners: [
      { name: 'aarong', color: '#1A1A2E' },
      { name: 'Yellow', color: '#EAB308' },
    ],
    collabTypes: ['Brand Stories', 'Product Reviews', 'Live Sessions'],
    socialLinks: {
      instagram: 'https://www.instagram.com/nusrat_styles',
      tiktok: 'https://www.tiktok.com/@nusrat_styles',
    },
    featuredVideoUrl: '',
    verified: true,
  },
];

export const CREATOR_STUDIO_LIST_KEY = 'choosify_creator_studio_list';

export function ensureCreatorStudioList(): CreatorCMSModel[] {
  try {
    const raw = localStorage.getItem(CREATOR_STUDIO_LIST_KEY);
    if (raw) return JSON.parse(raw) as CreatorCMSModel[];
  } catch {
    /* fall through */
  }
  localStorage.setItem(CREATOR_STUDIO_LIST_KEY, JSON.stringify(initialCreatorSeeds));
  return [...initialCreatorSeeds];
}