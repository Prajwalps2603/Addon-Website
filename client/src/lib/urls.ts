/** The absolute address of a client route, for links that leave the site (WhatsApp, link previews). */
export function siteUrl(path = '/'): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** '/login?next=%2Fadmin%2Forders': where a guard sends a visitor who must sign in first. */
export function loginPath(next?: string | null): string {
  const target = safeNextPath(next, '');
  return target ? `/login?next=${encodeURIComponent(target)}` : '/login';
}

/**
 * The `next` value from a URL, accepted only when it is a path on this site.
 * Anything else (another site, '//host', 'javascript:') falls back, so a crafted
 * link cannot send a shopper elsewhere after signing in.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/account'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}
