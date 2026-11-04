/**
 * Website Studio — Social Links (Phase 3). Mirrors the footer "Connect" row. Each link must be a
 * full https:// address on that network's own domain (server-checked).
 */
import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Field, MirrorBlock, MirrorLayout, STOREFRONT, Toggle, iconBtn, inputCls, smallBtn } from './StudioKit';
import { SOCIAL_PLATFORMS, moveIn, type SocialContent } from './siteModel';

const short = (id: string) => SOCIAL_PLATFORMS.find((p) => p.id === id)?.label ?? id;

export function SocialEditor({ value, onChange, disabled }: { value: SocialContent; onChange: (v: SocialContent) => void; disabled: boolean }) {
  const [sel, setSel] = useState<string | null>(null);
  const v = value;
  const idx = v.links.findIndex((l) => l.platform === sel);
  const cur = idx >= 0 ? v.links[idx] : null;
  const free = SOCIAL_PLATFORMS.filter((p) => !v.links.some((l) => l.platform === p.id));
  const setLink = (patch: Partial<SocialContent['links'][number]>) => onChange({ ...v, links: v.links.map((l, j) => (j === idx ? { ...l, ...patch } : l)) });

  const mirror = (
    <div className="m-3 rounded-xl p-5" style={{ background: STOREFRONT.footer }} onClick={() => setSel(null)}>
      <div className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,.4)' }}>
        Connect
      </div>
      <div className="flex flex-wrap gap-2">
        {v.links.map((l) => (
          <MirrorBlock key={l.platform} selected={sel === l.platform} onSelect={() => setSel(l.platform)} label={short(l.platform)} testId={`ws-so-${l.platform}`} muted={!l.visible} className="rounded-full">
            <span className="inline-flex h-9 items-center justify-center rounded-full bg-white px-3 text-[11px] font-extrabold text-[#1A1A2E]">{short(l.platform)}</span>
          </MirrorBlock>
        ))}
        {free.length > 0 && (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed px-3 text-[11px] font-bold disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,.35)', color: 'rgba(255,255,255,.8)' }}
            disabled={disabled}
            data-testid="ws-so-add"
            onClick={(e) => {
              e.stopPropagation();
              const p = free[0];
              onChange({ ...v, links: [...v.links, { platform: p.id, url: '', visible: true }] });
              setSel(p.id);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>
      <div className="mt-3 text-[11px]" style={{ color: 'rgba(255,255,255,.5)' }}>
        Shown in the footer of every page. Hidden links stay saved but do not show.
      </div>
    </div>
  );

  const inspector = cur ? (
    <div className="space-y-3" data-testid="ws-so-form">
      <Field label="Network">
        <select
          className={inputCls}
          value={cur.platform}
          disabled={disabled}
          data-testid="ws-so-platform"
          onChange={(e) => {
            setLink({ platform: e.target.value });
            setSel(e.target.value);
          }}
        >
          {SOCIAL_PLATFORMS.filter((p) => p.id === cur.platform || !v.links.some((l) => l.platform === p.id)).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Page address" hint={`e.g. ${SOCIAL_PLATFORMS.find((p) => p.id === cur.platform)?.example}`}>
        <input className={inputCls} value={cur.url} disabled={disabled} data-testid="ws-so-url" placeholder="https://…" onChange={(e) => setLink({ url: e.target.value })} />
      </Field>
      <Toggle checked={cur.visible} disabled={disabled} label="Show in the footer" testId="ws-so-visible" onChange={(on) => setLink({ visible: on })} />
      <div className="flex gap-2 border-t border-[#F1F3F5] pt-3">
        <button type="button" className={iconBtn} disabled={disabled || idx === 0} aria-label="Move left" onClick={() => onChange({ ...v, links: moveIn(v.links, idx, -1) })}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={iconBtn} disabled={disabled || idx === v.links.length - 1} aria-label="Move right" onClick={() => onChange({ ...v, links: moveIn(v.links, idx, 1) })}>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={smallBtn} disabled={disabled} data-testid="ws-so-remove" onClick={() => { onChange({ ...v, links: v.links.filter((_, j) => j !== idx) }); setSel(null); }}>
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div data-testid="ws-social-editor">
      <MirrorLayout mirror={mirror} inspector={inspector} inspectorTitle={cur ? `Social link — ${short(cur.platform)}` : ''} />
    </div>
  );
}

export function SocialOutline({ value }: { value: SocialContent }) {
  return <div className="text-[11.5px]">{value.links.map((l) => `${short(l.platform)}${l.visible ? '' : ' (hidden)'}`).join(' · ') || 'No social links'}</div>;
}
