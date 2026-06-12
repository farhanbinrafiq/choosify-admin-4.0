import React, { useState } from 'react';
import { 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Share2, 
  Plus, 
  Trash2, 
  GripVertical, 
  Save, 
  CheckCircle2,
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
  Video,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCMS, NavItem, SocialLink } from '../../contexts/CMSContext';

const platformIcons: Record<string, any> = {
  Facebook: Facebook,
  Instagram: Instagram,
  YouTube: Youtube,
  TikTok: Video,
  WhatsApp: MessageCircle
};

export default function CMSPage() {
  const { cmsData, updateCMSData } = useCMS();
  const [activeTab, setActiveTab] = useState<'logos' | 'navigation' | 'social'>('logos');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local state for edits
  const [localLogos, setLocalLogos] = useState(cmsData.logos);
  const [localNav, setLocalNav] = useState<NavItem[]>(cmsData.navigation);
  const [localSocial, setLocalSocial] = useState<SocialLink[]>(cmsData.socialLinks);

  const handleSave = async () => {
    setIsSaving(true);
    await updateCMSData({
      logos: localLogos,
      navigation: localNav,
      socialLinks: localSocial
    });
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const addNavItem = () => {
    const newItem: NavItem = {
      id: Math.random().toString(36).substr(2, 9),
      label: 'New Link',
      path: '/',
      order: localNav.length
    };
    setLocalNav([...localNav, newItem]);
  };

  const removeNavItem = (id: string) => {
    setLocalNav(localNav.filter(item => item.id !== id));
  };

  const updateNavItem = (id: string, updates: Partial<NavItem>) => {
    setLocalNav(localNav.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const updateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    setLocalSocial(localSocial.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-app-text-primary">Content Management System</h2>
          <p className="text-sm text-app-text-secondary">Manage platform logos, navigation, and social presence</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${
            saveSuccess 
              ? 'bg-green-500 text-white shadow-green-500/20' 
              : 'bg-app-accent text-white shadow-app-accent/20 hover:bg-app-accent-light'
          }`}
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? 'Changes Saved' : 'Save Changes'}
        </button>
      </div>

      <div className="flex bg-app-card border border-app-border rounded-2xl overflow-hidden shadow-sm">
        <div className="w-64 border-r border-app-border bg-slate-50/50 dark:bg-slate-900/10">
          <button 
            onClick={() => setActiveTab('logos')}
            className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-bold transition-all border-l-4 ${activeTab === 'logos' ? 'active-sidebar-item bg-app-accent/10 border-app-accent text-app-accent' : 'border-transparent text-app-text-secondary hover:bg-white/5'}`}
          >
            <ImageIcon className="w-4 h-4" /> Logo Management
          </button>
          <button 
            onClick={() => setActiveTab('navigation')}
            className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-bold transition-all border-l-4 ${activeTab === 'navigation' ? 'active-sidebar-item bg-app-accent/10 border-app-accent text-app-accent' : 'border-transparent text-app-text-secondary hover:bg-white/5'}`}
          >
            <LinkIcon className="w-4 h-4" /> Navigation Links
          </button>
          <button 
            onClick={() => setActiveTab('social')}
            className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-bold transition-all border-l-4 ${activeTab === 'social' ? 'active-sidebar-item bg-app-accent/10 border-app-accent text-app-accent' : 'border-transparent text-app-text-secondary hover:bg-white/5'}`}
          >
            <Share2 className="w-4 h-4" /> Social Media Links
          </button>
        </div>

        <div className="flex-1 p-8 min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === 'logos' && (
              <motion.div 
                key="logos"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-lg font-bold mb-4">Logo System</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Header Logo */}
                    <div className="bg-app-bg border border-app-border rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Header Logo URL</label>
                      </div>
                      <input 
                        type="text" 
                        value={localLogos.header}
                        onChange={(e) => setLocalLogos({...localLogos, header: e.target.value})}
                        placeholder="Paste image URL here..."
                        className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary focus:border-app-accent outline-none"
                      />
                      <div className="mt-4 p-4 bg-app-card border border-app-border rounded-xl flex items-center justify-center min-h-[80px]">
                        {localLogos.header ? (
                          <img src={localLogos.header} alt="Header Preview" className="max-h-12 object-contain" />
                        ) : (
                          <div className="text-[10px] text-app-text-secondary italic">No header logo set (Defaults to Choosify name)</div>
                        )}
                      </div>
                    </div>

                    {/* Footer Logo */}
                    <div className="bg-app-bg border border-app-border rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Footer Logo URL</label>
                      </div>
                      <input 
                        type="text" 
                        value={localLogos.footer}
                        onChange={(e) => setLocalLogos({...localLogos, footer: e.target.value})}
                        placeholder="Paste image URL here..."
                        className="w-full bg-app-card border border-app-border rounded-xl px-4 py-2.5 text-xs text-app-text-primary focus:border-app-accent outline-none"
                      />
                      <div className="mt-4 p-4 bg-app-sidebar border border-app-border rounded-xl flex items-center justify-center min-h-[80px]">
                        {localLogos.footer ? (
                          <img src={localLogos.footer} alt="Footer Preview" className="max-h-12 object-contain" />
                        ) : (
                          <div className="text-[10px] text-app-text-secondary italic">No footer logo set</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'navigation' && (
              <motion.div 
                key="nav"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Quick Navigation</h3>
                  <button 
                    onClick={addNavItem}
                    className="flex items-center gap-2 px-4 py-2 bg-app-accent/10 text-app-accent text-xs font-bold rounded-lg hover:bg-app-accent hover:text-white transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Link
                  </button>
                </div>

                <div className="space-y-3">
                  {localNav.sort((a, b) => a.order - b.order).map((item, i) => (
                    <div key={item.id} className="flex gap-4 p-4 bg-app-bg border border-app-border rounded-2xl group hover:border-app-accent/30 transition-all">
                      <div className="flex items-center text-app-text-secondary cursor-move">
                        <GripVertical className="w-4 h-4 opacity-30 group-hover:opacity-100" />
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1">Label</label>
                          <input 
                            type="text" 
                            value={item.label}
                            onChange={(e) => updateNavItem(item.id, { label: e.target.value })}
                            className="w-full bg-app-card border border-app-border rounded-xl px-3 py-2 text-xs text-app-text-primary outline-none focus:border-app-accent"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1">Path</label>
                          <input 
                            type="text" 
                            value={item.path}
                            onChange={(e) => updateNavItem(item.id, { path: e.target.value })}
                            className="w-full bg-app-card border border-app-border rounded-xl px-3 py-2 text-xs text-app-text-primary outline-none focus:border-app-accent"
                          />
                        </div>
                      </div>
                      <div className="flex items-end pb-1">
                        <button 
                          onClick={() => removeNavItem(item.id)}
                          className="p-2 text-app-text-secondary hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {localNav.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed border-app-border rounded-3xl text-app-text-secondary text-xs italic">
                      No navigation links defined. Add your first link above.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'social' && (
              <motion.div 
                key="social"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Social Presence</h3>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {localSocial.map((social) => {
                    const Icon = platformIcons[social.platform] || Globe;
                    return (
                      <div key={social.id} className="flex gap-4 p-4 bg-app-bg border border-app-border rounded-2xl transition-all">
                        <div className="w-12 h-12 rounded-xl bg-app-card border border-app-border flex items-center justify-center text-app-accent shadow-sm shrink-0">
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-sm font-bold">{social.platform}</span>
                             <button 
                                onClick={() => updateSocialLink(social.id, { isVisible: !social.isVisible })}
                                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${social.isVisible ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}
                             >
                               {social.isVisible ? 'Visible' : 'Hidden'}
                             </button>
                          </div>
                          <input 
                            type="text" 
                            disabled={!social.isVisible}
                            value={social.url}
                            onChange={(e) => updateSocialLink(social.id, { url: e.target.value })}
                            placeholder={`${social.platform} profile URL...`}
                            className={`w-full bg-app-card border border-app-border rounded-xl px-4 py-2 text-xs text-app-text-primary outline-none focus:border-app-accent transition-all ${!social.isVisible ? 'opacity-50 grayscale' : ''}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
