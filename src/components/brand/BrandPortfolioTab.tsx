import React from 'react';
import { Award, Globe, Heart, Star, Users } from 'lucide-react';

interface BrandPortfolioTabProps {
  brandStory: string;
  setBrandStory: (val: string) => void;
  facebookLink: string;
  setFacebookLink: (val: string) => void;
  instaLink: string;
  setInstaLink: (val: string) => void;
  webLink: string;
  setWebLink: (val: string) => void;
  saveStudioInfo: () => void;
  brandProfile: any;
}

export const BrandPortfolioTab: React.FC<BrandPortfolioTabProps> = ({
  brandStory,
  setBrandStory,
  facebookLink,
  setFacebookLink,
  instaLink,
  setInstaLink,
  webLink,
  setWebLink,
  saveStudioInfo,
  brandProfile
}) => {
  return (
    <div className="space-y-6 text-left" id="brand_portfolio_panel">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">🏬 Brand Portfolio</h2>
        <p className="text-slate-500 text-xs mt-1">Configure physical branding catalogs, visual storefront stories, and social marketing integration links.</p>
      </div>

      {/* Brand Studio details form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest block">My Brand Studio Customizer</h3>
        
        <div className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-slate-600 font-bold block">Brand Story Overview</label>
            <textarea
              rows={4}
              value={brandStory}
              onChange={(e) => setBrandStory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:bg-white resize-none text-slate-700 leading-relaxed font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-slate-600 font-bold">Facebook Profile / Fanpage</label>
              <input
                type="text"
                value={facebookLink}
                onChange={(e) => setFacebookLink(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:bg-white font-medium text-slate-700"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-bold">Instagram Handle URL</label>
              <input
                type="text"
                value={instaLink}
                onChange={(e) => setInstaLink(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:bg-white font-medium text-slate-700"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-bold">Official Core Website Link</label>
              <input
                type="text"
                value={webLink}
                onChange={(e) => setWebLink(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:bg-white font-mono text-slate-700"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={saveStudioInfo}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Save Brand Details
          </button>
        </div>
      </div>

      {/* Associated catalog brands */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest block">Associated Sub-Brands & Labels</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-5 flex gap-4 hover:border-slate-350 transition-all text-left">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center font-black text-lg text-[#F4631E] uppercase shadow-sm">
              {brandProfile.initials || brandProfile.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="space-y-1">
              <span className="text-sm font-bold text-slate-800 block">{brandProfile.name}</span>
              <p className="text-[10px] text-slate-500 font-medium">Category: {brandProfile.category} &bull; Origin: {brandProfile.country}</p>
              
              <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 pt-1.5 flex-wrap">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> 1,420 Followers</span>
                <span className="flex items-center gap-0.5 text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-500" /> 4.9 Score</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 border border-slate-250 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center">
            <Award className="w-8 h-8 text-slate-400 stroke-[1.5] mb-1.5" />
            <span className="text-xs font-bold text-slate-700">Add Associated Trade Label</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Submit registration claim to list subsidiary trademarks.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
