/**
 * Photo renditions (BUILD_SPEC section 8). Every managed photo is a WebP with one smaller sibling:
 *   /catalog/<kind>/NAME.webp (1200px)  +  NAME-480.webp
 *   /uploads/NAME.webp        (1200px)  +  NAME-480.webp
 *   /editorial/NAME.webp      (1920px)  +  NAME-960.webp
 * Anything else (an outside URL, a data URL, a non-WebP file) is passed through untouched.
 */

interface ManagedImage {
  full: string;
  small: string;
  fullWidth: number;
  smallWidth: number;
}

const MANAGED = /^((?:https?:\/\/[^/]+)?\/(catalog|editorial|uploads)\/.+?)(?:-(?:480|960))?\.webp(\?.*)?$/i;

function manage(url: string): ManagedImage | null {
  const match = MANAGED.exec(url);
  if (!match) return null;
  const [, stem, folder, query = ''] = match;
  const editorial = folder?.toLowerCase() === 'editorial';
  const smallWidth = editorial ? 960 : 480;
  return {
    full: `${stem}.webp${query}`,
    small: `${stem}-${smallWidth}.webp${query}`,
    fullWidth: editorial ? 1920 : 1200,
    smallWidth,
  };
}

/**
 * The rendition to load when the image is drawn about `width` pixels wide:
 * imageVariant(url, 480) is the card thumbnail, imageVariant(url, 1200) the full photo.
 * Returns '' for a missing URL so it can go straight into `src` checks.
 */
export function imageVariant(url: string | null | undefined, width: number): string {
  if (!url) return '';
  const image = manage(url);
  if (!image) return url;
  return width <= image.smallWidth ? image.small : image.full;
}

/** 'NAME-480.webp 480w, NAME.webp 1200w' for `srcSet`, or undefined when the image has no renditions. */
export function imageSrcSet(url: string | null | undefined): string | undefined {
  const image = url ? manage(url) : null;
  if (!image) return undefined;
  return `${image.small} ${image.smallWidth}w, ${image.full} ${image.fullWidth}w`;
}

/**
 * `src`, `srcSet` and `sizes` to spread on an <img>. `sizes` is the usual CSS sizes value,
 * for example '(min-width: 768px) 25vw, 50vw' for a product grid.
 */
export function imageSources(
  url: string | null | undefined,
  sizes: string,
): { src: string; srcSet: string | undefined; sizes: string | undefined } {
  const srcSet = imageSrcSet(url);
  return { src: imageVariant(url, Number.POSITIVE_INFINITY), srcSet, sizes: srcSet ? sizes : undefined };
}
