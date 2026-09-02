import React, { useEffect, useRef, useState } from 'react';
import { X, Search, Loader2, Send } from 'lucide-react';
import { searchDirectoryUsers, type DirectoryUser } from '../../services/messagingApi';
import { Avatar, RoleBadge, type MsgRole } from './MessagingPrimitives';

/**
 * Admin "New Message" contact picker. Search the canonical staff user directory
 * by CFID (exact ranks first) / name / email, pick a user, optionally type a
 * first message, then open (or reuse) that user's Choosify Support thread.
 * Internal DB ids are never shown — CFID + display identity only.
 */
export function NewMessageDialog({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (targetUserId: string, body: string) => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (selected) return;
    const term = q.trim();
    if (debounce.current) clearTimeout(debounce.current);
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const rows = await searchDirectoryUsers(term);
        setResults(rows.filter((r) => r.role !== 'Admin'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, selected]);

  const start = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onStart(selected.id, body.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start conversation');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <span className="text-sm font-black text-app-text-primary">New Message</span>
          <button type="button" onClick={onClose} className="text-app-text-secondary hover:text-app-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!selected ? (
          <div className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 text-app-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by CFID, name or email…"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-app-border bg-transparent text-[12px] text-app-text-primary"
              />
            </div>
            <div className="mt-3 max-h-[320px] overflow-y-auto divide-y divide-app-border/60">
              {searching ? (
                <div className="py-6 flex justify-center text-app-text-secondary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : q.trim().length < 2 ? (
                <p className="text-[11px] text-app-text-secondary py-4 text-center m-0">
                  Type at least 2 characters. Exact CFID match ranks first.
                </p>
              ) : results.length === 0 ? (
                <p className="text-[11px] text-app-text-secondary py-4 text-center m-0">No matching users.</p>
              ) : (
                results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelected(u)}
                    className="w-full flex items-center gap-3 py-2.5 px-1 text-left hover:bg-black/[0.03] transition-colors"
                  >
                    <Avatar name={u.name} src={u.avatarUrl} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold text-app-text-primary truncate">{u.name}</div>
                      <div className="text-[10px] text-app-text-secondary truncate">
                        {u.choosifyUserId || '—'}
                        {u.contextLabel ? ` · ${u.contextLabel}` : ''}
                      </div>
                    </div>
                    <RoleBadge role={u.role as MsgRole} />
                  </button>
                ))
              )}
            </div>
            {error ? <p className="text-[11px] text-red-500 mt-2 m-0">{error}</p> : null}
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-app-bg border border-app-border">
              <Avatar name={selected.name} src={selected.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-app-text-primary truncate">{selected.name}</div>
                <div className="text-[10px] text-app-text-secondary truncate">
                  {selected.choosifyUserId || '—'}
                  {selected.contextLabel ? ` · ${selected.contextLabel}` : ''}
                </div>
              </div>
              <RoleBadge role={selected.role as MsgRole} />
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setBody('');
                }}
                className="text-[10px] font-bold text-app-accent"
              >
                Change
              </button>
            </div>
            <textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write the first message (optional — you can also just open the thread)…"
              className="w-full mt-3 p-3 rounded-xl border border-app-border bg-transparent text-[12px] text-app-text-primary resize-none"
            />
            {error ? <p className="text-[11px] text-red-500 mt-1 m-0">{error}</p> : null}
            <button
              type="button"
              onClick={() => void start()}
              disabled={busy}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-app-accent text-white text-[11px] font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {body.trim() ? 'Send & open' : 'Open conversation'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NewMessageDialog;
