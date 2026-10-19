import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Plus, RotateCw, Trash2, Upload } from 'lucide-react';
import { catalogApi, isStaleWriteError } from '../../services/catalogApi';
import {
  StudioChecklist,
  StudioConfirmDialog,
  StudioConflictNotice,
  changedFields,
  creatorReadiness,
  useUnsavedChangesGuard,
} from '../../components/studio';
import { publicProfileUrl } from '../../components/admin/PublicHandlePanels';
import { publicHandlesOwnerApi } from '../../services/publicHandlesOwnerApi';
import { useAuth } from '../../contexts/AuthContext';
import { PublicIdentitySection } from '../../components/publicIdentity/PublicIdentitySection';
import { useEntityDraft } from '../../hooks/useEntityDraft';
import { dataUrlToFile, describeUploadFailures, uploadCreatorImage } from '../../services/mediaUpload';
import { CreatorProfilePresentation, type CreatorStudioBridge } from '../../components/creator-profile';
import { ProfileImageAdjustModal, type ProfileImageAdjustResult } from '../../components/media/ProfileImageAdjustModal';
import type { ProfileImageCropParams } from '../../../shared/media/profileImageCrop';
import {
  CREATOR_SOCIAL_PLATFORMS,
  CREATOR_SOCIAL_PLATFORM_KEYS,
  creatorCustomContactProblem,
  creatorCustomLinkProblem,
  creatorEmailProblem,
  creatorOverviewSectionProblem,
  creatorPhoneProblem,
  creatorSocialLinkProblem,
} from '../../../shared/creatorProfileRules';
import type { CatalogBrand } from '../../types/catalog';
import {
  createBlankCreatorModel,
  editorModelToCreatorPayload,
  editorModelToCreatorSectionPatch,
  mapCatalogCreatorToEditor,
  type CreatorBrandPartner,
  type CreatorEditSection,
  type CreatorEditorModel,
  type CreatorFeaturedItem,
} from './creatorEditorModel';


const label = 'block text-[10px] font-extrabold uppercase tracking-wider text-[#6B7280] mb-1';
const input =
  'w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px] text-[#1A1A2E] outline-none focus:border-[#EF3C23]';
const textarea = `${input} min-h-[110px] leading-relaxed`;
const ghostBtn =
  'inline-flex items-center gap-1 rounded-md border border-[#E8EDF2] bg-white px-2 py-1 text-[10px] font-bold text-[#374151] hover:bg-[#F8FAFC]';
const hint = 'mt-1 text-[10.5px] leading-snug text-[#9CA3AF]';
const inputInvalid = 'border-[#DC2626] focus:border-[#DC2626]';
const fieldError = 'mt-1 text-[10.5px] font-semibold leading-snug text-[#DC2626]';

/** Field-level problems in a section's draft — the same rules the server enforces
 *  (shared/creatorProfileRules). Save is blocked while any are present. */
type CreatorFieldErrors = Record<string, string>;
function creatorSectionErrors(section: CreatorEditSection | null, d: CreatorEditorModel | null): CreatorFieldErrors {
  const out: CreatorFieldErrors = {};
  if (!d || !section) return out;
  if (section === 'social') {
    for (const k of CREATOR_SOCIAL_PLATFORM_KEYS) {
      const p = creatorSocialLinkProblem(k, d.socialLinks[k] || '');
      if (p) out[k] = p;
    }
    const seen = new Set<string>();
    (d.socialLinks.custom ?? []).forEach((c, i) => {
      const p = creatorCustomLinkProblem(c.label || '', c.url || '');
      const key = (c.url || '').trim().toLowerCase().replace(/\/+$/, '');
      if (p) out[`custom.${i}`] = p;
      else if (key && seen.has(key)) out[`custom.${i}`] = 'This link is already listed';
      if (key) seen.add(key);
    });
  }
  if (section === 'contact') {
    const e = creatorEmailProblem(d.email);
    if (e) out.email = e;
    const ph = creatorPhoneProblem(d.phone);
    if (ph) out.phone = ph;
    (d.customContacts ?? []).forEach((c, i) => {
      const p = creatorCustomContactProblem(c.label || '', c.value || '');
      if (p) out[`contact.${i}`] = p;
    });
  }
  if (section === 'overview') {
    (d.overviewSections ?? []).forEach((o, i) => {
      const p = creatorOverviewSectionProblem(o.title || '', o.body || '');
      if (p) out[`overview.${i}`] = p;
    });
  }
  if (section === 'identity' && !d.name.trim()) out.name = 'Add your creator name';
  return out;
}

const SECTION_LABEL: Record<CreatorEditSection, string> = {
  cover: 'Cover Image',
  avatar: 'Profile Photo',
  identity: 'Profile Identity',
  social: 'Social Links',
  expertise: 'Expertise & Topics',
  overview: 'Creator Overview',
  contact: 'Contact & Reach',
  partnerships: 'Partnerships',
  featured: 'Featured Content',
};

/* ── Repeatable single-line list editor ──────────────────────────────────── */
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
  return (
    <div className="space-y-1.5">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            className={input}
            value={v}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))}
          />
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

/** Present only for the avatar (roundedFull) field — routes uploads through
 *  the shared ProfileImageAdjustModal instead of a raw upload, and persists
 *  the original + crop params alongside the displayed avatar (see
 *  CatalogCreator.avatarOriginal/avatarCrop). */
type ImageFieldCropConfig = {
  originalValue?: string;
  cropValue?: ProfileImageCropParams;
  onAdjustMeta?: (meta: { originalUrl: string; crop: ProfileImageCropParams } | null) => void;
};

/* ── One image (cover or avatar) — canonical uploadCreatorImage, inline preview ── */
function ImageField({
  value,
  onChange,
  onToast,
  aspect,
  roundedFull,
  emptyLabel,
  crop,
}: {
  value: string;
  onChange: (u: string) => void;
  onToast: (m: string) => void;
  aspect: string;
  roundedFull?: boolean;
  emptyLabel: string;
  crop?: ImageFieldCropConfig;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState('');

  const doUpload = async (files: FileList | File[] | null) => {
    const f = Array.from(files ?? []).find((x) => x.type.startsWith('image/'));
    if (!f) {
      onToast('Choose a JPG or PNG image.');
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadCreatorImage(f));
    } catch (e) {
      // Nothing is set on failure: a local preview would look saved but never reach visitors.
      onToast(describeUploadFailures([{ name: f.name, message: e instanceof Error ? e.message : 'Upload failed' }]));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pickForCrop = (files: FileList | File[] | null) => {
    const f = Array.from(files ?? []).find((x) => x.type.startsWith('image/'));
    if (!f) {
      onToast('Choose a JPG or PNG image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(String(reader.result || ''));
      setCropOpen(true);
    };
    reader.onerror = () => onToast('Could not read this file.');
    reader.readAsDataURL(f);
  };

  const openAdjust = () => {
    if (!value || !crop) return;
    setCropSrc(crop.originalValue || value);
    setCropOpen(true);
  };

  const onCropSave = async (result: ProfileImageAdjustResult) => {
    setCropOpen(false);
    const originalSrc = cropSrc;
    setCropSrc('');
    setBusy(true);
    try {
      const outputUrl = await uploadCreatorImage(dataUrlToFile(result.dataUrl, 'creator-avatar.png'));
      // A fresh pick's "original" hasn't been persisted anywhere yet — upload
      // it once now. Re-adjusting an existing avatar reuses the original
      // already on file, no second upload needed.
      const originalUrl = originalSrc.startsWith('data:')
        ? await uploadCreatorImage(dataUrlToFile(originalSrc, 'creator-avatar-original.png'))
        : originalSrc;
      onChange(outputUrl);
      crop?.onAdjustMeta?.({ originalUrl, crop: result.crop });
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onCropCancel = () => {
    setCropOpen(false);
    setCropSrc('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePicked = crop ? pickForCrop : doUpload;

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handlePicked(e.target.files)}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handlePicked(e.dataTransfer.files);
        }}
        className={`relative ${aspect} ${roundedFull ? 'rounded-full' : 'rounded-lg'} overflow-hidden border border-[#E8EDF2] bg-[#F4F7F9] cursor-pointer flex items-center justify-center`}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-[11px] font-bold text-[#9CA3AF] flex items-center gap-1.5">
            {busy ? <RotateCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? 'Uploading…' : emptyLabel}
          </span>
        )}
        {busy && value ? (
          <span
            role="status"
            className="absolute inset-0 flex items-center justify-center gap-1.5 bg-white/75 text-[11px] font-bold text-[#374151]"
          >
            <RotateCw className="h-4 w-4 animate-spin" /> Uploading…
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex gap-2">
        <button type="button" className={ghostBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
          {value ? 'Replace' : 'Upload'}
        </button>
        {crop && value ? (
          <button type="button" className={ghostBtn} disabled={busy} onClick={openAdjust}>
            Adjust
          </button>
        ) : null}
        {value ? (
          <button
            type="button"
            className={`${ghostBtn} text-[#DC2626]`}
            disabled={busy}
            onClick={() => {
              onChange('');
              crop?.onAdjustMeta?.(null);
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      {crop && (
        <ProfileImageAdjustModal
          open={cropOpen}
          imageSrc={cropSrc}
          initialCrop={cropSrc && cropSrc === crop.originalValue ? crop.cropValue : null}
          title="Edit profile photo"
          helpText="Drag to reposition. Zoom in/out or use the slider."
          shape="circle"
          outputLongSide={256}
          accentColor="#EF3C23"
          onCancel={onCropCancel}
          onSave={onCropSave}
        />
      )}
    </div>
  );
}

/* ── Small square thumbnail upload (featured card / brand logo) ─────────── */
function ThumbField({
  value,
  onChange,
  onToast,
  rounded,
}: {
  value: string;
  onChange: (u: string) => void;
  onToast: (m: string) => void;
  rounded?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const doUpload = async (files: FileList | File[] | null) => {
    const f = Array.from(files ?? []).find((x) => x.type.startsWith('image/'));
    if (!f) {
      onToast('Choose a JPG or PNG image.');
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadCreatorImage(f));
    } catch (e) {
      // Nothing is set on failure: a local preview would look saved but never reach visitors.
      onToast(describeUploadFailures([{ name: f.name, message: e instanceof Error ? e.message : 'Upload failed' }]));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void doUpload(e.target.files)} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && fileRef.current?.click()}
        className={`w-14 h-14 ${rounded ? 'rounded-full' : 'rounded-lg'} overflow-hidden border border-[#E8EDF2] bg-[#F4F7F9] shrink-0 flex items-center justify-center cursor-pointer`}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : busy ? (
          <RotateCw className="h-4 w-4 animate-spin text-[#9CA3AF]" />
        ) : (
          <Upload className="h-4 w-4 text-[#9CA3AF]" />
        )}
      </div>
      <button type="button" className={ghostBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
        {value ? 'Replace' : 'Upload'}
      </button>
      {value ? (
        <button type="button" className={`${ghostBtn} text-[#DC2626]`} onClick={() => onChange('')}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

/* ── Extra social links (label + url) ─────────────────────────────────── */
function SocialCustomEditor({
  items,
  onChange,
  errors,
}: {
  items: Array<{ label: string; url: string }>;
  onChange: (v: Array<{ label: string; url: string }>) => void;
  errors: CreatorFieldErrors;
}) {
  const upd = (i: number, p: Partial<{ label: string; url: string }>) =>
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-1.5">
      <div className={label}>More links</div>
      {items.map((c, i) => {
        const err = errors[`custom.${i}`];
        return (
          <div key={i}>
            <div className="flex items-center gap-1.5">
              <input
                className={`${input} max-w-[150px]`}
                value={c.label}
                placeholder="Label (e.g. Twitch)"
                aria-label={`Other link ${i + 1} name`}
                maxLength={40}
                onChange={(e) => upd(i, { label: e.target.value })}
              />
              <input
                className={`${input} ${err ? inputInvalid : ''}`}
                value={c.url}
                type="url"
                inputMode="url"
                placeholder="https://…"
                aria-label={`Other link ${i + 1} address`}
                aria-invalid={err ? true : undefined}
                onChange={(e) => upd(i, { url: e.target.value })}
              />
              <button
                type="button"
                className={`${ghostBtn} text-[#DC2626]`}
                aria-label={`Remove other link ${i + 1}`}
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {err ? <div className={fieldError} role="alert">{err}</div> : null}
          </div>
        );
      })}
      {items.length < 8 ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
          onClick={() => onChange([...items, { label: '', url: '' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add a link
        </button>
      ) : (
        <div className={hint}>Up to 8 extra links.</div>
      )}
    </div>
  );
}

/* ── Creator Overview — bio + creator-defined titled sections ───────────── */
const OVERVIEW_PRESETS = ['Experience', 'How I review', 'Equipment & setup', 'Awards & recognition', 'What I cover'];

function OverviewEditor({
  d,
  patchDraft,
  errors,
}: {
  d: CreatorEditorModel;
  patchDraft: (p: Partial<CreatorEditorModel>) => void;
  errors: CreatorFieldErrors;
}) {
  const secs = d.overviewSections ?? [];
  const set = (next: typeof secs) => patchDraft({ overviewSections: next });
  const upd = (i: number, p: Partial<{ title: string; body: string }>) => set(secs.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= secs.length) return;
    const next = [...secs];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const add = (title: string) => {
    if (secs.length >= 8) return;
    set([...secs, { id: `cos-${Date.now().toString(36)}`, title, body: '' }]);
  };
  return (
    <div className="space-y-3" data-testid="creator-overview-editor">
      <div className="rounded-lg border border-[#E8EDF2] bg-[#FBFCFE] p-3">
        <div className={label}>📄 Background &amp; Bio</div>
        <textarea
          className={textarea}
          rows={4}
          value={d.bio}
          placeholder="A short, first-person intro shown on your public profile — who you are, what you cover, why buyers should trust your picks."
          onChange={(e) => patchDraft({ bio: e.target.value })}
        />
        <div className={hint}>Also appears in your profile header.</div>
      </div>
      {secs.map((o, i) => {
        const err = errors[`overview.${i}`];
        return (
          <div key={o.id} className="rounded-lg border border-[#E8EDF2] bg-white p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <input
                className={`${input} font-bold`}
                value={o.title}
                placeholder="Section title (e.g. Experience)"
                aria-label={`Overview section ${i + 1} title`}
                maxLength={60}
                onChange={(e) => upd(i, { title: e.target.value })}
              />
              <button type="button" className={ghostBtn} aria-label={`Move overview section ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className={ghostBtn} aria-label={`Move overview section ${i + 1} down`} disabled={i === secs.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button
                type="button"
                className={`${ghostBtn} text-[#DC2626]`}
                aria-label={`Remove overview section ${i + 1}`}
                onClick={() => set(secs.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <textarea
              className={`${textarea} min-h-[80px] ${err ? inputInvalid : ''}`}
              rows={3}
              value={o.body}
              placeholder="Write a few sentences for this section."
              aria-label={`Overview section ${i + 1} text`}
              aria-invalid={err ? true : undefined}
              maxLength={2000}
              onChange={(e) => upd(i, { body: e.target.value })}
            />
            {err ? <div className={fieldError} role="alert">{err}</div> : null}
          </div>
        );
      })}
      {secs.length < 8 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-bold text-[#6B7280] mr-1">Add a section:</span>
          {OVERVIEW_PRESETS.filter((t) => !secs.some((s) => s.title === t)).map((t) => (
            <button key={t} type="button" className={ghostBtn} onClick={() => add(t)}>
              <Plus className="h-3 w-3" /> {t}
            </button>
          ))}
          <button type="button" className={ghostBtn} onClick={() => add('')}>
            <Plus className="h-3 w-3" /> Custom…
          </button>
        </div>
      ) : (
        <div className={hint}>Up to 8 overview sections.</div>
      )}
      <div className={hint}>Areas of expertise and content platforms are edited in Expertise &amp; Topics.</div>
    </div>
  );
}

/* ── Contact & Reach — the creator chooses which contact methods to show ──── */
type StdContactKey = 'email' | 'phone' | 'responseTime' | 'preferredContact';
const STD_CONTACTS: Array<{ key: StdContactKey; label: string; placeholder: string; type?: string; inputMode?: 'email' | 'tel'; hint?: string }> = [
  { key: 'email', label: 'Business email', placeholder: 'you@example.com', type: 'email', inputMode: 'email' },
  { key: 'phone', label: 'Phone', placeholder: '+8801…', type: 'tel', inputMode: 'tel' },
  { key: 'responseTime', label: 'Response time', placeholder: 'e.g. Within 24 hours', hint: 'Your own estimate, shown exactly as you write it.' },
  { key: 'preferredContact', label: 'Preferred contact', placeholder: 'e.g. Email' },
];
const CUSTOM_CONTACT_PRESETS: Array<{ label: string; placeholder: string }> = [
  { label: 'WhatsApp', placeholder: '+8801… or https://wa.me/…' },
  { label: 'Website', placeholder: 'https://…' },
  { label: 'Telegram', placeholder: '@username or https://t.me/…' },
  { label: 'Messenger', placeholder: 'https://m.me/…' },
];

function ContactEditor({
  d,
  patchDraft,
  errors,
}: {
  d: CreatorEditorModel;
  patchDraft: (p: Partial<CreatorEditorModel>) => void;
  errors: CreatorFieldErrors;
}) {
  // Standard methods are shown when they hold a value or the creator just added them.
  const [added, setAdded] = useState<Set<StdContactKey>>(() => new Set());
  const shown = STD_CONTACTS.filter((m) => (d[m.key] || '').trim() || added.has(m.key));
  const available = STD_CONTACTS.filter((m) => !shown.includes(m));
  const custom = d.customContacts ?? [];
  const removeStd = (k: StdContactKey) => {
    setAdded((s) => { const n = new Set(s); n.delete(k); return n; });
    patchDraft({ [k]: '' } as Partial<CreatorEditorModel>);
  };
  const updCustom = (i: number, p: Partial<{ label: string; value: string }>) =>
    patchDraft({ customContacts: custom.map((c, idx) => (idx === i ? { ...c, ...p } : c)) });
  const onAdd = (v: string) => {
    if (!v) return;
    if (v.startsWith('std:')) {
      const k = v.slice(4) as StdContactKey;
      setAdded((s) => new Set(s).add(k));
    } else if (custom.length < 8) {
      patchDraft({ customContacts: [...custom, { label: v === 'custom' ? '' : v.slice(7), value: '' }] });
    }
  };
  const rowCount = shown.length + custom.length;
  return (
    <div className="space-y-3" data-testid="creator-contact-editor">
      {rowCount === 0 ? (
        <p className="text-[11.5px] text-[#9AA0AC] m-0">No contact methods yet — add the ones you want brands to use.</p>
      ) : null}
      {shown.map((m) => {
        const err = errors[m.key];
        const id = `creator-contact-${m.key === 'responseTime' ? 'response' : m.key === 'preferredContact' ? 'preferred' : m.key}`;
        return (
          <div key={m.key}>
            <label className={label} htmlFor={id}>{m.label}</label>
            <div className="flex items-center gap-1.5">
              <input
                id={id}
                type={m.type || 'text'}
                inputMode={m.inputMode}
                className={`${input} ${err ? inputInvalid : ''}`}
                value={d[m.key]}
                placeholder={m.placeholder}
                aria-invalid={err ? true : undefined}
                onChange={(e) => patchDraft({ [m.key]: e.target.value } as Partial<CreatorEditorModel>)}
              />
              <button type="button" className={`${ghostBtn} text-[#DC2626]`} aria-label={`Remove ${m.label}`} onClick={() => removeStd(m.key)}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {err ? <div className={fieldError} role="alert">{err}</div> : m.hint ? <div className={hint}>{m.hint}</div> : null}
          </div>
        );
      })}
      {custom.map((c, i) => {
        const err = errors[`contact.${i}`];
        const preset = CUSTOM_CONTACT_PRESETS.find((p) => p.label === c.label);
        return (
          <div key={`c-${i}`}>
            <div className="flex items-center gap-1.5">
              <input
                className={`${input} max-w-[150px]`}
                value={c.label}
                placeholder="Name (e.g. WhatsApp)"
                aria-label={`Contact method ${i + 1} name`}
                maxLength={40}
                onChange={(e) => updCustom(i, { label: e.target.value })}
              />
              <input
                className={`${input} ${err ? inputInvalid : ''}`}
                value={c.value}
                placeholder={preset?.placeholder || 'Number, handle or https:// link'}
                aria-label={`Contact method ${i + 1} details`}
                aria-invalid={err ? true : undefined}
                maxLength={200}
                onChange={(e) => updCustom(i, { value: e.target.value })}
              />
              <button
                type="button"
                className={`${ghostBtn} text-[#DC2626]`}
                aria-label={`Remove contact method ${i + 1}`}
                onClick={() => patchDraft({ customContacts: custom.filter((_, idx) => idx !== i) })}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {err ? <div className={fieldError} role="alert">{err}</div> : null}
          </div>
        );
      })}
      <div>
        <select
          className={`${input} max-w-[260px] cursor-pointer`}
          value=""
          aria-label="Add a contact method"
          onChange={(e) => onAdd(e.target.value)}
        >
          <option value="">+ Add a contact method…</option>
          {available.map((m) => (
            <option key={m.key} value={`std:${m.key}`}>{m.label}</option>
          ))}
          {custom.length < 8
            ? CUSTOM_CONTACT_PRESETS.filter((p) => !custom.some((c) => c.label === p.label)).map((p) => (
                <option key={p.label} value={`preset:${p.label}`}>{p.label}</option>
              ))
            : null}
          {custom.length < 8 ? <option value="custom">Other (your own label)…</option> : null}
        </select>
        <div className={hint}>Only the methods you add are shown on your profile. Remove one to hide it.</div>
      </div>
    </div>
  );
}

/* ── Brand partners — tag a Choosify brand OR add a custom one with a logo ── */
function BrandPartnersEditor({
  items,
  onChange,
  brands,
  onToast,
}: {
  items: CreatorBrandPartner[];
  onChange: (v: CreatorBrandPartner[]) => void;
  brands: CatalogBrand[];
  onToast: (m: string) => void;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const taggedIds = new Set(items.map((b) => b.brandId).filter(Boolean));
  const results = query
    ? brands
        .filter((b) => !taggedIds.has(b.id) && (b.name || '').toLowerCase().includes(query))
        .slice(0, 8)
    : [];
  const upd = (i: number, p: Partial<CreatorBrandPartner>) =>
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-2">
      {items.length ? (
        <ol className="space-y-1.5">
          {items.map((b, i) => (
            <li key={b.brandId || `${b.name}-${i}`} className="rounded-lg border border-[#E8EDF2] bg-white p-2.5">
              <div className="flex items-center gap-2">
                {(b.logo || (b.brandId && brands.find((x) => x.id === b.brandId)?.logo)) ? (
                  <img
                    src={b.logo || brands.find((x) => x.id === b.brandId)?.logo}
                    alt=""
                    className="w-7 h-7 rounded object-cover border border-[#E8EDF2] shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <input
                  className={`${input} flex-1`}
                  value={b.name}
                  placeholder="Brand name"
                  onChange={(e) => upd(i, { name: e.target.value })}
                  disabled={!!b.brandId}
                />
                {b.brandId ? (
                  <span className="text-[9px] font-bold text-[#059669] uppercase shrink-0">Choosify brand</span>
                ) : null}
                <button
                  type="button"
                  className={`${ghostBtn} text-[#DC2626]`}
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {!b.brandId ? (
                <div className="mt-1.5">
                  <div className={hint}>Logo (optional)</div>
                  <ThumbField value={b.logo || ''} onChange={(logo) => upd(i, { logo })} onToast={onToast} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] italic text-[#9AA0AC]">No brand partners yet.</p>
      )}
      <div className="relative">
        <input
          className={input}
          value={q}
          placeholder={brands.length ? 'Search Choosify brands to tag…' : 'No brands available'}
          disabled={!brands.length}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
            {results.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  onChange([...items, { name: b.name, brandId: b.id, logo: b.logo || undefined }]);
                  setQ('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                {b.logo ? <img src={b.logo} alt="" className="w-5 h-5 rounded object-cover" referrerPolicy="no-referrer" /> : null}
                <span className="min-w-0 truncate font-semibold text-[#1A1A2E]">{b.name}</span>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-[#EF3C23]">Tag</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
        onClick={() => onChange([...items, { name: '' }])}
      >
        <Plus className="h-3.5 w-3.5" /> Add a custom brand
      </button>
    </div>
  );
}

/* ── Featured Content — tag own Guides + add external links w/ thumbnail ── */
function FeaturedContentEditor({
  items,
  onChange,
  ownGuides,
  onToast,
}: {
  items: CreatorFeaturedItem[];
  onChange: (v: CreatorFeaturedItem[]) => void;
  ownGuides: Array<{ id: string; slug?: string; title: string; image?: string }>;
  onToast: (m: string) => void;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const usedIds = new Set(items.map((f) => f.contentId).filter(Boolean));
  const results = query
    ? ownGuides.filter((g) => !usedIds.has(g.id) && (g.title || '').toLowerCase().includes(query)).slice(0, 8)
    : [];
  const upd = (i: number, p: Partial<CreatorFeaturedItem>) =>
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-2">
      {items.length ? (
        <ol className="space-y-2">
          {items.map((f, i) => (
            <li key={f.id} className="rounded-lg border border-[#E8EDF2] bg-white p-2.5 flex gap-2.5">
              <div className="w-16 h-12 rounded-md overflow-hidden bg-[#F4F7F9] border border-[#E8EDF2] shrink-0">
                {f.thumbnail ? <img src={f.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[8px] font-extrabold uppercase rounded px-1 py-0.5 ${
                      f.source === 'platform' ? 'bg-[#E0F2FE] text-[#0369A1]' : 'bg-[#F3F4F6] text-[#6B7280]'
                    }`}
                  >
                    {f.source === 'platform' ? 'Choosify guide' : 'External'}
                  </span>
                  <button type="button" className={ghostBtn} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" className={ghostBtn} onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
                  <button type="button" className={`${ghostBtn} text-[#DC2626] ml-auto`} onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <input
                  className={`${input} !h-8`}
                  value={f.title}
                  placeholder="Title"
                  onChange={(e) => upd(i, { title: e.target.value })}
                />
                {f.source === 'external' ? (
                  <>
                    <input
                      className={`${input} !h-8`}
                      value={f.url}
                      placeholder="https:// link"
                      onChange={(e) => upd(i, { url: e.target.value })}
                    />
                    <div>
                      <div className={hint}>Custom thumbnail</div>
                      <ThumbField value={f.thumbnail} onChange={(thumbnail) => upd(i, { thumbnail })} onToast={onToast} />
                    </div>
                  </>
                ) : (
                  <div className={hint}>Links to {f.url}</div>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] italic text-[#9AA0AC]">
          Nothing featured yet — the profile falls back to your newest videos, reels and guides.
        </p>
      )}

      <div className="relative">
        <input
          className={input}
          value={q}
          placeholder={ownGuides.length ? 'Search your Choosify guides to feature…' : 'You have no guides to feature yet'}
          disabled={!ownGuides.length}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
            {results.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  onChange([
                    ...items,
                    {
                      id: `cfc-${Date.now()}`,
                      source: 'platform',
                      kind: 'guide',
                      contentId: g.id,
                      title: g.title,
                      thumbnail: g.image || '',
                      url: `/spotlight/${g.slug || g.id}`,
                    },
                  ]);
                  setQ('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                {g.image ? <img src={g.image} alt="" className="w-8 h-6 rounded object-cover" referrerPolicy="no-referrer" /> : null}
                <span className="min-w-0 truncate font-semibold text-[#1A1A2E]">{g.title}</span>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-[#EF3C23]">Feature</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
        onClick={() =>
          onChange([
            ...items,
            { id: `cfc-${Date.now()}`, source: 'external', kind: 'link', title: '', thumbnail: '', url: '' },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" /> Add an external item
      </button>
    </div>
  );
}

export default function CreatorEditStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isCreatorRole = profile?.role === 'creator';
  const isStaff =
    profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'moderator';
  const isNew = !id || id === 'new';

  const [model, setModel] = useState<CreatorEditorModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 'not_found' / 'failed': no editable model exists, so a blank fallback can
  // never be saved over (or duplicate) a real creator profile.
  const [loadFailure, setLoadFailure] = useState<'not_found' | 'failed' | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  // Canonical public handle (authoritative handle store); the URL falls back to slug.
  const [publicHandle, setPublicHandle] = useState<string | null>(null);
  // Persistent result of a lifecycle action the server did not apply (e.g. publish held).
  const [lifecycleNotice, setLifecycleNotice] = useState<string | null>(null);
  // Phase C — server version this tab loaded (sent as the save precondition) and
  // whether the last save was refused because the profile changed elsewhere.
  const versionRef = useRef<string | undefined>(undefined);
  const [conflict, setConflict] = useState(false);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [ownGuides, setOwnGuides] = useState<
    Array<{ id: string; slug?: string; title: string; image?: string; creatorId?: string; status?: string }>
  >([]);

  const [editingId, setEditingId] = useState<CreatorEditSection | null>(null);
  const [draft, setDraft] = useState<CreatorEditorModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pendingLifecycle, setPendingLifecycle] = useState<'publish' | 'unpublish' | 'archive' | null>(null);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3400);
  }, []);

  const activeId = model?.id && model.id !== 'new' ? model.id : '';
  // Snapshot / version history only. We deliberately ignore the hook's backend
  // draft-hydration path — the canonical Creator API is the sole source of truth.
  // Snapshots are still recorded after every saved section (server-side history); the header no
  // longer shows a Snapshots button.
  const { saveVersion } = useEntityDraft<CreatorEditorModel>(
    'creator',
    activeId,
    {
      draftKey: `creator_studio_cache_${activeId || 'new'}`,
      versionsKey: `creator_studio_versions_${activeId || 'new'}`,
    },
    () => {},
  );
  // Snapshot dedupe — never record an identical consecutive version.
  const lastSnapshotJson = useRef<string>('');

  // ── load — canonical API only (no operational localStorage) ─────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setLoadFailure(null);
      if (isNew) {
        // Creators own exactly one profile — resolve (or auto-create the draft)
        // via ensureCreatorWorkspace and edit that instead of a throwaway canvas.
        if (isCreatorRole) {
          try {
            const { creators } = await catalogApi.ensureCreatorWorkspace({
              displayName: profile?.displayName || undefined,
              email: profile?.email || undefined,
            });
            const own = creators[0];
            if (own && !cancelled) {
              versionRef.current = own.updatedAt;
              setModel(mapCatalogCreatorToEditor(own));
              navigate(`/admin/creator-studio/${own.id}/edit`, { replace: true });
              setLoading(false);
              return;
            }
          } catch (e) {
            // A creator owns exactly one profile: a blank canvas here could create
            // a second one on save. Stop and let them retry instead.
            if (!cancelled) {
              setModel(null);
              setLoadFailure('failed');
              setLoadError(
                `Your creator profile could not be loaded${e instanceof Error && e.message ? ` (${e.message})` : ''}. Nothing was changed — try again.`,
              );
              setLoading(false);
            }
            return;
          }
          if (!cancelled) {
            setModel(null);
            setLoadFailure('not_found');
            setLoadError('No creator profile was found for your account.');
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setModel(createBlankCreatorModel('new'));
          setLoading(false);
        }
        return;
      }

      try {
        let creator = null as Awaited<ReturnType<typeof catalogApi.listCreators>>[number] | null;
        if (isCreatorRole) {
          const { creators } = await catalogApi.ensureCreatorWorkspace();
          creator = creators.find((c) => c.id === id || c.slug === id) || creators[0] || null;
        } else {
          const creators = await catalogApi.listCreators();
          creator = creators.find((c) => c.id === id || c.slug === id) || null;
        }
        if (cancelled) return;
        if (!creator) {
          setModel(null);
          setLoadFailure('not_found');
          setLoadError(`Creator "${id}" was not found or you don’t have access.`);
        } else {
          versionRef.current = creator.updatedAt;
          setConflict(false);
          setModel(mapCatalogCreatorToEditor(creator));
          setPublicHandle((creator as { publicHandle?: string | null }).publicHandle ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          // Never substitute a blank model with the real id — saving it would
          // overwrite the existing profile with empty fields.
          setModel(null);
          setLoadFailure('failed');
          setLoadError(
            `This creator profile could not be loaded${e instanceof Error && e.message ? ` (${e.message})` : ''}. Nothing was changed — try again.`,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, isCreatorRole, reloadNonce]);

  // The active handle from the owner endpoint (covers loads that came through the
  // workspace, which does not carry publicHandle). Best effort: slug fallback.
  const handleEntityId = model?.id && model.id !== 'new' ? model.id : '';
  useEffect(() => {
    if (!handleEntityId) return;
    let cancelled = false;
    publicHandlesOwnerApi
      .getState('creator', handleEntityId)
      .then((s) => { if (!cancelled) setPublicHandle(s.activeHandle?.handle ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [handleEntityId]);

  // Reference data for the Partnerships brand-tag picker + Featured guide picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [brs, guides] = await Promise.all([
        catalogApi.listBrands().catch(() => [] as CatalogBrand[]),
        catalogApi
          .manageGuides({ status: 'all' })
          .then((r) => r.data || [])
          .catch(() => []),
      ]);
      if (cancelled) return;
      setBrands(brs);
      setOwnGuides(
        guides.map((g) => ({
          id: g.id,
          slug: g.slug,
          title: g.title || 'Untitled guide',
          image: g.image,
          creatorId: (g as { creatorId?: string }).creatorId,
          status: (g as { status?: string }).status,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => !!draft && !!model && JSON.stringify(draft) !== JSON.stringify(model),
    [draft, model],
  );
  const { confirmLeave, dialog: leaveDialog } = useUnsavedChangesGuard(dirty);

  const requestEdit = (k: CreatorEditSection) => {
    if (!model) return;
    if (dirty && editingId && editingId !== k) {
      flash('Save or cancel the current section first.');
      return;
    }
    setEditingId(k);
    setDraft({ ...model });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };
  const patchDraft = (p: Partial<CreatorEditorModel>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const snapshotAfterSave = async (saved: CreatorEditorModel, section: string) => {
    const json = JSON.stringify(editorModelToCreatorPayload(saved));
    if (json === lastSnapshotJson.current) return;
    lastSnapshotJson.current = json;
    try {
      await saveVersion(`${section} · ${new Date().toLocaleString()}`, saved);
    } catch {
      /* snapshot history is best-effort; the canonical save already succeeded */
    }
  };

  const sectionErrors = useMemo(() => creatorSectionErrors(editingId, draft), [editingId, draft]);
  const sectionErrorCount = Object.keys(sectionErrors).length;

  const saveSection = async () => {
    if (!draft) return;
    if (sectionErrorCount) {
      flash('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    try {
      if (isNew || draft.id === 'new') {
        // Staff creating a fresh creator row.
        const newId = `creator-${Date.now()}`;
        const created = await catalogApi.upsertCreator(newId, {
          ...editorModelToCreatorPayload(draft),
          id: newId,
          slug: draft.slug || newId,
        });
        const m = mapCatalogCreatorToEditor(created);
        versionRef.current = created.updatedAt;
        setModel(m);
        setEditingId(null);
        setDraft(null);
        void snapshotAfterSave(m, SECTION_LABEL[editingId ?? 'identity']);
        navigate(`/admin/creator-studio/${created.id}/edit`, { replace: true });
        flash('Creator profile created (draft)');
        return;
      }
      // Phase C: send only the fields this section changed, guarded by the version
      // this tab loaded — a stale copy is refused (409) instead of overwriting.
      const patch = changedFields(editorModelToCreatorSectionPatch(draft), editorModelToCreatorSectionPatch(model!));
      if (!Object.keys(patch).length) {
        setEditingId(null);
        setDraft(null);
        flash('No changes to save');
        return;
      }
      const saved = await catalogApi.patchCreator(model!.id, patch, { expectedUpdatedAt: versionRef.current });
      const m = mapCatalogCreatorToEditor(saved);
      versionRef.current = saved.updatedAt;
      setConflict(false);
      setModel(m);
      setEditingId(null);
      setDraft(null);
      void snapshotAfterSave(m, SECTION_LABEL[editingId ?? 'identity']);
      flash('Section saved');
    } catch (e) {
      if (isStaleWriteError(e)) {
        // Keep the editor and the creator's edits; recovery is an explicit choice.
        setConflict(true);
        flash('Not saved — this profile was changed somewhere else.');
      } else {
        flash(e instanceof Error ? e.message : 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const runLifecycle = async (action: 'publish' | 'unpublish' | 'archive') => {
    if (!model || isNew || model.id === 'new') {
      flash('Save the profile first.');
      return;
    }
    setBusy(true);
    try {
      const status = action === 'publish' ? 'live' : action === 'archive' ? 'archived' : 'draft';
      const saved = await catalogApi.setCreatorPublishStatus(model.id, status);
      const m = mapCatalogCreatorToEditor(saved);
      versionRef.current = saved.updatedAt;
      setModel(m);
      const expected = status === 'live' ? 'LIVE' : status === 'archived' ? 'ARCHIVED' : 'DRAFT';
      if (m.status !== expected) {
        // The server keeps the status when the account has no Marketplace Access
        // (a pending creator cannot self-publish) — never report a false success.
        setLifecycleNotice(
          action === 'publish'
            ? 'Your profile was not published: Choosify has not enabled Marketplace Access for this account yet, so only Choosify can make the profile live. Your edits are saved — contact Choosify support if you are waiting for access.'
            : `The status was not changed (still ${m.status.toLowerCase()}).`,
        );
        flash(action === 'publish' ? 'Not published — Marketplace Access is pending' : 'Status not changed');
      } else {
        setLifecycleNotice(null);
        flash(
          action === 'publish'
            ? 'Creator profile published'
            : action === 'archive'
              ? 'Creator profile archived'
              : 'Creator profile moved to draft',
        );
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusy(false);
      setShowPublishModal(false);
      setPendingLifecycle(null);
    }
  };

  const showModel = editingId && draft ? draft : model;

  const d = draft;
  function renderEditor(section: CreatorEditSection): React.ReactNode {
    if (!d) return null;
    switch (section) {
      case 'cover':
        return (
          <div>
            <div className={label}>Cover image</div>
            <ImageField
              value={d.coverImage}
              onChange={(coverImage) => patchDraft({ coverImage })}
              onToast={flash}
              aspect="aspect-[16/6]"
              emptyLabel="Upload cover"
            />
            <div className={hint}>Wide banner shown at the top of your public profile. JPG, PNG, WEBP or GIF.</div>
          </div>
        );
      case 'avatar':
        return (
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-[140px] max-w-full">
              <div className={label}>Profile photo</div>
              <ImageField
                value={d.avatar}
                onChange={(avatar) => patchDraft({ avatar })}
                onToast={flash}
                aspect="aspect-square w-[140px] max-w-full"
                roundedFull
                emptyLabel="Upload photo"
                crop={{
                  originalValue: d.avatarOriginal,
                  cropValue: d.avatarCrop,
                  onAdjustMeta: (meta) =>
                    patchDraft(
                      meta ? { avatarOriginal: meta.originalUrl, avatarCrop: meta.crop } : { avatarOriginal: '', avatarCrop: undefined },
                    ),
                }}
              />
            </div>
            <div className={`${hint} sm:mt-6 max-w-sm`}>
              Shown in a circle on your profile, guides and comments. After choosing a photo you can zoom and reposition
              it; use Adjust later to reframe it without uploading again.
            </div>
          </div>
        );
      case 'identity':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <div className={label}>Name</div>
                <input
                  className={`${input} ${sectionErrors.name ? inputInvalid : ''}`}
                  value={d.name}
                  placeholder="e.g. Rifat Hasan"
                  aria-invalid={sectionErrors.name ? true : undefined}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                />
                {sectionErrors.name ? <div className={fieldError} role="alert">{sectionErrors.name}</div> : null}
              </div>
              <div>
                <div className={label}>Title / role</div>
                <input className={input} value={d.title} placeholder="e.g. Senior Tech Reviewer" onChange={(e) => patchDraft({ title: e.target.value })} />
              </div>
              <div>
                <div className={label}>Location</div>
                <input className={input} value={d.location} placeholder="e.g. Dhaka, Bangladesh" onChange={(e) => patchDraft({ location: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <div className={label}>Best for (headline)</div>
                <input className={input} value={d.bestFor} placeholder="e.g. Phones &amp; Laptops" onChange={(e) => patchDraft({ bestFor: e.target.value })} />
              </div>
            </div>
            <p className="text-[10.5px] text-[#9AA0AC] m-0">
              Bio is edited in the Creator Overview section. Verification, Trust Score and going LIVE are managed by
              Choosify — use the Publish button for lifecycle.
            </p>
            {/* Username of THIS Creator profile (not the login account); requests go through approval, independent of Save. */}
            {activeId ? <PublicIdentitySection key={activeId} entityType="creator" entityId={activeId} slug={model?.slug} /> : null}
          </div>
        );
      case 'overview':
        return <OverviewEditor d={d} patchDraft={patchDraft} errors={sectionErrors} />;
      case 'expertise':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className={label}>Areas of expertise</div>
                <ListEditor
                  items={d.bestForTags}
                  onChange={(bestForTags) =>
                    patchDraft({ bestForTags, bestFor: d.bestFor || bestForTags[0] || '' })
                  }
                  placeholder="e.g. Flagship phones"
                  addLabel="Add topic"
                />
              </div>
              <div>
                <div className={label}>Content platforms</div>
                <ListEditor
                  items={d.platforms}
                  onChange={(platforms) => patchDraft({ platforms })}
                  placeholder="e.g. YouTube"
                  addLabel="Add platform"
                />
              </div>
            </div>
            <div className={hint}>
              Shown as Expertise &amp; Topics and in your Creator Overview.
            </div>
          </div>
        );
      case 'social':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              {CREATOR_SOCIAL_PLATFORM_KEYS.map((k) => {
                const err = sectionErrors[k];
                const id = `creator-social-${k}`;
                return (
                  <div key={k}>
                    <label className={label} htmlFor={id}>{CREATOR_SOCIAL_PLATFORMS[k].label}</label>
                    <input
                      id={id}
                      className={`${input} ${err ? inputInvalid : ''}`}
                      type="url"
                      inputMode="url"
                      value={d.socialLinks[k] || ''}
                      placeholder={`https://${CREATOR_SOCIAL_PLATFORMS[k].hosts[0]}/…`}
                      aria-invalid={err ? true : undefined}
                      onChange={(e) => patchDraft({ socialLinks: { ...d.socialLinks, [k]: e.target.value } })}
                    />
                    {err ? <div className={fieldError} role="alert">{err}</div> : null}
                  </div>
                );
              })}
            </div>
            <div className={hint}>Leave a field empty to remove that link. Only full https:// addresses are accepted.</div>
            <SocialCustomEditor
              items={d.socialLinks.custom ?? []}
              onChange={(custom) => patchDraft({ socialLinks: { ...d.socialLinks, custom } })}
              errors={sectionErrors}
            />
          </div>
        );
      case 'contact':
        return <ContactEditor d={d} patchDraft={patchDraft} errors={sectionErrors} />;
      case 'partnerships':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className={label}>Brand partners</div>
              <BrandPartnersEditor
                items={d.brandPartners}
                onChange={(brandPartners) => patchDraft({ brandPartners })}
                brands={brands}
                onToast={flash}
              />
            </div>
            <div>
              <div className={label}>Collaboration types</div>
              <ListEditor items={d.collabTypes} onChange={(collabTypes) => patchDraft({ collabTypes })} placeholder="e.g. Sponsored review" addLabel="Add type" />
            </div>
          </div>
        );
      case 'featured':
        return (
          <FeaturedContentEditor
            items={d.featuredContent}
            onChange={(featuredContent) => patchDraft({ featuredContent })}
            ownGuides={ownGuides}
            onToast={flash}
          />
        );
      default:
        return null;
    }
  }

  const bridge: CreatorStudioBridge = {
    editingSection: editingId,
    dirty,
    saving,
    saveBlocked: sectionErrorCount > 0,
    onEdit: requestEdit,
    onCancel: cancelEdit,
    onSave: saveSection,
    renderEditor: (s) => renderEditor(s),
    manageGuidesHref: '/admin/guides',
  };

  if (loadFailure && !model) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-3 px-4" role="alert" data-testid="creator-load-failure" data-kind={loadFailure}>
        <span className="text-[13px] font-extrabold text-[#1A1A2E]">
          {loadFailure === 'not_found' ? 'Creator profile not found' : 'Could not load this creator profile'}
        </span>
        <span className="text-[12px] text-[#DC2626] max-w-md text-center">{loadError}</span>
        <div className="flex flex-wrap justify-center gap-2">
          {loadFailure === 'failed' ? (
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="px-3.5 py-2 rounded-lg bg-[#EF3C23] text-white text-[11px] font-extrabold"
            >
              Try again
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate(isCreatorRole ? '/admin/creator-profile' : '/admin/creator-studio')}
            className="px-3.5 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-extrabold bg-white"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (loading || !model) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-3 text-[#9AA0AC]">
        <RotateCw className="w-8 h-8 animate-spin text-[#EF3C23]" />
        <span className="text-xs font-mono">Loading Creator Studio…</span>
        {loadError ? <span className="text-[12px] text-[#DC2626] max-w-md text-center">{loadError}</span> : null}
      </div>
    );
  }

  const canPublish = !isNew && model.id !== 'new';
  // This creator's own Guides (Guide Management rows carry the authoring creatorId).
  const creatorGuides = ownGuides
    .filter((g) => g.creatorId === model.id)
    .map((g) => ({ id: g.id, slug: g.slug, title: g.title, image: g.image, status: g.status }));

  return (
    <div className="aws-page w-full bg-[#F0F8FF] min-h-screen overflow-x-clip">
      <header className="sticky top-[var(--cms-topbar-height,64px)] z-[8] flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EDF2] bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          {/* A creator owns exactly one profile — there is no list to go back to. Staff return to the creators list. */}
          {!isCreatorRole ? (
            <button
              type="button"
              onClick={() => confirmLeave(() => navigate('/admin/creator-studio'))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8EDF2] text-[#374151]"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#EF3C23]">Creator Studio</div>
            <div className="truncate text-[13px] font-extrabold text-[#1A1A2E]">{model.name || 'New Creator'}</div>
          </div>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
              model.status === 'LIVE'
                ? 'bg-emerald-100 text-emerald-700'
                : model.status === 'ARCHIVED'
                  ? 'bg-[#F3F4F6] text-[#6B7280]'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {model.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full" data-testid="creator-header-actions">
          {canPublish && model.status !== 'LIVE' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPendingLifecycle('publish');
                setShowPublishModal(true);
              }}
              className="rounded-lg bg-[#EF3C23] px-3.5 py-2 text-[11px] font-extrabold text-white disabled:opacity-60"
            >
              Publish
            </button>
          ) : null}
          {canPublish && model.status === 'LIVE' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPendingLifecycle('unpublish');
                setShowPublishModal(true);
              }}
              className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[11px] font-extrabold bg-white disabled:opacity-60"
            >
              Unpublish
            </button>
          ) : null}
          {canPublish && model.status !== 'ARCHIVED' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPendingLifecycle('archive');
                setShowPublishModal(true);
              }}
              className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[11px] font-extrabold bg-white disabled:opacity-60"
            >
              Archive
            </button>
          ) : null}
          <span className="hidden lg:inline text-[10px] text-[#9AA0AC]">
            Each section saves on its own
          </span>
        </div>
      </header>

      {loadError ? (
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-4">
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[12px] text-[#B45309]">
            {loadError}
          </div>
        </div>
      ) : null}

      {conflict ? (
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-4">
          <StudioConflictNotice
            what="creator profile"
            onDismiss={() => setConflict(false)}
            onReload={() => {
              setConflict(false);
              setEditingId(null);
              setDraft(null);
              setReloadNonce((n) => n + 1);
            }}
          />
        </div>
      ) : null}

      {lifecycleNotice ? (
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-4">
          <div role="status" data-testid="creator-lifecycle-notice" className="flex items-start justify-between gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[12px] text-[#92400E]">
            <span>{lifecycleNotice}</span>
            <button type="button" onClick={() => setLifecycleNotice(null)} className="shrink-0 text-[11px] font-bold underline" aria-label="Dismiss notice">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {canPublish ? (
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-4">
          <StudioChecklist
            title="Profile readiness"
            testId="creator-readiness"
            defaultOpen={false}
            items={creatorReadiness({
              name: model.name,
              avatar: model.avatar,
              coverImage: model.coverImage,
              bio: model.bio,
              socials: [
                model.socialLinks.facebook, model.socialLinks.instagram, model.socialLinks.youtube,
                model.socialLinks.linkedin, model.socialLinks.tiktok, ...(model.socialLinks.custom || []).map((c) => c.url),
              ].map((v) => v || ''),
              email: model.email,
              phone: model.phone,
              otherContacts: model.customContacts.map((c) => c.value),
              status: model.status,
              username: publicHandle,
              expertiseCount: model.bestForTags.length,
              featuredCount: model.featuredContent.length,
              partnershipCount: model.brandPartners.length + model.collabTypes.length,
            })}
            sectionLabels={SECTION_LABEL}
            onGo={(s) => {
              if (dirty && editingId && editingId !== s) {
                flash('Save or cancel the current section first.');
                return false;
              }
              requestEdit(s as CreatorEditSection);
              return true;
            }}
            intro={
              model.status === 'LIVE'
                ? 'Your profile is public on the Choosify storefront.'
                : isCreatorRole
                  ? 'Your profile is not public yet — only you and Choosify can see it. Publish makes it public once Choosify has enabled Marketplace Access for your account; until then only Choosify can make it live.'
                  : 'This profile is not public. Publish makes it public on the Choosify storefront.'
            }
          />
        </div>
      ) : null}

      <CreatorProfilePresentation
        model={showModel}
        // Always the Studio (Brand Studio pattern): every section's Edit pill is visible at once —
        // no global View/Edit toggle. The public look is one click away via "View public profile".
        mode="studio"
        studio={bridge}
        publicHandle={publicHandle}
        guides={creatorGuides}
      />

      {/* Lifecycle confirmation (Publish / Unpublish / Archive) — shared Studio dialog. */}
      <StudioConfirmDialog
        open={showPublishModal}
        title={
          (pendingLifecycle ?? 'publish') === 'publish'
            ? 'Publish this creator profile?'
            : pendingLifecycle === 'unpublish'
              ? 'Unpublish this creator profile?'
              : 'Archive this creator profile?'
        }
        description={
          (pendingLifecycle ?? 'publish') === 'publish'
            ? `This makes your profile publicly visible on Choosify. Save any in-progress section first.${
                isCreatorRole ? ' If Marketplace Access is still pending, going live may be held until Choosify enables it.' : ''
              }`
            : pendingLifecycle === 'unpublish'
              ? 'Your profile is removed from the storefront and moved to draft. You can publish it again later.'
              : 'Your profile is removed from the storefront and moved to Archived. You can publish it again later.'
        }
        confirmLabel={
          (pendingLifecycle ?? 'publish') === 'publish' ? 'Publish' : pendingLifecycle === 'unpublish' ? 'Unpublish' : 'Archive'
        }
        busyLabel={(pendingLifecycle ?? 'publish') === 'publish' ? 'Publishing…' : 'Working…'}
        tone={pendingLifecycle === 'archive' ? 'danger' : 'primary'}
        busy={busy}
        onCancel={() => {
          setShowPublishModal(false);
          setPendingLifecycle(null);
        }}
        onConfirm={() => void runLifecycle(pendingLifecycle ?? 'publish')}
      />
      {leaveDialog}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[70] rounded-xl bg-[#1A1A2E] px-4 py-3 text-[12px] font-semibold text-white shadow-2xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
