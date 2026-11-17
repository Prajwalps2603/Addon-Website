/**
 * Page titles and meta tags. Every page calls useDocumentMeta once.
 * (Link previews for crawlers are injected by the server; this keeps the tab, history
 * and share sheet right while the shopper moves around the app.)
 */
import { useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';

export const SITE_NAME = 'Addon Automotive';

export interface DocumentMeta {
  /** The page's own title, without the store name: 'Cart', or a product name. Leave out for the store name alone. */
  title?: string;
  description?: string;
  /** A photo URL for share previews. Site-relative URLs are made absolute. */
  image?: string | null;
  /** True for pages that must stay out of search results: cart, checkout, account, admin, order pages. */
  noindex?: boolean;
}

type MetaKey = { name: string } | { property: string };

function findMeta(key: MetaKey): HTMLMetaElement | null {
  const selector = 'name' in key ? `meta[name="${key.name}"]` : `meta[property="${key.property}"]`;
  return document.head.querySelector<HTMLMetaElement>(selector);
}

/** Sets a meta tag, creating it when missing. An empty value removes the tag. */
function setMeta(key: MetaKey, content: string): void {
  let tag = findMeta(key);
  if (!content) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('meta');
    if ('name' in key) tag.name = key.name;
    else tag.setAttribute('property', key.property);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/** The store's own photo for share previews, the same one the server uses (lib/seoMeta.js DEFAULT_IMAGE). */
const DEFAULT_IMAGE = '/brand/icon-512.png';

/**
 * What a page with no description or photo of its own shows. Fixed values, never read from the head:
 * the server fills the first page's head with that page's tags (a product's photo and price), and
 * those must not follow the shopper to the next page.
 */
function siteDefaults(tagline: string): { description: string; image: string } {
  const lead = tagline.trim() ? `${tagline.trim()} ` : '';
  return {
    description: `${lead}Car accessories and a fitting studio: buy the part and have our team fit it, or get it delivered.`,
    image: absolute(DEFAULT_IMAGE),
  };
}

function absolute(url: string): string {
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

export function useDocumentMeta({ title, description, image, noindex = false }: DocumentMeta): void {
  const settings = useSettings().data;
  const siteName = settings?.storeName || SITE_NAME;
  const tagline = settings?.tagline ?? '';

  useEffect(() => {
    const fallback = siteDefaults(tagline);
    const fullTitle = title ? `${title} | ${siteName}` : siteName;
    const summary = description?.trim() || fallback.description;
    const picture = image ? absolute(image) : fallback.image;

    document.title = fullTitle;
    setMeta({ name: 'description' }, summary);
    setMeta({ property: 'og:title' }, fullTitle);
    setMeta({ property: 'og:description' }, summary);
    setMeta({ property: 'og:image' }, picture);
    setMeta({ property: 'og:url' }, window.location.origin + window.location.pathname);
    setMeta({ name: 'twitter:card' }, picture ? 'summary_large_image' : 'summary');
    setMeta({ name: 'robots' }, noindex ? 'noindex, nofollow' : '');
  }, [title, description, image, noindex, siteName, tagline]);

  // A page that asked to stay unlisted must not leave that behind for the next one.
  useEffect(() => () => setMeta({ name: 'robots' }, ''), []);
}
