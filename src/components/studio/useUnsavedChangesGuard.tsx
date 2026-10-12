import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudioConfirmDialog } from './StudioConfirmDialog';
import { guardedInAppPath } from './unsavedChangesLogic';

/**
 * Unsaved-changes guard shared by the Product, Guide, Brand and Creator Studios.
 *
 * While `dirty`:
 *  - registers `beforeunload` (reload, closing the tab, leaving the site);
 *  - intercepts plain clicks on in-app links anywhere in the document
 *    (sidebar, top bar, `<Link>`s) and asks before following them;
 *  - `confirmLeave(action)` asks before a Studio's own Back / Cancel / View
 *    actions run.
 * When not dirty, nothing is registered and `confirmLeave` runs immediately.
 *
 * Not covered (Phase A limitation): the browser's own Back / Forward buttons —
 * blocking those needs a React Router data router, which this app does not use.
 *
 * Render the returned `dialog` once in the Studio.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<null | (() => void)>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      // Links inside a Studio confirmation dialog are never intercepted.
      if (anchor.closest('[data-studio-confirm-overlay]')) return;
      const path = guardedInAppPath(
        {
          button: e.button,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          defaultPrevented: e.defaultPrevented,
          target: anchor.getAttribute('target') || '',
          hasDownload: anchor.hasAttribute('download'),
          href: anchor.href,
        },
        window.location,
      );
      if (!path) return;
      // Capture phase on document: runs before React Router's <Link> handler.
      e.preventDefault();
      e.stopPropagation();
      setPending(() => () => navigate(path));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty, navigate]);

  // Saved or cancelled while the dialog was open: nothing is lost any more.
  useEffect(() => {
    if (!dirty) setPending(null);
  }, [dirty]);

  const confirmLeave = useCallback((action: () => void) => {
    if (!dirtyRef.current) {
      action();
      return;
    }
    setPending(() => action);
  }, []);

  const dialog = (
    <StudioConfirmDialog
      open={pending !== null}
      title="Discard unsaved changes?"
      description="You have changes in this section that haven't been saved. If you leave now they will be lost."
      cancelLabel="Keep editing"
      confirmLabel="Discard changes"
      tone="danger"
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const action = pending;
        setPending(null);
        action?.();
      }}
    />
  );

  return { confirmLeave, dialog };
}
