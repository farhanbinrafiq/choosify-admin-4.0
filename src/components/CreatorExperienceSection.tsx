import React, { useState } from "react";
import { 
  Play, Pencil, Plus, Clock, Eye, Heart, MapPin, Sparkles, Film, 
  Tv, Compass, Youtube, Instagram, Facebook, Monitor, ThumbsUp
} from "lucide-react";

export interface CreatorContentItem {
  id: string;
  platform: "YOUTUBE" | "INSTAGRAM" | "TIKTOK" | "FACEBOOK" | string;
  videoUrl: string;
  thumbnail: string;
  title: string;
  description: string;
  views: number | string;
  likes: number | string;
  duration: string;
  creatorHandle: string;
  creatorAvatar: string;
  location: string;
  isFeatured?: boolean;
}

interface CreatorExperienceSectionProps {
  contextType: "brand" | "product";
  contextName: string; // e.g., "Samsung S25 Ultra" or "Apex"
  creatorContent: CreatorContentItem[];
  onEditClick?: () => void;
  onAddReviewClick?: () => void;
}

export function CreatorExperienceSection({
  contextType,
  contextName,
  creatorContent = [],
  onEditClick,
  onAddReviewClick
}: CreatorExperienceSectionProps) {
  const [activeFilter, setActiveFilter] = useState<"ALL" | "YOUTUBE" | "INSTAGRAM" | "TIKTOK" | "FACEBOOK">("ALL");
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  // Filter creator content based on selection
  const filteredContent = creatorContent.filter(item => {
    if (activeFilter === "ALL") return true;
    return item.platform.toUpperCase() === activeFilter;
  });

  // Find the featured item (prioritize `isFeatured`, or fallback to first item in filtered list)
  const featuredItem = filteredContent.find(item => item.isFeatured) || filteredContent[0];
  const gridItems = filteredContent.filter(item => item.id !== (featuredItem?.id || ""));

  const getPlatformIcon = (platform: string) => {
    switch (platform.toUpperCase()) {
      case "YOUTUBE":
        return <Youtube className="w-4 h-4 text-red-600 fill-red-600/10" />;
      case "INSTAGRAM":
        return <Instagram className="w-4 h-4 text-pink-600" />;
      case "TIKTOK":
        return <Film className="w-4 h-4 text-slate-700" />;
      case "FACEBOOK":
        return <Facebook className="w-4 h-4 text-blue-600 fill-blue-600/10" />;
      default:
        return <Tv className="w-4 h-4 text-[#EF3C23]" />;
    }
  };

  const formatCount = (num: number | string) => {
    if (typeof num === "string") return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <div id="creator-experience-card" className="bg-white border border-slate-200 rounded-3xl p-6 text-[#1a1a2e] relative shadow-sm overflow-hidden hover:border-slate-350 transition-all duration-300 text-left">
      
      {/* Header Row */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <span className="text-[10px] text-[#EF3C23] font-mono font-bold uppercase tracking-widest block mb-1">
            BRAND CAMPAIGNS & INFLUENCERS
          </span>
          <h2 className="text-base font-black uppercase text-[#1a1a2e] tracking-tight flex items-center gap-2">
            PR & CREATOR REVIEWS WITH <span className="text-[#EF3C23]">{contextName}</span>
          </h2>
        </div>
        
        {onEditClick && (
          <button 
            type="button"
            onClick={onEditClick}
            id="edit-creators-btn"
            className="w-8 h-8 rounded-full bg-orange-50 hover:bg-[#EF3C23] hover:text-white border border-[#EF3C23]/20 text-[#EF3C23] flex items-center justify-center transition-all duration-250 hover:scale-105 active:scale-95 shadow-sm"
            title="Edit Creator Content"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Platform Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-2xl mb-6 relative z-10">
        {(["ALL", "YOUTUBE", "INSTAGRAM", "TIKTOK", "FACEBOOK"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveFilter(tab)}
            id={`filter-tab-${tab.toLowerCase()}`}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer${
              activeFilter === tab 
                ? "bg-[#EF3C23] text-white shadow-md shadow-[#EF3C23]/15" 
                : "text-slate-550 hover:text-[#1a1a2e] hover:bg-slate-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Featured Review Block */}
      {featuredItem ? (
        <div className="relative z-10 mb-6 bg-[#f8f9fb] border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-all duration-300">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 p-4">
            {/* Visual Thumbnail Frame */}
            <div className="md:col-span-2 relative aspect-video md:aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
              <img 
                src={featuredItem.thumbnail || "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80"} 
                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 object-center filter brightness-95" 
                alt={featuredItem.title} 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-app-card/20 group-hover:bg-app-card/30 transition-all flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setSelectedVideoUrl(featuredItem.videoUrl)}
                  id={`play-featured-${featuredItem.id}`}
                  className="w-12 h-12 rounded-full bg-[#EF3C23] text-app-text-primary flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform active:scale-95 cursor-pointer border-none"
                >
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </button>
              </div>
              <span className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest text-[#EF3C23] uppercase flex items-center gap-1 border border-slate-200">
                {getPlatformIcon(featuredItem.platform)}
                <span>{featuredItem.platform}</span>
              </span>
              <span className="absolute bottom-2.5 right-2.5 bg-app-bg/10 text-[8px] font-mono font-bold text-app-text-primary px-2 py-0.5 rounded-md">
                {featuredItem.duration || "10:30"}
              </span>
            </div>

            {/* Content Specifications */}
            <div className="md:col-span-3 flex flex-col justify-between text-left">
              <div>
                <span className="text-[8.5px] text-[#EF3C23] font-mono font-black uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-[#EF3C23]" />
                  FEATURED WORKSPACE REVIEW
                </span>
                <h3 className="text-sm font-black uppercase text-[#1a1a2e] tracking-tight line-clamp-2 mb-2 leading-snug">
                  {featuredItem.title}
                </h3>
                <p className="text-[11px] text-slate-500 font-light leading-relaxed line-clamp-3 mb-4">
                  {featuredItem.description || "In-depth review evaluation breakdown exploring specifications, performance benchmarks and value characteristics."}
                </p>
              </div>
              
              {/* Creator Card strip info */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <img 
                    src={featuredItem.creatorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"} 
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 p-0.5 shrink-0" 
                    alt={featuredItem.creatorHandle}
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <span className="block text-[11px] font-bold text-[#1a1a2e]">@{featuredItem.creatorHandle}</span>
                    <span className="text-[9px] text-[#EF3C23] font-bold font-mono tracking-wider flex items-center gap-1">
                      <Compass className="w-2.5 h-2.5 text-[#EF3C23]" />
                      COLLABORATOR PARTNER
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 font-mono text-[10px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-app-text-secondary" />
                    <span>{formatCount(featuredItem.views)} Views</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-app-text-secondary" />
                    <span>{formatCount(featuredItem.likes || 150)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50">
          No Creator Experiences connected under the {activeFilter} platform group.
        </div>
      )}

      {/* Sub-grid Carousel / Grid items (3 Column Layout - matched to description and image) */}
      {gridItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
          {gridItems.slice(0, 3).map(item => (
            <div 
              key={item.id} 
              className="bg-[#f8f9fb] border border-slate-200 rounded-2xl overflow-hidden p-3 hover:border-slate-300 transition-all duration-200 text-left flex flex-col justify-between aspect-[4/5] group/card"
            >
              {/* Image Frame */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200 mb-2.5">
                <img 
                  src={item.thumbnail || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400"} 
                  className="w-full h-full object-cover object-center group-hover/card:scale-105 transition-transform duration-350"
                  alt="" 
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setSelectedVideoUrl(item.videoUrl)}
                  className="absolute inset-0 bg-app-card/20 group-hover/card:bg-app-card/35 transition-all flex items-center justify-center cursor-pointer border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-[#EF3C23] text-app-text-primary flex items-center justify-center shadow-md transform group-hover/card:scale-110 transition-transform">
                    <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                  </div>
                </button>
                <span className="absolute top-1.5 left-1.5 bg-white/95 backdrop-blur-md px-1.5 py-0.5 rounded text-[7px] text-[#EF3C23] flex items-center gap-1 font-extrabold uppercase border border-slate-200">
                  {getPlatformIcon(item.platform)}
                  <span>{item.platform}</span>
                </span>
                <span className="absolute bottom-1.5 right-1.5 bg-app-bg/10 px-1.5 py-0.5 rounded text-[8px] font-mono text-app-text-primary leading-none">
                  {item.duration}
                </span>
              </div>

              {/* Title & Creator */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-[11px] font-extrabold text-[#1a1a2e] uppercase tracking-tight line-clamp-2 leading-snug group-hover/card:text-[#EF3C23] transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">
                    {item.description || "Creator analysis breakdown."}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-3.5">
                  <div className="flex items-center gap-1.5">
                    <img 
                      src={item.creatorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50"} 
                      className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0" 
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[70px]">
                      @{item.creatorHandle}
                    </span>
                  </div>

                  <span className="text-[9px] text-slate-500 font-mono flex items-center gap-0.5">
                    <Eye className="w-3 h-3" />
                    {formatCount(item.views)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Creator Review Button Row */}
      {onAddReviewClick && (
        <div className="mt-6 flex justify-center relative z-10">
          <button
            type="button"
            onClick={onAddReviewClick}
            id="add-creator-review-btn"
            className="w-full py-3 bg-[#EF3C23] hover:bg-[#eb2b10] text-app-text-primary hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer border-none"
          >
            <Plus className="w-4 h-4 text-app-text-primary" />
            <span>+ ADD / MANAGE CREATOR REVIEW</span>
          </button>
        </div>
      )}

      {/* Video Overlay View Panel */}
      {selectedVideoUrl && (
        <div className="fixed inset-0 z-[400] bg-app-card/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedVideoUrl(null)} />
          <div className="bg-white border border-slate-300 rounded-3xl overflow-hidden w-full max-w-2xl relative z-10 shadow-2xl p-5 space-y-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#EF3C23] font-mono">
                ACTIVE CREATOR VIDEO STREAM
              </span>
              <button 
                type="button" 
                onClick={() => setSelectedVideoUrl(null)} 
                className="text-app-text-secondary hover:text-slate-700 text-xs font-black font-mono px-2 py-1 hover:bg-slate-100 rounded-lg transition-all"
              >
                ✕ CLOSE
              </button>
            </div>
            
            <div className="p-4 bg-[#f8f9fb] border border-slate-200 rounded-2xl text-center space-y-3.5 text-xs text-[#1a1a2e]">
              <Film className="w-10 h-10 text-[#EF3C23] mx-auto animate-pulse" />
              <p className="font-extrabold uppercase text-[#1a1a2e]">Interactive Review Playback</p>
              <p className="max-w-md mx-auto text-slate-500 text-[11px]">
                In accordance with sandbox environment policies, the video destination stream is referenced below:
              </p>
              
              <div className="font-mono text-[#EF3C23] font-bold break-all bg-white p-3 rounded-xl text-[10px] select-all border border-slate-200">
                🔗 Destination Stream URL: {selectedVideoUrl}
              </div>
              
              <div className="flex gap-2 justify-center pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(selectedVideoUrl || "");
                  }} 
                  className="px-4 py-2 bg-[#EF3C23] hover:bg-red-650 text-app-text-primary rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                >
                  Copy Link
                </button>
                <a 
                  href={selectedVideoUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-[#1a1a2e] rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors inline-block text-center"
                >
                  Open Stream
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
