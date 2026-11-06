/**
 * Where a hero slide links: a Choosify page, a specific brand / product / creator / guide /
 * category (search and pick — never a typed name), or another website. Produces the same
 * link strings the storefront already understands (/brands/<id>, /categories?category=<slug> …).
 */
import React from 'react';
import { EntityPicker, type PickableType } from '../../../components/ads/EntityPicker';
import { LinkInput, inputCls } from './StudioKit';

type Kind = 'page' | 'brand' | 'product' | 'creator' | 'guide' | 'category' | 'website';

const KINDS: Array<{ key: Kind; label: string }> = [
  { key: 'page', label: 'A Choosify page' },
  { key: 'brand', label: 'A brand' },
  { key: 'product', label: 'A product' },
  { key: 'creator', label: 'A creator' },
  { key: 'guide', label: 'A guide' },
  { key: 'category', label: 'A category' },
  { key: 'website', label: 'Another website' },
];

const PATH: Record<'brand' | 'product' | 'creator' | 'guide', string> = { brand: '/brands/', product: '/products/', creator: '/creators/', guide: '/guides/' };

/** Read an existing link back into "what kind + which one". */
export function parseSlideLink(url: string): { kind: Kind; id: string } {
  const u = (url || '').trim();
  if (!u) return { kind: 'page', id: '' };
  if (/^https?:\/\//i.test(u)) return { kind: 'website', id: '' };
  const cat = u.match(/^\/categories\?category=([^&#]+)/);
  if (cat) return { kind: 'category', id: decodeURIComponent(cat[1]) };
  for (const k of ['brand', 'product', 'creator', 'guide'] as const) {
    if (u.startsWith(PATH[k])) {
      const rest = u.slice(PATH[k].length).split(/[/?#]/)[0];
      if (rest) return { kind: k, id: decodeURIComponent(rest) };
    }
  }
  return { kind: 'page', id: '' };
}

export function SlideLinkPicker({ value, onChange, disabled, testId }: { value: string; onChange: (url: string) => void; disabled: boolean; testId: string }) {
  const parsed = parseSlideLink(value);
  const [kind, setKind] = React.useState<Kind>(parsed.kind);
  React.useEffect(() => {
    setKind(parseSlideLink(value).kind);
    // only when the slide changes from outside (load / cancel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  return (
    <div className="space-y-1.5" data-testid={testId}>
      <select
        className={inputCls}
        value={kind}
        disabled={disabled}
        data-testid={`${testId}-kind`}
        onChange={(e) => {
          const k = e.target.value as Kind;
          setKind(k);
          if (k !== parsed.kind) onChange('');
        }}
      >
        {KINDS.map((k) => (
          <option key={k.key} value={k.key}>
            {k.label}
          </option>
        ))}
      </select>
      {kind === 'page' ? (
        <LinkInput value={value} onChange={onChange} disabled={disabled} testId={`${testId}-page`} placeholder="Start typing: /deals, /brands, /pages/…" />
      ) : kind === 'website' ? (
        <input className={inputCls} value={value} disabled={disabled} placeholder="https://example.com/offer" maxLength={500} data-testid={`${testId}-url`} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <EntityPicker
          type={kind as PickableType}
          value={parsed.kind === kind ? parsed.id : ''}
          onPick={(e) => {
            if (!e) return onChange('');
            if (kind === 'category') onChange(`/categories?category=${encodeURIComponent(e.slug || e.id)}`);
            else onChange(`${PATH[kind as 'brand' | 'product' | 'creator' | 'guide']}${encodeURIComponent(e.id)}`);
          }}
        />
      )}
      {value ? (
        <div className="truncate text-[10.5px] text-slate-500" title={value}>
          Goes to: <span className="font-semibold text-slate-700">{value}</span>
          {/^https?:\/\//i.test(value) ? ' (opens in a new tab)' : ''}
        </div>
      ) : (
        <div className="text-[10.5px] text-slate-500">No link — the slide is a picture only.</div>
      )}
    </div>
  );
}
