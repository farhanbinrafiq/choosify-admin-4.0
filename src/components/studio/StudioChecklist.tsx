import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, Info } from 'lucide-react';
import { readinessSummary, type ReadinessItem } from './readiness';

const ICON: Record<ReadinessItem['state'], { Icon: typeof Circle; color: string; sr: string }> = {
  done: { Icon: CheckCircle2, color: '#16A34A', sr: 'Done' },
  todo: { Icon: Circle, color: '#9AA0AC', sr: 'Recommended' },
  blocker: { Icon: AlertTriangle, color: '#DC2626', sr: 'Needs attention' },
  info: { Icon: Info, color: '#2563EB', sr: 'Note' },
};

/**
 * Readiness / profile-health checklist shared by the Studios. Each Studio
 * decides where it sits; the panel only renders the items it is given.
 */
export function StudioChecklist({
  title,
  items,
  intro,
  footer,
  defaultOpen = true,
  testId,
}: {
  title: string;
  items: ReadinessItem[];
  intro?: React.ReactNode;
  footer?: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const headingId = useId();
  const listId = useId();
  const { done, total, blockers } = readinessSummary(items);
  // Something needs attention → open once (data may arrive after first render);
  // a later collapse by the user is respected.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (blockers > 0 && !autoOpened.current) {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [blockers]);
  const summary = blockers > 0 ? `${blockers} need${blockers === 1 ? 's' : ''} attention · ${done} of ${total} done` : `${done} of ${total} done`;
  return (
    <section
      aria-labelledby={headingId}
      data-testid={testId}
      className="rounded-xl border border-[#E8EDF2] bg-white px-4 py-3"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2323FF] focus-visible:ring-offset-2"
      >
        <span id={headingId} className="text-[11px] font-extrabold uppercase tracking-wider text-[#1A1A2E]">
          {title}
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-[10.5px] font-bold ${blockers > 0 ? 'text-[#DC2626]' : 'text-[#6B7280]'}`} data-testid={testId ? `${testId}-summary` : undefined}>
            {summary}
          </span>
          <ChevronDown aria-hidden="true" className={`h-4 w-4 text-[#9AA0AC] transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <div id={listId} hidden={!open}>
        {intro ? <div className="mt-2 text-[11px] leading-relaxed text-[#4B5563]">{intro}</div> : null}
        <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
          {items.map((item) => {
            const { Icon, color, sr } = ICON[item.state];
            return (
              <li key={item.id} data-item={item.id} data-state={item.state} className="flex items-start gap-2 text-[11.5px]">
                <Icon aria-hidden="true" className="mt-[1px] h-3.5 w-3.5 shrink-0" style={{ color }} />
                <span>
                  <span className="sr-only">{sr}: </span>
                  <span className={`font-semibold ${item.state === 'done' ? 'text-[#374151]' : 'text-[#1A1A2E]'}`}>{item.label}</span>
                  {item.detail ? <span className="block text-[10.5px] text-[#6B7280]">{item.detail}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
        {footer ? <div className="mt-2 text-[10.5px] leading-relaxed text-[#6B7280]">{footer}</div> : null}
      </div>
    </section>
  );
}
