import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  Plus,
  RotateCw,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { useAuth } from '../../contexts/AuthContext';
import type {
  CatalogBrand,
  CatalogGuide,
  CatalogProduct,
  GuideEntityRef,
  GuideExternalRef,
  GuideLiveOffer,
  GuideSocialLink,
} from '../../types/catalog';
import { uploadProductImages, uploadProductVideoFile } from '../../services/mediaUpload';
import { toYoutubeEmbed } from '../../components/guide-studio/GuideStudioPresentation';
import {
  GuideStudioPresentation,
  type GuidePublisherView,
  type GuideStudioBridge,
} from '../../components/guide-studio/GuideStudioPresentation';
import {
  GUIDE_FORMATS,
  GUIDE_FORMAT_LABEL,
  GUIDE_MEDIA_TYPES,
  GUIDE_SECTION_TITLE,
  OPTIONAL_SECTIONS,
  createBlankGuideStudioModel,
  guideStudioModelToPatch,
  mapCatalogGuideToStudioModel,
  type GuideStudioModel,
  type GuideStudioSection,
  type SectionLayoutEntry,
} from './guideStudioModel';

const refKey = (r?: GuideEntityRef): string => (r ? `${r.entityType}:${r.entityId}` : '');

const label = 'block text-[10px] font-extrabold uppercase tracking-wider text-[#6B7280] mb-1';
const input =
  'w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px] text-[#1A1A2E] outline-none focus:border-[#EF3C23]';
const textarea = `${input} min-h-[120px] leading-relaxed`;
const ghostBtn =
  'inline-flex items-center gap-1 rounded-md border border-[#E8EDF2] bg-white px-2 py-1 text-[10px] font-bold text-[#374151] hover:bg-[#F8FAFC]';
const hint = 'mt-1 text-[10.5px] leading-snug text-[#9CA3AF]';

/* ── Repeatable string list editor ──────────────────────────────────────── */
function ListEditor({
  items,
  onChange,
  placeholder,
  addLabel = 'Add',
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const set = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#9AA0AC] w-5 shrink-0">{i + 1}.</span>
          <input
            className={input}
            value={v}
            placeholder={placeholder}
            onChange={(e) => set(i, e.target.value)}
          />
          <button type="button" className={ghostBtn} onClick={() => move(i, -1)} disabled={i === 0}>
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            className={ghostBtn}
            onClick={() => move(i, 1)}
            disabled={i === items.length - 1}
          >
            <ArrowDown className="h-3 w-3" />
          </button>
          <button
            type="button"
            className={`${ghostBtn} text-[#DC2626]`}
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
        onClick={() => onChange([...items, ''])}
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}

/* ── Up-to-4 "why it's good for…" keyword chips ───────────────────────── */
function HighlightTagsInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
}) {
  const [v, setV] = useState('');
  const add = () => {
    const t = v.replace(/^#+/, '').trim().slice(0, 24);
    if (t && tags.length < 4 && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t]);
    }
    setV('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1">
        {tags.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-[#F3E8FF] text-[#7C3AED] text-[10px] font-bold px-2 py-0.5"
          >
            #{t}
            <button type="button" onClick={() => onChange(tags.filter((_, idx) => idx !== i))} className="text-[#7C3AED]">
              ×
            </button>
          </span>
        ))}
      </div>
      {tags.length < 4 ? (
        <input
          className={`${input} !h-7 !text-[11px]`}
          value={v}
          placeholder="Add a keyword (e.g. Best Camera) — up to 4"
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      ) : (
        <div className="text-[10px] text-[#9AA0AC]">Max 4 keywords.</div>
      )}
    </div>
  );
}

/* ── Hero photos — multiple photos, reorder, set-primary (Product Studio UX) ── */
function PhotoGalleryEditor({
  photos,
  onChange,
  onToast,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  onToast: (m: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const primary = photos[0] || '';
  const extras = photos.slice(1);

  const doUpload = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    setBusy(true);
    try {
      const urls = await uploadProductImages(imgs);
      onChange([...photos, ...urls]);
      onToast(`${urls.length} photo${urls.length === 1 ? '' : 's'} uploaded.`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const removeAt = (i: number) => onChange(photos.filter((_, idx) => idx !== i));
  const setPrimary = (u: string) => onChange([u, ...photos.filter((p) => p !== u)]);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= photos.length) return;
    const n = [...photos];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && void doUpload([...e.target.files])}
      />
      {primary ? (
        <div className="relative rounded-lg overflow-hidden border border-[#E8EDF2] bg-[#F4F7F9] aspect-[16/9] max-h-[240px]">
          <img src={primary} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <span className="absolute top-1.5 left-1.5 bg-[#EF3C23] text-white text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase">
            Primary
          </span>
          <button
            type="button"
            className="absolute top-1.5 right-1.5 rounded bg-white/90 px-1.5 py-1 text-[#DC2626]"
            onClick={() => removeAt(0)}
            title="Remove"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !busy && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.dataTransfer.files?.length && void doUpload([...e.dataTransfer.files]);
          }}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#E8EDF2] bg-[#F9FAFB] py-8 text-[#9CA3AF] cursor-pointer"
        >
          {busy ? <RotateCw className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          <span className="text-[11px] font-extrabold uppercase tracking-wide">
            {busy ? 'Uploading…' : 'Drop photos or click to upload'}
          </span>
          <span className="text-[10px]">A guide may have photos, a video, both, or neither.</span>
        </div>
      )}

      {extras.length ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {extras.map((u, i) => {
            const abs = i + 1;
            return (
              <div key={u} className="relative rounded-md overflow-hidden border border-[#E8EDF2] bg-[#F4F7F9] aspect-[4/3]">
                <img src={u} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-black/45 py-0.5">
                  <button type="button" className="text-white p-0.5" onClick={() => setPrimary(u)} title="Make primary">
                    <Star className="h-3 w-3" />
                  </button>
                  <button type="button" className="text-white p-0.5" onClick={() => move(abs, -1)} title="Move left">
                    <ArrowUp className="h-3 w-3 -rotate-90" />
                  </button>
                  <button type="button" className="text-white p-0.5" onClick={() => move(abs, 1)} title="Move right">
                    <ArrowDown className="h-3 w-3 -rotate-90" />
                  </button>
                  <button type="button" className="text-[#FCA5A5] p-0.5" onClick={() => removeAt(abs)} title="Remove">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className={ghostBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
          <Plus className="h-3 w-3" /> {photos.length ? 'Add more photos' : 'Upload photos'}
        </button>
        <input
          className={`${input} flex-1 min-w-[180px] !h-8`}
          value={url}
          placeholder="…or paste an image URL"
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="button"
          className={ghostBtn}
          onClick={() => {
            const u = url.trim();
            if (u) {
              onChange([...photos, u]);
              setUrl('');
            }
          }}
        >
          Add URL
        </button>
      </div>
    </div>
  );
}

/* ── One optional video — upload MP4/WebM OR paste YouTube / direct URL ────── */
function GuideVideoField({
  value,
  onChange,
  onToast,
}: {
  value: string;
  onChange: (u: string) => void;
  onToast: (m: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const isYt = /youtube\.com|youtu\.be/.test(value);
  const isFile = /\.(mp4|webm)(\?|$)/i.test(value);

  const doUpload = async (files: File[]) => {
    const f = files.find((x) => x.type.startsWith('video/'));
    if (!f) {
      onToast('Choose an MP4 or WebM file.');
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadProductVideoFile(f));
      onToast('Video uploaded.');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Video upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={(e) => e.target.files?.length && void doUpload([...e.target.files])}
      />
      {value ? (
        <>
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            {isYt ? (
              <iframe title="Guide video" src={toYoutubeEmbed(value)} className="w-full h-full border-0" allowFullScreen />
            ) : isFile ? (
              <video src={value} controls preload="metadata" className="w-full h-full object-contain bg-black" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-white/60 break-all px-3 text-center">
                {value}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className={ghostBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Uploading…' : 'Replace video'}
            </button>
            <button type="button" className={`${ghostBtn} text-[#DC2626]`} onClick={() => onChange('')}>
              <Trash2 className="h-3 w-3" /> Remove video
            </button>
          </div>
        </>
      ) : (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={() => !busy && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.dataTransfer.files?.length && void doUpload([...e.dataTransfer.files]);
            }}
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#E8EDF2] bg-[#F9FAFB] py-7 text-[#9CA3AF] cursor-pointer"
          >
            {busy ? <RotateCw className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="text-[11px] font-extrabold uppercase tracking-wide">
              {busy ? 'Uploading…' : 'Upload video — MP4 / WebM'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className={`${input} flex-1 min-w-[180px] !h-8`}
              value={link}
              placeholder="…or paste a YouTube / .mp4 / .webm URL"
              onChange={(e) => setLink(e.target.value)}
            />
            <button
              type="button"
              className={ghostBtn}
              onClick={() => {
                const u = link.trim();
                if (/^https:\/\//i.test(u)) {
                  onChange(u);
                  setLink('');
                } else {
                  onToast('Enter an https:// video URL.');
                }
              }}
            >
              Apply link
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Canonical product picker (search + pick + reorder + highlight chips) ── */
function ProductPicker({
  catalog,
  picked,
  onChange,
  topPickIds,
  onTopPickChange,
  highlights,
  onHighlightsChange,
}: {
  catalog: CatalogProduct[];
  picked: string[];
  onChange: (ids: string[]) => void;
  topPickIds?: string[];
  onTopPickChange?: (ids: string[]) => void;
  highlights?: Record<string, string[]>;
  onHighlightsChange?: (h: Record<string, string[]>) => void;
}) {
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const query = q.trim().toLowerCase();
  const results = query
    ? catalog
        .filter((p) => !picked.includes(p.id))
        .filter(
          (p) =>
            (p.title || '').toLowerCase().includes(query) ||
            String((p as { sku?: string }).sku || '').toLowerCase().includes(query),
        )
        .slice(0, 8)
    : [];
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= picked.length) return;
    const next = [...picked];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {picked.length ? (
        <ol className="space-y-1.5">
          {picked.map((pid, i) => {
            const p = byId.get(pid);
            return (
              <li key={pid} className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-[#EF3C23] w-5 shrink-0">#{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#1A1A2E]">
                  {p ? p.title : <span className="italic text-[#9AA0AC]">Removed product ({pid})</span>}
                </span>
                {onTopPickChange ? (
                  <label className="flex items-center gap-1 text-[10px] font-bold text-[#4B5563] shrink-0">
                    <input
                      type="checkbox"
                      checked={(topPickIds || []).includes(pid)}
                      onChange={(e) =>
                        onTopPickChange(
                          e.target.checked
                            ? [...(topPickIds || []), pid]
                            : (topPickIds || []).filter((x) => x !== pid),
                        )
                      }
                    />
                    Top pick
                  </label>
                ) : null}
                <button type="button" className={ghostBtn} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button type="button" className={ghostBtn} onClick={() => move(i, 1)} disabled={i === picked.length - 1}>
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className={`${ghostBtn} text-[#DC2626]`}
                  onClick={() => onChange(picked.filter((x) => x !== pid))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                </div>
                {onHighlightsChange ? (
                  <div className="mt-1.5 pl-7">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-[#9AA0AC] mb-0.5">
                      Why it’s good for… (max 4)
                    </div>
                    <HighlightTagsInput
                      tags={highlights?.[pid] ?? []}
                      onChange={(t) => onHighlightsChange({ ...(highlights ?? {}), [pid]: t })}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-[11px] italic text-[#9AA0AC]">No products selected.</p>
      )}
      <div className="relative">
        <input
          className={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={catalog.length ? 'Search the Choosify catalog…' : 'No catalog products available'}
          disabled={!catalog.length}
        />
        {results.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange([...picked, p.id]);
                  setQ('');
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                <span className="min-w-0 truncate font-semibold text-[#1A1A2E]">{p.title}</span>
                <span className="shrink-0 text-[11px] font-bold text-[#EF3C23]">Add</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Canonical brand picker (+ highlight chips) ────────────────────────── */
function BrandPicker({
  catalog,
  picked,
  onChange,
  highlights,
  onHighlightsChange,
}: {
  catalog: CatalogBrand[];
  picked: string[];
  onChange: (ids: string[]) => void;
  highlights?: Record<string, string[]>;
  onHighlightsChange?: (h: Record<string, string[]>) => void;
}) {
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(catalog.map((b) => [b.id, b])), [catalog]);
  const query = q.trim().toLowerCase();
  const results = query
    ? catalog.filter((b) => !picked.includes(b.id) && (b.name || '').toLowerCase().includes(query)).slice(0, 8)
    : [];
  return (
    <div className="space-y-2">
      {picked.length ? (
        <ol className="space-y-1.5">
          {picked.map((bid) => {
            const b = byId.get(bid);
            return (
              <li key={bid} className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#1A1A2E]">
                  {b ? b.name : <span className="italic text-[#9AA0AC]">Removed brand ({bid})</span>}
                </span>
                <button
                  type="button"
                  className={`${ghostBtn} text-[#DC2626]`}
                  onClick={() => onChange(picked.filter((x) => x !== bid))}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
                </div>
                {onHighlightsChange ? (
                  <div className="mt-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-[#9AA0AC] mb-0.5">
                      Why it’s good for… (max 4)
                    </div>
                    <HighlightTagsInput
                      tags={highlights?.[bid] ?? []}
                      onChange={(t) => onHighlightsChange({ ...(highlights ?? {}), [bid]: t })}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-[11px] italic text-[#9AA0AC]">No brands mentioned.</p>
      )}
      <div className="relative">
        <input
          className={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={catalog.length ? 'Search brands…' : 'No brands available'}
          disabled={!catalog.length}
        />
        {results.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
            {results.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  onChange([...picked, b.id]);
                  setQ('');
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                <span className="min-w-0 truncate font-semibold text-[#1A1A2E]">{b.name}</span>
                <span className="shrink-0 text-[11px] font-bold text-[#EF3C23]">Mention</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── One uploaded photo for an off-platform reference (upload, not a link) ── */
function ExternalRefPhotoField({
  value,
  onChange,
  onToast,
}: {
  value: string;
  onChange: (u: string) => void;
  onToast: (m: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const doUpload = async (files: File[]) => {
    const f = files.find((x) => x.type.startsWith('image/'));
    if (!f) {
      onToast('Choose an image file.');
      return;
    }
    setBusy(true);
    try {
      const [url] = await uploadProductImages([f]);
      if (url) onChange(url);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div>
      <div className={label}>Photo</div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.length && void doUpload([...e.target.files])}
      />
      {value ? (
        <div className="relative w-full max-w-[180px] rounded-lg overflow-hidden border border-[#E8EDF2] bg-[#F4F7F9] aspect-[4/3]">
          <img src={value} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <button
            type="button"
            className="absolute top-1 right-1 rounded bg-white/90 px-1.5 py-1 text-[#DC2626]"
            onClick={() => onChange('')}
            title="Remove photo"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !busy && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.dataTransfer.files?.length && void doUpload([...e.dataTransfer.files]);
          }}
          className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[#E8EDF2] bg-[#F9FAFB] py-5 text-[#9CA3AF] cursor-pointer"
        >
          {busy ? <RotateCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span className="text-[10px] font-extrabold uppercase tracking-wide">
            {busy ? 'Uploading…' : 'Upload photo'}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Off-platform product / brand references (editorial only) ───────────── */
function ExternalRefEditor({
  refs,
  onChange,
  onToast,
}: {
  refs: GuideExternalRef[];
  onChange: (r: GuideExternalRef[]) => void;
  onToast: (m: string) => void;
}) {
  const upd = (i: number, patch: Partial<GuideExternalRef>) =>
    onChange(refs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-3">
      {refs.map((r, i) => (
        <div key={r.id} className="rounded-lg border border-[#E8EDF2] bg-white p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <select
              className={`${input} !h-8 max-w-[170px]`}
              value={r.kind}
              onChange={(e) => upd(i, { kind: e.target.value as GuideExternalRef['kind'] })}
            >
              <option value="product">External Product</option>
              <option value="brand">External Brand</option>
            </select>
            <button
              type="button"
              className={`${ghostBtn} text-[#DC2626]`}
              onClick={() => onChange(refs.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
          <input
            className={input}
            value={r.title}
            placeholder="Title — e.g. Anker Soundcore Space Q45"
            onChange={(e) => upd(i, { title: e.target.value })}
          />
          <input
            className={input}
            value={r.externalUrl}
            placeholder="https:// link to the product / brand page"
            onChange={(e) => upd(i, { externalUrl: e.target.value })}
          />
          <ExternalRefPhotoField
            value={r.imageUrl || ''}
            onChange={(imageUrl) => upd(i, { imageUrl })}
            onToast={onToast}
          />
          <input
            className={input}
            value={r.brandName || ''}
            placeholder="Brand name (optional)"
            onChange={(e) => upd(i, { brandName: e.target.value })}
          />
          <input
            className={input}
            value={r.commentary || ''}
            placeholder="Why it's mentioned (optional)"
            onChange={(e) => upd(i, { commentary: e.target.value })}
          />
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-[#9AA0AC] mb-0.5">
              Why it’s good for… (max 4)
            </div>
            <HighlightTagsInput
              tags={r.highlightTags ?? []}
              onChange={(highlightTags) => upd(i, { highlightTags })}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
        onClick={() =>
          onChange([...refs, { id: `ext-${Date.now()}`, kind: 'product', title: '', externalUrl: '' }])
        }
      >
        <Plus className="h-3.5 w-3.5" /> Add off-platform item
      </button>
      <div className={hint}>
        Off-platform items never enter the Choosify catalogue, cart or checkout. They render as an external
        card with a "Visit" link and an outside-Choosify disclaimer.
      </div>
    </div>
  );
}

/* ── Typed entity-ref list (Overall winner / awards / picks) ──────────── */
function RefLabelListEditor({
  rows,
  options,
  onChange,
  labelPlaceholder,
  addLabel,
  hideAdd = false,
}: {
  rows: Array<{ id: string; label: string; ref: GuideEntityRef }>;
  options: Array<{ key: string; label: string; ref: GuideEntityRef }>;
  onChange: (rows: Array<{ id: string; label: string; ref: GuideEntityRef }>) => void;
  labelPlaceholder: string;
  addLabel: string;
  /** Hide the built-in "add" button — the caller supplies its own <AddGuideRef>. */
  hideAdd?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={row.id} className="flex flex-wrap items-center gap-1.5">
          <input
            className={`${input} flex-1 min-w-[120px]`}
            value={row.label}
            placeholder={labelPlaceholder}
            onChange={(e) => onChange(rows.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
          />
          <select
            className={`${input} flex-1 min-w-[160px]`}
            value={refKey(row.ref)}
            onChange={(e) => {
              const found = options.find((o) => o.key === e.target.value);
              if (found) onChange(rows.map((x, idx) => (idx === i ? { ...x, ref: found.ref } : x)));
            }}
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${ghostBtn} text-[#DC2626]`}
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      {!hideAdd ? (
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23] disabled:opacity-40"
            disabled={!options.length}
            onClick={() =>
              onChange([...rows, { id: `ref-${Date.now()}`, label: '', ref: options[0].ref }])
            }
          >
            <Plus className="h-3.5 w-3.5" /> {addLabel}
          </button>
          {!options.length ? (
            <div className={hint}>Add products / brands / off-platform items to the guide first.</div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Add a product / brand / off-platform item as a typed EntityRef. Searches the
 * real Choosify catalog and also supports "Add External" — satisfying the rule
 * that every guide entity picker offers *Search Choosify* + *Add External*.
 * Picking an entity not yet in the guide tags it (so it is genuinely discussed).
 */
type PendingGuideRef =
  | { t: 'product'; id: string }
  | { t: 'brand'; id: string }
  | { t: 'external'; kind: 'product' | 'brand'; title: string; url: string };

function AddGuideRef({
  products,
  brands,
  onAdd,
  addLabel,
}: {
  products: CatalogProduct[];
  brands: CatalogBrand[];
  onAdd: (p: PendingGuideRef) => void;
  addLabel: string;
}) {
  const [q, setQ] = useState('');
  const [ext, setExt] = useState(false);
  const [extKind, setExtKind] = useState<'product' | 'brand'>('product');
  const [extTitle, setExtTitle] = useState('');
  const [extUrl, setExtUrl] = useState('');
  const query = q.trim().toLowerCase();
  const pRes = query
    ? products.filter((p) => (p.title || '').toLowerCase().includes(query)).slice(0, 6)
    : [];
  const bRes = query
    ? brands.filter((b) => (b.name || '').toLowerCase().includes(query)).slice(0, 4)
    : [];
  const canExt = extTitle.trim().length > 0 && /^https:\/\//i.test(extUrl.trim());

  return (
    <div className="rounded-lg border border-dashed border-[#E8EDF2] bg-[#F9FAFB] p-2.5 space-y-2">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9AA0AC]">{addLabel}</div>
      <div className="relative">
        <input
          className={`${input} !h-8`}
          value={q}
          placeholder="Search Choosify products & brands…"
          onChange={(e) => setQ(e.target.value)}
        />
        {pRes.length || bRes.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
            {pRes.map((p) => (
              <button
                key={`p-${p.id}`}
                type="button"
                onClick={() => {
                  onAdd({ t: 'product', id: p.id });
                  setQ('');
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                <span className="min-w-0 truncate font-semibold text-[#1A1A2E]">{p.title}</span>
                <span className="shrink-0 text-[10px] font-bold text-[#9AA0AC]">Product</span>
              </button>
            ))}
            {bRes.map((b) => (
              <button
                key={`b-${b.id}`}
                type="button"
                onClick={() => {
                  onAdd({ t: 'brand', id: b.id });
                  setQ('');
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                <span className="min-w-0 truncate font-semibold text-[#1A1A2E]">{b.name}</span>
                <span className="shrink-0 text-[10px] font-bold text-[#9AA0AC]">Brand</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {ext ? (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <select
              className={`${input} !h-8 max-w-[150px]`}
              value={extKind}
              onChange={(e) => setExtKind(e.target.value as 'product' | 'brand')}
            >
              <option value="product">External Product</option>
              <option value="brand">External Brand</option>
            </select>
            <input
              className={`${input} !h-8 flex-1`}
              value={extTitle}
              placeholder="Title"
              onChange={(e) => setExtTitle(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            <input
              className={`${input} !h-8 flex-1`}
              value={extUrl}
              placeholder="https:// link"
              onChange={(e) => setExtUrl(e.target.value)}
            />
            <button
              type="button"
              className={`${ghostBtn} ${canExt ? 'text-[#EF3C23]' : 'opacity-40'}`}
              disabled={!canExt}
              onClick={() => {
                onAdd({ t: 'external', kind: extKind, title: extTitle.trim(), url: extUrl.trim() });
                setExtTitle('');
                setExtUrl('');
                setExt(false);
              }}
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#374151]"
          onClick={() => setExt(true)}
        >
          <Plus className="h-3 w-3" /> Add external product / brand
        </button>
      )}
    </div>
  );
}

/* ── Time-boxed guide offers (brand-authored only) ─────────────────────── */
function LiveOfferEditor({
  offers,
  productIds,
  productsById,
  onChange,
  allowed,
}: {
  offers: GuideLiveOffer[];
  productIds: string[];
  productsById: Map<string, CatalogProduct>;
  onChange: (o: GuideLiveOffer[]) => void;
  allowed: boolean;
}) {
  if (!allowed) {
    return (
      <p className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#B45309] m-0">
        Live offers are available only on <b>brand-authored</b> guides, and only for products the publishing
        brand owns. A creator-authored guide can tag products but cannot set guide pricing.
      </p>
    );
  }
  const upd = (i: number, patch: Partial<GuideLiveOffer>) =>
    onChange(offers.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const mode = (o: GuideLiveOffer): 'promoPrice' | 'percent' | 'amount' =>
    typeof o.promoPrice === 'number' ? 'promoPrice' : o.discountType === 'amount' ? 'amount' : 'percent';
  return (
    <div className="space-y-3">
      {offers.map((o, i) => (
        <div key={o.id} className="rounded-lg border border-[#E8EDF2] bg-white p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <select
              className={`${input} !h-8 flex-1`}
              value={o.productId}
              onChange={(e) => upd(i, { productId: e.target.value })}
            >
              <option value="">— Tagged product —</option>
              {productIds.map((pid) => (
                <option key={pid} value={pid}>
                  {productsById.get(pid)?.title || pid}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${ghostBtn} text-[#DC2626]`}
              onClick={() => onChange(offers.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <select
              className={`${input} !h-8 max-w-[150px]`}
              value={mode(o)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'promoPrice') upd(i, { promoPrice: 0, discountType: undefined, discountValue: undefined });
                else upd(i, { promoPrice: undefined, discountType: v as 'percent' | 'amount', discountValue: 0 });
              }}
            >
              <option value="promoPrice">Promo price ৳</option>
              <option value="percent">% off</option>
              <option value="amount">৳ off</option>
            </select>
            <input
              type="number"
              className={`${input} !h-8 max-w-[120px]`}
              value={mode(o) === 'promoPrice' ? o.promoPrice ?? 0 : o.discountValue ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value) || 0;
                if (mode(o) === 'promoPrice') upd(i, { promoPrice: n });
                else upd(i, { discountValue: n });
              }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className={label}>Starts at (ISO)</div>
              <input
                className={input}
                value={o.startsAt || ''}
                placeholder="2026-09-01T09:00:00Z"
                onChange={(e) => upd(i, { startsAt: e.target.value })}
              />
            </div>
            <div>
              <div className={label}>Ends at (ISO)</div>
              <input
                className={input}
                value={o.endsAt || ''}
                placeholder="2026-09-07T09:00:00Z"
                onChange={(e) => upd(i, { endsAt: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#4B5563]">
            <input
              type="checkbox"
              checked={o.enabled !== false}
              onChange={(e) => upd(i, { enabled: e.target.checked })}
            />
            Offer enabled
          </label>
        </div>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
        onClick={() =>
          onChange([
            ...offers,
            { id: `offer-${Date.now()}`, productId: productIds[0] || '', discountType: 'percent', discountValue: 10, startsAt: '', endsAt: '', enabled: true },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" /> Add offer
      </button>
      <div className={hint}>
        A guide offer never changes the base product price. Checkout re-validates the window with server time —
        an expired offer returns an explicit price-change response, never a silent charge.
      </div>
    </div>
  );
}

/* ── Continue-watching / social links (guide-scoped) ──────────────────── */
function SocialLinkEditor({
  links,
  onChange,
}: {
  links: GuideSocialLink[];
  onChange: (l: GuideSocialLink[]) => void;
}) {
  const upd = (i: number, patch: Partial<GuideSocialLink>) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const platforms: GuideSocialLink['platform'][] = [
    'youtube',
    'facebook',
    'tiktok',
    'instagram',
    'twitch',
    'vimeo',
    'other',
  ];
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={l.id} className="flex flex-wrap items-center gap-1.5">
          <select
            className={`${input} !h-8 max-w-[130px]`}
            value={l.platform}
            onChange={(e) => upd(i, { platform: e.target.value as GuideSocialLink['platform'] })}
          >
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            className={`${input} flex-1 min-w-[160px]`}
            value={l.url}
            placeholder="https://…"
            onChange={(e) => upd(i, { url: e.target.value })}
          />
          <input
            className={`${input} max-w-[150px]`}
            value={l.label || ''}
            placeholder="Label (optional)"
            onChange={(e) => upd(i, { label: e.target.value })}
          />
          <button
            type="button"
            className={`${ghostBtn} text-[#DC2626]`}
            onClick={() => onChange(links.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
        onClick={() =>
          onChange([...links, { id: `soc-${Date.now()}`, platform: 'youtube', url: '', enabled: true }])
        }
      >
        <Plus className="h-3.5 w-3.5" /> Add link
      </button>
      <div className={hint}>Guide-scoped — separate from the creator / brand profile socials.</div>
    </div>
  );
}

export default function GuideEditStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isNew = !id || id === 'new';
  const activeId = isNew ? 'new' : (id as string);

  const [model, setModel] = useState<GuideStudioModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [publisher, setPublisher] = useState<GuidePublisherView>({ kind: 'unknown', name: 'Resolving…' });
  const [ownedBrands, setOwnedBrands] = useState<CatalogBrand[]>([]);
  const [newPublisherBrandId, setNewPublisherBrandId] = useState<string>('');

  const [editingId, setEditingId] = useState<GuideStudioSection | null>(null);
  const [draft, setDraft] = useState<GuideStudioModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Studios open storefront-parity VIEW first; the author flips to Edit to reveal
  // section controls / Add Section / edit pills. A brand-new guide starts in Edit.
  const [editMode, setEditMode] = useState(isNew);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  // ── load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const [prods, brs, cats] = await Promise.all([
        catalogApi.listProducts().catch(() => []),
        catalogApi.listBrands().catch(() => []),
        catalogApi.listCategories().catch(() => []),
      ]);
      if (cancelled) return;
      setProducts(prods);
      setBrands(brs);
      setCategoryNames(
        Array.from(
          new Set(
            (cats as Array<{ name?: string; enabled?: boolean }>)
              .filter((c) => c && c.enabled !== false && c.name)
              .map((c) => String(c.name).trim()),
          ),
        ).sort((a, b) => a.localeCompare(b)),
      );

      if (isNew) {
        setModel(createBlankGuideStudioModel());
        // Publisher options for the create flow.
        if (profile?.role === 'seller') {
          const mine = brs.filter((b) => (b as { sellerId?: string }).sellerId === profile.id);
          setOwnedBrands(mine);
        }
        setLoading(false);
        return;
      }

      const guide = await catalogApi.getGuide(activeId).catch(() => null);
      if (cancelled) return;
      if (!guide) {
        setLoadError(`Guide "${activeId}" was not found or you don’t have access.`);
        setModel(createBlankGuideStudioModel());
        setLoading(false);
        return;
      }
      const m = mapCatalogGuideToStudioModel(guide);
      setModel(m);
      resolvePublisher(m, prods /* unused */, brs);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, isNew]);

  const resolvePublisher = useCallback(
    async (m: GuideStudioModel, _p: CatalogProduct[], brs: CatalogBrand[]) => {
      if (m.publisherType === 'brand' && m.publisherBrandId) {
        const b = brs.find((x) => x.id === m.publisherBrandId);
        setPublisher({
          kind: 'brand',
          name: b?.name || m.publisherBrandId,
          logo: b?.logo,
          verified: !!b?.verifiedStatus,
        });
        return;
      }
      if (m.creatorId) {
        try {
          const creators = await catalogApi.listCreators();
          const c = creators.find((x) => x.id === m.creatorId);
          if (c) {
            const followers = Object.values((c.followers || {}) as Record<string, string>)
              .map((v) => Number(String(v).replace(/[^0-9.]/g, '')))
              .filter((n) => Number.isFinite(n) && n > 0)
              .reduce((a, b) => a + b, 0);
            setPublisher({
              kind: 'creator',
              name: c.name,
              avatar: c.avatar,
              verified: !!c.verifiedStatus,
              score: typeof c.score === 'number' && c.score > 0 ? c.score : null,
              followers: followers > 0 ? followers : null,
            });
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setPublisher({ kind: 'creator', name: 'Choosify Editorial' });
    },
    [],
  );

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const brandsById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);

  const dirty = useMemo(
    () => !!draft && !!model && JSON.stringify(draft) !== JSON.stringify(model),
    [draft, model],
  );

  const requestEdit = (k: GuideStudioSection) => {
    if (dirty && editingId && editingId !== k) {
      flash('Save or cancel the current section first.');
      return;
    }
    setEditingId(k);
    setDraft(model ? { ...model } : null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };
  const patchDraft = (p: Partial<GuideStudioModel>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const saveSection = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      let savedId = draft.id;
      if (isNew || draft.id === 'new') {
        const createBody: Partial<CatalogGuide> = guideStudioModelToPatch(draft);
        if (newPublisherBrandId) {
          createBody.publisherType = 'brand';
          createBody.publisherBrandId = newPublisherBrandId;
        }
        const created = await catalogApi.createGuide(createBody);
        savedId = created.id;
        const m = mapCatalogGuideToStudioModel(created);
        setModel(m);
        setEditingId(null);
        setDraft(null);
        void resolvePublisher(m, products, brands);
        navigate(`/admin/guides/${savedId}/edit`, { replace: true });
        flash('Guide created (draft)');
        return;
      }
      const saved = await catalogApi.patchGuide(savedId, guideStudioModelToPatch(draft));
      const m = mapCatalogGuideToStudioModel(saved);
      setModel(m);
      setEditingId(null);
      setDraft(null);
      void resolvePublisher(m, products, brands);
      flash('Section saved');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const lifecycle = async (action: 'publish' | 'unpublish' | 'archive') => {
    if (!model || isNew || model.id === 'new') {
      flash('Save the guide first.');
      return;
    }
    setBusy(true);
    try {
      const saved =
        action === 'publish'
          ? await catalogApi.publishGuide(model.id)
          : action === 'unpublish'
            ? await catalogApi.unpublishGuide(model.id)
            : await catalogApi.archiveGuide(model.id);
      const m = mapCatalogGuideToStudioModel(saved);
      setModel(m);
      void resolvePublisher(m, products, brands);
      flash(action === 'publish' ? 'Guide published' : action === 'archive' ? 'Guide archived' : 'Guide moved to draft');
    } catch (e) {
      flash(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusy(false);
    }
  };

  // ── optional-section layout (add / remove / toggle / reorder) ───────────
  const applyLayout = useCallback(
    async (next: SectionLayoutEntry[]) => {
      setModel((m) => (m ? { ...m, sectionLayout: next } : m));
      if (editingId) setDraft((dd) => (dd ? { ...dd, sectionLayout: next } : dd));
      if (isNew || !model || model.id === 'new') return;
      try {
        const saved = await catalogApi.patchGuide(
          model.id,
          guideStudioModelToPatch({ ...model, sectionLayout: next }),
        );
        setModel(mapCatalogGuideToStudioModel(saved));
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Could not update sections');
      }
    },
    [editingId, isNew, model, flash],
  );

  const layout = (editingId && draft ? draft : model)?.sectionLayout ?? [];
  const addableSections = OPTIONAL_SECTIONS.filter((s) => !layout.some((e) => e.id === s));

  const bridge: GuideStudioBridge = {
    editingSection: editingId,
    dirty,
    saving,
    onEdit: requestEdit,
    onCancel: cancelEdit,
    onSave: saveSection,
    renderEditor: (section) => renderEditor(section),
    addableSections,
    onAddSection: (k) => {
      if (layout.some((e) => e.id === k)) return;
      void applyLayout([...layout, { id: k, enabled: true }]);
      flash(`Added "${GUIDE_SECTION_TITLE[k]}"`);
    },
    onRemoveSection: (k) => void applyLayout(layout.filter((e) => e.id !== k)),
    onToggleSection: (k, enabled) =>
      void applyLayout(layout.map((e) => (e.id === k ? { ...e, enabled } : e))),
    onMoveSection: (k, dir) => {
      const i = layout.findIndex((e) => e.id === k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= layout.length) return;
      const next = [...layout];
      [next[i], next[j]] = [next[j], next[i]];
      void applyLayout(next);
    },
  };

  const d = draft;
  const entityRefOptions = (m: GuideStudioModel): Array<{ key: string; label: string; ref: GuideEntityRef }> => {
    const out: Array<{ key: string; label: string; ref: GuideEntityRef }> = [];
    m.productIds.forEach((pid) => {
      const ref: GuideEntityRef = { entityType: 'product', entityId: pid };
      out.push({ key: refKey(ref), label: `Product · ${productsById.get(pid)?.title || pid}`, ref });
    });
    m.brandIds.forEach((bid) => {
      const ref: GuideEntityRef = { entityType: 'brand', entityId: bid };
      out.push({ key: refKey(ref), label: `Brand · ${brandsById.get(bid)?.name || bid}`, ref });
    });
    m.externalRefs.forEach((x) => {
      const ref: GuideEntityRef = {
        entityType: x.kind === 'brand' ? 'external_brand' : 'external_product',
        entityId: x.id,
      };
      out.push({ key: refKey(ref), label: `External ${x.kind} · ${x.title || x.id}`, ref });
    });
    return out;
  };

  /** Resolve a PendingGuideRef into a typed ref, tagging the entity into the
   *  draft guide if it isn't already discussed. Returns the ref + the mutated draft. */
  const resolvePendingRef = (
    dd: GuideStudioModel,
    p: PendingGuideRef,
  ): { next: GuideStudioModel; ref: GuideEntityRef } => {
    const next: GuideStudioModel = { ...dd };
    if (p.t === 'product') {
      if (!next.productIds.includes(p.id)) next.productIds = [...next.productIds, p.id];
      return { next, ref: { entityType: 'product', entityId: p.id } };
    }
    if (p.t === 'brand') {
      if (!next.brandIds.includes(p.id)) next.brandIds = [...next.brandIds, p.id];
      return { next, ref: { entityType: 'brand', entityId: p.id } };
    }
    const id = `ext-${Date.now()}`;
    next.externalRefs = [
      ...next.externalRefs,
      { id, kind: p.kind, title: p.title, externalUrl: p.url },
    ];
    return {
      next,
      ref: { entityType: p.kind === 'brand' ? 'external_brand' : 'external_product', entityId: id },
    };
  };

  const appendGuideRef = (target: 'picks' | 'awards', p: PendingGuideRef) =>
    setDraft((dd) => {
      if (!dd) return dd;
      const { next, ref } = resolvePendingRef(dd, p);
      const row = { id: `${target === 'picks' ? 'pick' : 'award'}-${Date.now()}`, label: '', ref };
      next[target] = [...dd[target], row];
      return next;
    });

  const setWinnerOverallFromPending = (p: PendingGuideRef) =>
    setDraft((dd) => {
      if (!dd) return dd;
      const { next, ref } = resolvePendingRef(dd, p);
      next.winnerOverall = ref;
      return next;
    });

  function renderEditor(section: GuideStudioSection): React.ReactNode {
    if (!d) return null;
    switch (section) {
      case 'media':
        return (
          <div className="space-y-4">
            <div>
              <div className={label}>Photos</div>
              <div className={hint}>
                The first photo is the hero. Add several, only one, or none — a video-only guide is fine.
              </div>
              <PhotoGalleryEditor
                photos={d.photos}
                onChange={(photos) => patchDraft({ photos })}
                onToast={flash}
              />
            </div>
            <div>
              <div className={label}>{d.format === 'live' ? 'Recorded video / replay (optional)' : 'Video (optional)'}</div>
              <div className={hint}>
                e.g. a YouTube link (https://youtube.com/watch?v=…), a direct .mp4/.webm URL, or an uploaded file.
              </div>
              <GuideVideoField
                value={d.videoUrl}
                onChange={(videoUrl) => patchDraft({ videoUrl })}
                onToast={flash}
              />
            </div>
            {d.format === 'live' ? (
              <div className="rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] p-3 space-y-2">
                <div className={label}>Live session</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <div className={label}>Live embed URL</div>
                    <input
                      className={input}
                      value={d.liveEmbedUrl}
                      placeholder="e.g. https://www.youtube.com/embed/xxxx (the ongoing stream)"
                      onChange={(e) => patchDraft({ liveEmbedUrl: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className={label}>Live status</div>
                    <select
                      className={input}
                      value={d.liveStatus || 'replay'}
                      onChange={(e) => patchDraft({ liveStatus: e.target.value })}
                    >
                      {['upcoming', 'live', 'replay', 'ended'].map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={label}>Platform</div>
                    <select
                      className={input}
                      value={d.livePlatform || 'youtube'}
                      onChange={(e) => patchDraft({ livePlatform: e.target.value })}
                    >
                      {['youtube', 'facebook', 'tiktok', 'instagram', 'vimeo', 'native'].map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={label}>Scheduled at (optional)</div>
                    <input
                      className={input}
                      value={d.liveScheduledAt}
                      placeholder="e.g. 2026-09-01T18:00:00Z"
                      onChange={(e) => patchDraft({ liveScheduledAt: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      case 'identity':
        return (
          <div className="space-y-3">
            <div>
              <div className={label}>Title</div>
              <input
                className={input}
                value={d.title}
                placeholder="e.g. Best Flagship Phones in Bangladesh (2026)"
                onChange={(e) => patchDraft({ title: e.target.value })}
              />
              <div className={hint}>A clear, specific headline — what the reader gets and for when.</div>
            </div>
            <div>
              <div className={label}>Summary</div>
              <textarea
                className={textarea}
                rows={3}
                value={d.excerpt}
                placeholder="e.g. Six weeks with every 2026 flagship sold in Bangladesh — here's the one to buy, and who each rival is actually for."
                onChange={(e) => patchDraft({ excerpt: e.target.value })}
              />
              <div className={hint}>1–2 sentences shown under the title and in listings.</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <div className={label}>Category</div>
                {(() => {
                  const known = categoryNames.length
                    ? categoryNames
                    : ['Mobile Phones', 'Laptops', 'Audio', 'Home & Living', 'Fashion', 'Beauty', 'Gaming'];
                  const isCustom =
                    !!d.category && !known.some((c) => c.toLowerCase() === d.category.toLowerCase());
                  return (
                    <>
                      <select
                        className={input}
                        value={isCustom ? '__custom__' : d.category}
                        onChange={(e) =>
                          patchDraft({ category: e.target.value === '__custom__' ? ' ' : e.target.value })
                        }
                      >
                        <option value="">— Select a category —</option>
                        {known.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__custom__">Custom…</option>
                      </select>
                      {isCustom ? (
                        <input
                          className={`${input} mt-1.5`}
                          autoFocus
                          value={d.category.trim()}
                          placeholder="Type a custom category"
                          onChange={(e) => patchDraft({ category: e.target.value })}
                        />
                      ) : null}
                    </>
                  );
                })()}
              </div>
              <div>
                <div className={label}>Media type</div>
                <select className={input} value={d.type} onChange={(e) => patchDraft({ type: e.target.value as GuideStudioModel['type'] })}>
                  {GUIDE_MEDIA_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className={label}>Read time</div>
                <input
                  className={input}
                  value={d.readTime}
                  placeholder="e.g. 9 MIN READ"
                  onChange={(e) => patchDraft({ readTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <div className={label}>Editorial format / template</div>
              <select
                className={input}
                value={d.format}
                onChange={(e) => patchDraft({ format: e.target.value as GuideStudioModel['format'] })}
              >
                {GUIDE_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {GUIDE_FORMAT_LABEL[f]}
                  </option>
                ))}
              </select>
              <div className={hint}>
                Seeds the initial sections when a guide is created. It’s a starting preset, not a lock — add or
                remove any section afterwards.
              </div>
            </div>
            <div>
              <div className={label}>Tags</div>
              <ListEditor
                items={d.tags}
                onChange={(tags) => patchDraft({ tags: tags.map((t) => t.replace(/^#+/, '')) })}
                placeholder="flagship"
                addLabel="Add tag"
              />
            </div>
          </div>
        );
      case 'description':
        return (
          <div>
            <div className={label}>{d.format === 'live' ? 'Event description' : 'Article body'}</div>
            <textarea
              className={textarea}
              rows={8}
              value={d.body}
              onChange={(e) => patchDraft({ body: e.target.value })}
              placeholder={
                d.format === 'live'
                  ? "e.g. Recorded live on Choosify. We answer viewer questions and shop three home-audio setups on air. Timestamps in the description; products update automatically from the catalogue."
                  : "e.g. We bought each phone at retail in Dhaka, ran the same 40-point test suite, and lived with the top three as daily drivers for two weeks each. No units were supplied by brands."
              }
            />
            <div className={hint}>Plain text. This is the main body shown on the storefront.</div>
          </div>
        );
      case 'winner': {
        const opts = entityRefOptions(d);
        return (
          <div className="space-y-3">
            <div>
              <div className={label}>Overall winner (optional)</div>
              <select
                className={input}
                value={refKey(d.winnerOverall)}
                onChange={(e) => {
                  const found = opts.find((o) => o.key === e.target.value);
                  patchDraft({ winnerOverall: found?.ref });
                }}
              >
                <option value="">— No overall winner —</option>
                {opts.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className={hint}>
                Only add a winner when the guide genuinely has one — never just because several products are
                tagged.
              </div>
              {!opts.length ? (
                <div className="mt-2">
                  <AddGuideRef
                    products={products}
                    brands={brands}
                    addLabel="Choose the winner"
                    onAdd={setWinnerOverallFromPending}
                  />
                </div>
              ) : null}
            </div>
            <div>
              <div className={label}>Category awards (optional)</div>
              <RefLabelListEditor
                rows={d.awards}
                options={opts}
                onChange={(awards) => patchDraft({ awards })}
                labelPlaceholder="e.g. Best Value"
                addLabel="Add award"
                hideAdd
              />
              <AddGuideRef
                products={products}
                brands={brands}
                addLabel="Add an award"
                onAdd={(p) => appendGuideRef('awards', p)}
              />
            </div>
          </div>
        );
      }
      case 'picks': {
        const opts = entityRefOptions(d);
        return (
          <div className="space-y-2">
            <div className={label}>Labelled picks — no ranking implied</div>
            <RefLabelListEditor
              rows={d.picks}
              options={opts}
              onChange={(picks) => patchDraft({ picks })}
              labelPlaceholder="e.g. Editor’s Pick / Best for Students"
              addLabel="Add pick"
              hideAdd
            />
            <AddGuideRef
              products={products}
              brands={brands}
              addLabel="Add a pick"
              onAdd={(p) => appendGuideRef('picks', p)}
            />
            <div className={hint}>
              Give each pick a creator-defined label (Best Value, Editor’s Pick…). Picking a product or brand
              also adds it to the guide. Labels are length-clamped server-side.
            </div>
          </div>
        );
      }
      case 'externalRefs':
        return (
          <div className="space-y-2">
            <div className={label}>Off-platform products &amp; brands</div>
            <ExternalRefEditor refs={d.externalRefs} onChange={(externalRefs) => patchDraft({ externalRefs })} onToast={flash} />
          </div>
        );
      case 'liveOffers':
        return (
          <div className="space-y-2">
            <div className={label}>Temporary guide offers</div>
            <LiveOfferEditor
              offers={d.liveOffers}
              productIds={d.productIds}
              productsById={productsById}
              onChange={(liveOffers) => patchDraft({ liveOffers })}
              allowed={d.publisherType === 'brand'}
            />
          </div>
        );
      case 'socialLinks':
        return (
          <div className="space-y-2">
            <div className={label}>Continue watching / social links</div>
            <SocialLinkEditor links={d.socialLinks} onChange={(socialLinks) => patchDraft({ socialLinks })} />
          </div>
        );
      case 'whyWon':
        return (
          <div>
            <div className={label}>Reason chips</div>
            <ListEditor
              items={d.whyWonChips}
              onChange={(whyWonChips) => patchDraft({ whyWonChips })}
              placeholder="e.g. Brightest display tested"
              addLabel="Add reason"
            />
            <div className={hint}>Short, scannable reasons the winner came out on top (3–6 works well).</div>
          </div>
        );
      case 'verdict':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className={label}>Best For</div>
              <ListEditor items={d.bestFor} onChange={(bestFor) => patchDraft({ bestFor })} placeholder="e.g. Heavy daily users & professionals" addLabel="Add" />
            </div>
            <div>
              <div className={label}>Not For</div>
              <ListEditor items={d.notFor} onChange={(notFor) => patchDraft({ notFor })} placeholder="e.g. Tight budgets" addLabel="Add" />
            </div>
            <div>
              <div className={label}>Pros</div>
              <ListEditor items={d.pros} onChange={(pros) => patchDraft({ pros })} placeholder="e.g. Class-leading screen brightness" addLabel="Add" />
            </div>
            <div>
              <div className={label}>Cons</div>
              <ListEditor items={d.cons} onChange={(cons) => patchDraft({ cons })} placeholder="e.g. Charger sold separately" addLabel="Add" />
            </div>
          </div>
        );
      case 'takeaways':
        return (
          <div className="space-y-3">
            <div>
              <div className={label}>Takeaway title</div>
              <input
                className={input}
                value={d.takeawayTitle}
                placeholder="e.g. The verdict"
                onChange={(e) => patchDraft({ takeawayTitle: e.target.value })}
              />
            </div>
            <div>
              <div className={label}>Takeaway body</div>
              <textarea
                className={textarea}
                rows={4}
                value={d.takeawayBody}
                placeholder="e.g. If you want the safest long-term flagship buy in Bangladesh this year, the winner is worth the premium. The runner-up saves money if you can live with weaker sustained performance."
                onChange={(e) => patchDraft({ takeawayBody: e.target.value })}
              />
            </div>
          </div>
        );
      case 'products':
        return (
          <div className="space-y-2">
            <div className={label}>Products discussed — canonical catalog references</div>
            <ProductPicker
              catalog={products}
              picked={d.productIds}
              onChange={(productIds) =>
                patchDraft({
                  productIds,
                  topPickIds: d.topPickIds.filter((x) => productIds.includes(x)),
                  productHighlights: Object.fromEntries(
                    Object.entries(d.productHighlights).filter(([k]) => productIds.includes(k)),
                  ),
                })
              }
              topPickIds={d.topPickIds}
              onTopPickChange={(topPickIds) => patchDraft({ topPickIds })}
              highlights={d.productHighlights}
              onHighlightsChange={(productHighlights) => patchDraft({ productHighlights })}
            />
            <div className={hint}>
              Search the real Choosify catalogue. Price / image / stock always come from the live product — never re-typed here.
            </div>
            <div className="rounded-lg border border-dashed border-[#E8EDF2] bg-[#F9FAFB] p-2.5">
              <div className={label}>…or add an off-platform product</div>
              <ExternalRefEditor
                refs={d.externalRefs.filter((r) => r.kind === 'product')}
                onChange={(prodRefs) =>
                  patchDraft({ externalRefs: [...d.externalRefs.filter((r) => r.kind !== 'product'), ...prodRefs] })
                }
                onToast={flash}
              />
            </div>
          </div>
        );
      case 'brandMentions':
        return (
          <div className="space-y-2">
            <div className={label}>Brands mentioned / discussed (not authorship)</div>
            <BrandPicker
              catalog={brands}
              picked={d.brandIds}
              onChange={(brandIds) =>
                patchDraft({
                  brandIds,
                  brandHighlights: Object.fromEntries(
                    Object.entries(d.brandHighlights).filter(([k]) => brandIds.includes(k)),
                  ),
                })
              }
              highlights={d.brandHighlights}
              onHighlightsChange={(brandHighlights) => patchDraft({ brandHighlights })}
            />
            <div className={hint}>
              Brands this guide talks about. This is not the publisher — a brand-authored guide's publisher is set from Brand Studio.
            </div>
            <div className="rounded-lg border border-dashed border-[#E8EDF2] bg-[#F9FAFB] p-2.5">
              <div className={label}>…or add an off-platform brand</div>
              <ExternalRefEditor
                refs={d.externalRefs.filter((r) => r.kind === 'brand')}
                onChange={(brandRefs) =>
                  patchDraft({ externalRefs: [...d.externalRefs.filter((r) => r.kind !== 'brand'), ...brandRefs] })
                }
                onToast={flash}
              />
            </div>
          </div>
        );
      case 'methodology':
        return (
          <div>
            <div className={label}>Review method steps</div>
            <ListEditor
              items={d.reviewMethodSteps}
              onChange={(reviewMethodSteps) => patchDraft({ reviewMethodSteps })}
              placeholder="e.g. Bought at retail in Dhaka · Same 40-point test suite on each · No sponsored placement"
              addLabel="Add step"
            />
            <div className={hint}>How the review was done — testing period, sample size, sponsorship disclosure.</div>
          </div>
        );
      default:
        return null;
    }
  }

  if (loading || !model) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-3 text-[#9AA0AC]">
        <RotateCw className="w-8 h-8 animate-spin text-[#EF3C23]" />
        <span className="text-xs font-mono">Loading Guide Studio…</span>
        {loadError ? <span className="text-[12px] text-[#DC2626] max-w-md text-center">{loadError}</span> : null}
        {loadError ? (
          <button
            type="button"
            onClick={() => navigate('/admin/guides')}
            className="px-3.5 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-extrabold bg-white"
          >
            Back to Guide Management
          </button>
        ) : null}
      </div>
    );
  }

  const showModel = editingId && draft ? draft : model;
  const canPublish = !isNew && model.id !== 'new';

  return (
    <div className="w-full bg-[#F0F8FF] min-h-screen overflow-x-clip">
      <header className="sticky top-[var(--cms-topbar-height,64px)] z-[8] flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EDF2] bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/admin/guides')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8EDF2] text-[#374151]"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#EF3C23]">Guide Studio</div>
            <div className="truncate text-[13px] font-extrabold text-[#1A1A2E]">
              {model.title || 'New Guide'}
            </div>
          </div>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
              model.status === 'live'
                ? 'bg-emerald-100 text-emerald-700'
                : model.status === 'archived'
                  ? 'bg-[#F3F4F6] text-[#6B7280]'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {model.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#E8EDF2] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (editMode && editingId) cancelEdit();
                setEditMode(false);
              }}
              className={`px-3 py-1.5 text-[11px] font-bold ${
                !editMode ? 'bg-[#1A1A2E] text-white' : 'bg-white text-[#374151]'
              }`}
            >
              View
            </button>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className={`px-3 py-1.5 text-[11px] font-bold ${
                editMode ? 'bg-[#EF3C23] text-white' : 'bg-white text-[#374151]'
              }`}
            >
              Edit
            </button>
          </div>
          {model.slug && model.status === 'live' ? (
            <a
              href={`http://localhost:5173/spotlight/${model.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-[#E8EDF2] px-3 py-1.5 text-[11px] font-bold text-[#374151]"
            >
              View public page <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          {canPublish && model.status !== 'live' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void lifecycle('publish')}
              className="rounded-lg bg-[#EF3C23] px-3.5 py-2 text-[11px] font-extrabold text-white disabled:opacity-60"
            >
              Publish
            </button>
          ) : null}
          {canPublish && model.status === 'live' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void lifecycle('unpublish')}
              className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[11px] font-extrabold bg-white disabled:opacity-60"
            >
              Unpublish
            </button>
          ) : null}
          {canPublish && model.status !== 'archived' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void lifecycle('archive')}
              className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[11px] font-extrabold bg-white disabled:opacity-60"
            >
              Archive
            </button>
          ) : null}
          <span className="hidden lg:inline text-[10px] text-[#9AA0AC]">
            {editMode ? 'Each section saves on its own' : 'Read-only preview — click Edit to make changes'}
          </span>
        </div>
      </header>

      {isNew ? (
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-4">
          <div className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className={label}>Publisher</div>
            {profile?.role === 'creator' ? (
              <p className="text-[12px] text-[#4B5563] m-0">
                Publishing as <b>you</b> — this guide is authored by your Creator profile.
              </p>
            ) : ownedBrands.length ? (
              <>
                <select
                  className={input}
                  value={newPublisherBrandId}
                  onChange={(e) => setNewPublisherBrandId(e.target.value)}
                >
                  <option value="">Choosify Editorial (creator / staff)</option>
                  {ownedBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      Brand: {b.name}
                    </option>
                  ))}
                </select>
                <div className={hint}>
                  A brand publisher shows "About the Brand" and no author card. Only brands you own are listed.
                </div>
              </>
            ) : (
              <p className="text-[12px] text-[#4B5563] m-0">
                Publishing as <b>Choosify Editorial</b>. Author identity is resolved from your account.
              </p>
            )}
            <p className="text-[11px] text-[#9AA0AC] mt-2 mb-0">
              Fill in the Identity section below and Save to create the draft.
            </p>
          </div>
        </div>
      ) : null}

      <GuideStudioPresentation
        model={showModel}
        mode={editMode ? 'studio' : 'view'}
        studio={bridge}
        productsById={productsById}
        brandsById={brandsById}
        publisher={publisher}
      />

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[60] rounded-xl bg-[#1A1A2E] px-4 py-3 text-[12px] font-semibold text-white shadow-2xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
