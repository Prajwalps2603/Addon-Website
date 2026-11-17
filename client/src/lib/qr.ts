/** QR codes as SVG, for the UPI payment panel and anything else that should be scannable. */
import qrcode from 'qrcode-generator';

export interface QrOptions {
  /** Error correction. 'M' suits a screen; use 'Q' or 'H' for print. */
  level?: 'L' | 'M' | 'Q' | 'H';
  /** Quiet zone in modules. Scanners expect 4. */
  margin?: number;
}

export interface QrPath {
  /** Side of the square in modules, quiet zone included: use it as the SVG viewBox size. */
  size: number;
  /** Path data covering the dark modules, one unit per module. */
  path: string;
}

/** The library encodes one byte per character, so non-ASCII text is turned into its UTF-8 bytes first. */
function toByteString(text: string): string {
  let out = '';
  for (const byte of new TextEncoder().encode(text)) out += String.fromCharCode(byte);
  return out;
}

/**
 * The code as path data:
 *   const { size, path } = qrPath(upiUri);
 *   <svg viewBox={`0 0 ${size} ${size}`}><path d={path} fill="currentColor" /></svg>
 * Draw it dark on a light background whatever the theme: scanners need that contrast.
 */
export function qrPath(text: string, options: QrOptions = {}): QrPath {
  const margin = options.margin ?? 4;
  const code = qrcode(0, options.level ?? 'M');
  code.addData(toByteString(text), 'Byte');
  code.make();

  const count = code.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row += 1) {
    let col = 0;
    while (col < count) {
      if (!code.isDark(row, col)) {
        col += 1;
        continue;
      }
      let end = col;
      while (end < count && code.isDark(row, end)) end += 1;
      path += `M${col + margin} ${row + margin}h${end - col}v1h-${end - col}z`;
      col = end;
    }
  }
  return { size: count + margin * 2, path };
}

/** A complete SVG document: black modules on a white square. */
export function qrSvg(text: string, options: QrOptions = {}): string {
  const { size, path } = qrPath(text, options);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
  );
}

/** The same SVG as a data URL, for an <img src> or a canvas drawImage. */
export function qrDataUrl(text: string, options: QrOptions = {}): string {
  return `data:image/svg+xml,${encodeURIComponent(qrSvg(text, options))}`;
}
