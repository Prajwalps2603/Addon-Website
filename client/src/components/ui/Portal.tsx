import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children at the end of <body>, outside any clipped or transformed ancestor.
 * Overlays use it so they sit above the page and take the page's tokens, not those of the
 * plane they were opened from.
 */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
