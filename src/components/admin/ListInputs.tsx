import React, { useEffect, useRef, useState } from 'react';

/**
 * A <textarea> for "one item per line" fields. Parent models store the parsed
 * list, so feeding the re-joined list straight back as `value` would drop the
 * new line an Enter just made. This keeps the seller's raw text while the box
 * is focused and re-syncs from the model only when it isn't.
 */
export function LinesTextarea({
  value,
  onChange,
  onBlur,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (raw: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [raw, setRaw] = useState(value);
  useEffect(() => {
    if (typeof document === 'undefined' || ref.current !== document.activeElement) setRaw(value);
  }, [value]);
  return (
    <textarea
      {...rest}
      ref={ref}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(e.target.value);
      }}
      onBlur={(e) => {
        setRaw(value);
        onBlur?.(e);
      }}
    />
  );
}

/**
 * Pill input: type a word or phrase and press Enter (or comma) to add it as a
 * pill; × removes a pill; clicking a pill puts it back in the box to edit.
 * Pasting several lines adds one pill per line. Text still in the box when it
 * loses focus is added too, so Save never drops it.
 */
export function TagPillInput({
  values,
  onChange,
  placeholder,
  prefix = '',
  stripHash = false,
  maxLength = 80,
  className,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Shown before each pill (e.g. "#"). */
  prefix?: string;
  /** Drop leading "#" characters from typed tags. */
  stripHash?: boolean;
  maxLength?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const clean = (s: string) => {
    let v = s.replace(/\s+/g, ' ').trim();
    if (stripHash) v = v.replace(/^#+/, '').trim();
    return v.slice(0, maxLength);
  };
  const add = (items: string[]) => {
    const next = [...values];
    for (const item of items.map(clean).filter(Boolean)) {
      if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item);
    }
    if (next.length !== values.length) onChange(next);
  };
  const commitDraft = () => {
    if (draft.trim()) add([draft]);
    setDraft('');
  };

  return (
    <div
      className={className}
      onClick={() => inputRef.current?.focus()}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 44, cursor: 'text', padding: 6 }}
    >
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFF1E8', color: '#9A3412', borderRadius: 999, padding: '4px 6px 4px 10px', fontSize: 12, fontWeight: 600 }}
        >
          <button
            type="button"
            title="Click to edit"
            onClick={(e) => {
              e.stopPropagation();
              commitDraft();
              onChange(values.filter((_, j) => j !== i));
              setDraft(v);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
          >
            {prefix}
            {v}
          </button>
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(values.filter((_, j) => j !== i));
            }}
            style={{ background: 'none', border: 0, padding: '0 2px', color: '#9A3412', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        maxLength={maxLength}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) {
            const parts = v.split(',');
            setDraft(parts.pop() ?? '');
            add(parts);
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitDraft();
          } else if (e.key === 'Backspace' && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (/[\n,]/.test(text)) {
            e.preventDefault();
            add(text.split(/[\n,]/));
          }
        }}
        onBlur={commitDraft}
        placeholder={values.length ? 'Add another…' : placeholder}
        style={{ flex: '1 1 160px', minWidth: 120, border: 0, outline: 'none', fontSize: 13, padding: '6px 4px', background: 'transparent' }}
      />
    </div>
  );
}
