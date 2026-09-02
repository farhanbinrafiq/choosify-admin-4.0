import React, { useState } from 'react';
import { Award, ShieldCheck, Tag, Users, Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { OverviewListItem } from './OverviewListIcon';

export type OverviewBlockLike = {
  id: string;
  title: string;
  content?: string;
  bullets: string[];
  listStyle?: 'none' | 'bullet' | 'numbered';
  enabled: boolean;
  sortOrder?: number;
};

const QUADRANT_ICONS: Record<string, React.ReactNode> = {
  'quality & materials': <Tag size={14} />,
  'features & benefits': <Award size={14} />,
  'audience & use cases': <Users size={14} />,
  'customer support & assurance': <ShieldCheck size={14} />,
};

function quadrantIcon(title: string) {
  const key = title.trim().toLowerCase();
  return QUADRANT_ICONS[key] || <Award size={14} />;
}

/** Display: four-quadrant bento matching storefront Product Overview. */
export function OverviewBentoGrid({
  blocks,
  emptyLabel = 'No overview highlight blocks enabled.',
}: {
  blocks: OverviewBlockLike[];
  emptyLabel?: string;
}) {
  const enabled = blocks.filter((b) => b.enabled);
  if (!enabled.length) {
    return (
      <div className="py-12 border border-dashed border-[#E5E7EB] rounded-2xl bg-[#FAFAFA]/50 text-center text-slate-400 text-xs italic">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {enabled.map((blk) => (
        <div key={blk.id} className="bg-[#F4F7F9] rounded-[10px] px-5 py-[18px] flex flex-col gap-3 text-left">
          <div className="flex items-center gap-2 text-[12px] font-extrabold text-[#1A1A2E]">
            <span className="text-[#FF5B00]">{quadrantIcon(blk.title)}</span>
            {blk.title}
          </div>
          {blk.content ? (
            <p className="text-[11.5px] text-[#4B5563] leading-relaxed whitespace-pre-wrap">{blk.content}</p>
          ) : null}
          {blk.listStyle !== 'none' && blk.bullets?.length > 0 ? (
            <div className="space-y-2 text-[11.5px] text-[#4B5563] leading-relaxed">
              {blk.bullets.map((item, i) =>
                blk.listStyle === 'numbered' ? (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[#FF5B00] font-black shrink-0">{i + 1}.</span>
                    <span>{item}</span>
                  </div>
                ) : (
                  <OverviewListItem key={i} text={item} />
                ),
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Edit: per-quadrant bullet list with checkmark live preview. */
export function OverviewQuadrantEditor({
  block,
  onChange,
  onRemove,
}: {
  block: OverviewBlockLike;
  onChange: (next: OverviewBlockLike) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-[#F4F7F9] rounded-[10px] p-4 space-y-3 text-left border border-[#E8EDF2]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <span className="text-[#FF5B00] shrink-0">{quadrantIcon(block.title)}</span>
          <input
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            className="font-extrabold text-[#1A1A2E] text-xs bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 outline-none flex-grow min-w-0"
            placeholder="Quadrant title"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onChange({ ...block, enabled: !block.enabled })}
            className={`px-2 py-0.5 rounded text-[8px] font-black uppercase cursor-pointer ${
              block.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {block.enabled ? 'ON' : 'OFF'}
          </button>
          <button type="button" onClick={onRemove} className="text-red-500 hover:text-red-700 cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {block.enabled && (
        <>
          <div className="space-y-2">
            {(block.bullets || []).map((bullet, bIdx) => (
              <div key={bIdx} className="space-y-1.5 bg-white rounded-xl border border-[#E5E7EB] p-2.5">
                <div className="flex gap-1.5 items-center">
                  <input
                    value={bullet}
                    onChange={(e) => {
                      const bullets = [...block.bullets];
                      bullets[bIdx] = e.target.value;
                      onChange({ ...block, bullets });
                    }}
                    className="flex-grow bg-transparent border-0 outline-none text-xs font-medium text-[#1A1A2E]"
                    placeholder="Bullet text"
                  />
                  <button
                    type="button"
                    disabled={bIdx === 0}
                    onClick={() => {
                      if (bIdx === 0) return;
                      const bullets = [...block.bullets];
                      [bullets[bIdx - 1], bullets[bIdx]] = [bullets[bIdx], bullets[bIdx - 1]];
                      onChange({ ...block, bullets });
                    }}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={bIdx >= block.bullets.length - 1}
                    onClick={() => {
                      if (bIdx >= block.bullets.length - 1) return;
                      const bullets = [...block.bullets];
                      [bullets[bIdx + 1], bullets[bIdx]] = [bullets[bIdx], bullets[bIdx + 1]];
                      onChange({ ...block, bullets });
                    }}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...block,
                        bullets: block.bullets.filter((_, i) => i !== bIdx),
                      })
                    }
                    className="text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {bullet.trim() ? (
                  <OverviewListItem text={bullet} className="text-[11px] text-[#4B5563]" />
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange({ ...block, bullets: [...block.bullets, 'New checklist item'] })}
              className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#FF5B00] bg-transparent border-0 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add bullet
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function BestForTagsChipField({
  tags,
  onChange,
  presets = ['premium lifestyle', 'quality driven', 'modern apparel', 'best in segment', 'sustainable wear'],
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  presets?: string[];
}) {
  const [draft, setDraft] = useState('');

  const addTag = (raw: string) => {
    const cleaned = raw.trim().replace(/^#/, '').toLowerCase();
    if (!cleaned || tags.includes(cleaned)) return;
    onChange([...tags, cleaned]);
    setDraft('');
  };

  const commitDraft = () => {
    const parts = draft.split(/[,]+/).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    let next = [...tags];
    for (const p of parts) {
      const cleaned = p.replace(/^#/, '').toLowerCase();
      if (cleaned && !next.includes(cleaned)) next.push(cleaned);
    }
    onChange(next);
    setDraft('');
  };

  return (
    <div className="space-y-3 text-left">
      <div className="text-[11px] font-extrabold text-[#8A00C4]"># BEST FOR TAGS</div>
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="choosify-best-for-tag text-[11px] font-bold px-3.5 py-1.5 rounded-full border border-transparent hover:border-[#8A00C4]/30 cursor-pointer inline-flex items-center gap-1.5"
            title="Click to remove"
          >
            #{tag}
            <span className="text-[#8A00C4]/60 text-[10px]">×</span>
          </button>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commitDraft();
          }
        }}
        onBlur={() => {
          if (draft.trim()) commitDraft();
        }}
        placeholder="Type a tag and press Enter or comma…"
        className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#8A00C4] font-medium"
      />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => addTag(preset)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[9.5px] text-slate-600 uppercase font-semibold cursor-pointer"
          >
            + {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
