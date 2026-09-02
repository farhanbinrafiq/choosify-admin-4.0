import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Users } from 'lucide-react';
import { CreatorCMSModel, initialCreatorSeeds, CREATOR_STUDIO_LIST_KEY, ensureCreatorStudioList } from './creatorSeeds';

export default function CreatorsStudioList() {
  const [creators, setCreators] = useState<CreatorCMSModel[]>([]);

  useEffect(() => {
    setCreators(ensureCreatorStudioList());
  }, []);

  const refresh = () => setCreators(ensureCreatorStudioList());

  return (
    <div className="space-y-6 pb-12 text-left">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#FF5B00] block mb-1">
            People · Profile CMS
          </span>
          <h1 className="text-xl font-black text-[#111827] tracking-tight">Creator Studio</h1>
          <p className="text-[12px] text-slate-500 mt-1 max-w-xl">
            Edit creator identity cards — cover, avatar, and profile sections. Guides stay in Guides Studio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const fresh: CreatorCMSModel = {
              ...initialCreatorSeeds[0],
              id: `creator-${Date.now()}`,
              name: 'New Creator',
              handle: '@new_creator',
              avatar: '',
              coverImage: '',
              verified: false,
            };
            const next = [...ensureCreatorStudioList(), fresh];
            localStorage.setItem(CREATOR_STUDIO_LIST_KEY, JSON.stringify(next));
            refresh();
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF5B00] hover:bg-[#FF5B00] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Creator Profile
        </button>
      </div>

      {creators.length === 0 ? (
        <div className="py-16 border border-dashed border-slate-200 rounded-3xl bg-white text-center text-slate-400 text-xs">
          <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
          No creator profiles yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {creators.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-slate-300 transition-colors"
            >
              <div className="relative h-28 bg-[#1A1A2E]">
                {c.coverImage ? (
                  <img src={c.coverImage} alt="" className="w-full h-full object-cover opacity-90" referrerPolicy="no-referrer" />
                ) : null}
                <div className="absolute left-4 -bottom-8 w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-[#1A1A2E] shadow-md">
                  {c.avatar ? (
                    <img src={c.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm font-black">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-10 px-4 pb-4 space-y-3">
                <div>
                  <h3 className="text-sm font-black text-[#111827] tracking-tight">{c.name}</h3>
                  <p className="text-[11px] text-[#2323FF] font-semibold">{c.title || 'Creator'}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{c.handle}</p>
                </div>
                <Link
                  to={`/admin/creator-studio/${c.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-[#FF5B00] hover:text-white text-[#FF5B00] border border-orange-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
