import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmModal } from './ConfirmModal';

/**
 * Warns before unsaved changes are lost: the browser's own prompt on reload or close, and a
 * question before any in-app link is followed. (The app uses a declarative router, so links are
 * caught at the document instead of with a router blocker.)
 */
export function useLeaveGuard(dirty: boolean) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const to = url.pathname + url.search + url.hash;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(to);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const modal = (
    <ConfirmModal
      open={pending !== null}
      title="Leave without saving?"
      confirmLabel="Leave and lose changes"
      onClose={() => setPending(null)}
      onConfirm={() => {
        const to = pending;
        setPending(null);
        if (to) void navigate(to);
      }}
    >
      <p>Your changes on this page have not been saved.</p>
    </ConfirmModal>
  );

  return { modal };
}
