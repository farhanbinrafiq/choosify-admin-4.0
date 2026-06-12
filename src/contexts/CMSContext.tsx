import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  order: number;
}

export interface SocialLink {
  id: string;
  platform: 'Facebook' | 'Instagram' | 'YouTube' | 'TikTok' | 'WhatsApp';
  url: string;
  isVisible: boolean;
}

export interface CMSData {
  logos: {
    header: string;
    footer: string;
  };
  navigation: NavItem[];
  socialLinks: SocialLink[];
}

interface CMSContextType {
  cmsData: CMSData;
  loading: boolean;
  updateCMSData: (data: Partial<CMSData>) => Promise<void>;
}

const defaultCMSData: CMSData = {
  logos: {
    header: '',
    footer: ''
  },
  navigation: [
    { id: '1', label: 'Curated Products', path: '/products', order: 0 },
    { id: '2', label: 'Expert Guides', path: '/recommendations', order: 1 },
    { id: '3', label: 'Exclusive Deals', path: '/deals', order: 2 }
  ],
  socialLinks: [
    { id: '1', platform: 'Facebook', url: 'https://facebook.com', isVisible: true },
    { id: '2', platform: 'Instagram', url: 'https://instagram.com', isVisible: true },
    { id: '3', platform: 'YouTube', url: 'https://youtube.com', isVisible: true },
    { id: '4', platform: 'TikTok', url: 'https://tiktok.com', isVisible: false },
    { id: '5', platform: 'WhatsApp', url: 'https://wa.me', isVisible: false }
  ]
};

const CMSContext = createContext<CMSContextType | undefined>(undefined);

export const CMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cmsData, setCmsData] = useState<CMSData>(defaultCMSData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'cms'), (snapshot) => {
      if (snapshot.exists()) {
        setCmsData(snapshot.data() as CMSData);
      } else {
        // If it doesn't exist, we could initialize it or just use defaults
        // For now, use defaults but keep loading false
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/cms');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const updateCMSData = async (data: Partial<CMSData>) => {
    const path = 'settings/cms';
    try {
      const newData = { ...cmsData, ...data };
      await setDoc(doc(db, 'settings', 'cms'), newData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  return (
    <CMSContext.Provider value={{ cmsData, loading, updateCMSData }}>
      {children}
    </CMSContext.Provider>
  );
};

export const useCMS = () => {
  const context = useContext(CMSContext);
  if (!context) {
    throw new Error('useCMS must be used within a CMSProvider');
  }
  return context;
};
