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
        return <Youtube className="w-4 h-4 text-red-500 fill-red-500/10" />;
      case "INSTAGRAM":
        return <Instagram className="w-4 h-4 text-pink-500" />;
      case "TIKTOK":
        return <Film className="w-4 h-4 text-cyan-400" />;
      case "FACEBOOK":
        return <Facebook className="w-4 h-4 text-blue-500 fill-blue-500/10" />;
      default:
        return <Tv className="w-4 h-4 text-app-accent" />;
    }
  };

  const formatCount = (num: number | string) => {
    if (typeof num === "string") return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <div id="creator-experience-card" className="bg-[#0B0F19] border border-slate-800 rounded-3xl p-6 text-white relative shadow-2xl overflow-hidden hover:border-slate-700/60 transition-all duration-300">
      {/* Background radial accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-orange-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Row */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <span className="text-[10px] text-orange-500 font-mono font-bold uppercase tracking-widest block mb-1">
            Brand Clip Highlights
          </span>
          <h2 className="text-base font-black uppercase text-white tracking-wider flex items-center gap-2">
            CREATOR EXPERIENCES WITH <span className="text-orange-500">{contextName}</span>
          </h2>
        </div>
        
        {onEditClick && (
          <button 
            type="button"
            onClick={onEditClick}
            id="edit-creators-btn"
            className="w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500 hover:text-white border border-orange-500/20 text-orange-500 flex items-center justify-center transition-all duration-250 hover:scale-105 active:scale-95 shadow-md"
            title="Edit Creator Content"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Platform Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl mb-6 relative z-10">
        {(["ALL", "YOUTUBE", "INSTAGRAM", "TIKTOK", "FACEBOOK"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveFilter(tab)}
            id={`filter-tab-${tab.toLowerCase()}`}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeFilter === tab 
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/15" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Featured Review Block (Horizontal layout matched to inspiration image) */}
      {featuredItem ? (
        <div className="relative z-10 mb-6 bg-slate-900/40 border border-slate-850 rounded-2xl overflow-hidden hover:border-slate-800 transition-all duration-300">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 p-4">
            {/* Visual Thumbnail Frame */}
            <div className="md:col-span-2 relative aspect-video md:aspect-[4/3] rounded-xl overflow-hidden bg-black/40 border border-white/5 group">
              <img 
                src={featuredItem.thumbnail || "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80"} 
                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 object-center filter brightness-95" 
                alt={featuredItem.title} 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/45 transition-all flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setSelectedVideoUrl(featuredItem.videoUrl)}
                  id={`play-featured-${featuredItem.id}`}
                  className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform active:scale-95 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </button>
              </div>
              <span className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest text-white/90 uppercase flex items-center gap-1 border border-white/5">
                {getPlatformIcon(featuredItem.platform)}
                <span>{featuredItem.platform}</span>
              </span>
              <span className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[8px] font-mono font-bold text-white/95">
                {featuredItem.duration || "10:30"}
              </span>
            </div>

            {/* Content Specifications */}
            <div className="md:col-span-3 flex flex-col justify-between text-left">
              <div>
                <span className="text-[8.5px] text-[#50DC17] font-mono font-black uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-[#50DC17]" />
                  FEATURED WORKSPACE REVIEW
                </span>
                <h3 className="text-sm font-black uppercase text-white tracking-tight line-clamp-2 mb-2 leading-snug">
                  {featuredItem.title}
                </h3>
                <p className="text-[11px] text-slate-400 font-light leading-relaxed line-clamp-3 mb-4">
                  {featuredItem.description || "In-depth review evaluation breakdown exploring specifications, performance benchmarks and value characteristics."}
                </p>
              </div>
              
              {/* Creator Card strip info */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <img 
                    src={featuredItem.creatorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"} 
                    className="w-7 h-7 rounded-full object-cover border border-slate-700 p-0.5 shrink-0" 
                    alt={featuredItem.creatorHandle}
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <span className="block text-[11px] font-bold text-white">{featuredItem.creatorHandle}</span>
                    <span className="text-[9px] text-[#EB4501] font-bold font-mono tracking-wider flex items-center gap-1">
                      <Compass className="w-2.5 h-2.5 text-[#EB4501]" />
                      TECH REVIEWER
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 font-mono text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formatCount(featuredItem.views)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-slate-500" />
                    <span>{formatCount(featuredItem.likes || 150)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
          No Creator Experiences connected under the {activeFilter} platform group.
        </div>
      )}

      {/* Sub-grid Carousel / Grid items (3 Column Layout - matched to description and image) */}
      {gridItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
          {gridItems.slice(0, 3).map(item => (
            <div 
              key={item.id} 
              className="bg-slate-900/30 border border-slate-850 rounded-xl overflow-hidden p-3 hover:border-slate-750 transition-all duration-200 text-left flex flex-col justify-between aspect-[4/5] group/card"
            >
              {/* Image Frame */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black/40 border border-white/5 mb-2.5">
                <img 
                  src={item.thumbnail || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400"} 
                  className="w-full h-full object-cover object-center group-hover/card:scale-105 transition-transform duration-350"
                  alt="" 
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setSelectedVideoUrl(item.videoUrl)}
                  className="absolute inset-0 bg-black/30 group-hover/card:bg-black/50 transition-all flex items-center justify-center cursor-pointer border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md transform group-hover/card:scale-110 transition-transform">
                    <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                  </div>
                </button>
                <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[7px] text-white/90 flex items-center gap-1 font-extrabold uppercase">
                  {getPlatformIcon(item.platform)}
                  <span>{item.platform}</span>
                </span>
                <span className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-mono text-white/95 leading-none">
                  {item.duration}
                </span>
              </div>

              {/* Title & Creator */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-[11.5px] font-extrabold text-white uppercase tracking-tight line-clamp-2 leading-snug group-hover/card:text-orange-400 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                    {item.description || "Creator analysis breakdown."}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 mt-3.5">
                  <div className="flex items-center gap-1.5">
                    <img 
                      src={item.creatorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50"} 
                      className="w-5 h-5 rounded-full object-cover border border-slate-800 shrink-0" 
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] font-semibold text-slate-300 truncate max-w-[70px]">
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
            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-slate-800 hover:border-slate-700/80 rounded-2xl text-[10px] text-slate-200 font-extrabold uppercase tracking-widest flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-orange-500" />
            <span>Add Creator Review</span>
          </button>
        </div>
      )}

      {/* Simulated Iframe / Video Overlay */}
      {selectedVideoUrl && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedVideoUrl(null)} />
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden w-full max-w-2xl relative z-10 shadow-2xl p-5 space-y-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-850">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 font-mono">
                Active Sourcing Clip Embed
              </span>
              <button 
                type="button" 
                onClick={() => setSelectedVideoUrl(null)} 
                className="text-slate-400 hover:text-white text-xs font-black font-mono px-2 py-1 hover:bg-white/5 rounded-lg transition-all"
              >
                X CLOSE
              </button>
            </div>
            
            <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl text-center space-y-3.5 text-xs text-slate-300">
              <Film className="w-10 h-10 text-orange-500 mx-auto animate-pulse" />
              <p className="font-semibold uppercase text-white">Interactive Sourcing Playback Sandbox</p>
              <p className="max-w-md mx-auto text-slate-400 text-[11px]">
                In accordance with preview sandbox policies, live external iframe playback is proxied here.
              </p>
              
              <div className="font-mono text-orange-400 font-bold break-all bg-black/40 p-3 rounded-xl text-[10px] select-all border border-slate-850">
                🔗 Destination Stream URL: {selectedVideoUrl}
              </div>
              
              <div className="flex gap-2 justify-center pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedVideoUrl);
                    alert("Review destination URL copied successfully!");
                  }} 
                  className="px-4 py-2 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-orange-600 transition-colors"
                >
                  Copy Review Link
                </button>
                <a 
                  href={selectedVideoUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="px-4 py-2 bg-[#202030] hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors inline-block text-center"
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
