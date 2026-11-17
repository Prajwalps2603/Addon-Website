/**
 * "Download poster": the stage drawing, the build's name, its parts and total on a 1080 x 1350 PNG
 * (the 4:5 portrait that Instagram and WhatsApp status show whole).
 * Colours and the typeface are read from the design tokens at run time, never written in here.
 */
import { formatINR } from '@/lib/format';

export const POSTER_W = 1080;
export const POSTER_H = 1350;

export interface PosterLine {
  /** The slot: "Wheels". */
  label: string;
  /** The product name, or the style when no product is chosen. */
  value: string;
  price: number | null;
}

export interface PosterData {
  title: string;
  carLine: string;
  lines: PosterLine[];
  total: number;
  storeName: string;
  /** The address of the saved build, when there is one. */
  link?: string;
}

interface Palette {
  ink: string;
  paper: string;
  muted: string;
  line: string;
  brand: string;
  brandInk: string;
}

/** The light-theme tokens, read through a probe so a dark-theme visitor gets the same poster. */
function readPalette(): Palette {
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', 'light');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const css = getComputedStyle(probe);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const palette: Palette = {
    ink: read('--ink', 'black'),
    paper: read('--page', 'white'),
    muted: read('--line-strong', 'gray'),
    line: read('--ink-2', 'dimgray'),
    // The fixed Tread Red, a print mark: it does not follow a plane or the theme.
    brand: read('--red', 'crimson'),
    brandInk: read('--brand-ink', 'white'),
  };
  probe.remove();
  return palette;
}

function fontFamily(): string {
  return getComputedStyle(document.body).fontFamily || 'sans-serif';
}

async function svgToImage(svg: SVGSVGElement, width: number, height: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.removeAttribute('style');
  clone.removeAttribute('class');
  const xml = new XMLSerializer().serializeToString(clone);
  const image = new Image();
  image.decoding = 'async';
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await image.decode();
  return image;
}

/** Breaks text into at most `max` lines that fit `width`, ending the last with an ellipsis when cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= width || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Draws the poster and returns it as a PNG. `stage` is a rendered, static CarStage svg. */
export async function renderPoster(stage: SVGSVGElement, data: PosterData): Promise<Blob> {
  const family = fontFamily();
  const c = readPalette();
  try {
    await Promise.all([
      document.fonts.load(`italic 900 72px ${family}`),
      document.fonts.load(`700 28px ${family}`),
      document.fonts.load(`400 26px ${family}`),
    ]);
  } catch {
    // The system fallback is still a readable poster.
  }

  const car = await svgToImage(stage, 1200, 620);
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the poster.');

  const M = 64;
  const inner = POSTER_W - M * 2;
  ctx.fillStyle = c.ink;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  ctx.textBaseline = 'alphabetic';

  // Masthead: store name, and the Build Bay flag cut at the lean.
  ctx.font = `700 24px ${family}`;
  ctx.fillStyle = c.paper;
  ctx.fillText(fit(ctx, data.storeName.toUpperCase(), inner - 300), M, M + 22);
  ctx.font = `italic 900 26px ${family}`;
  const flag = 'BUILD BAY';
  const flagW = ctx.measureText(flag).width + 44;
  const flagX = POSTER_W - M - flagW;
  const lean = Math.tan((20 * Math.PI) / 180) * 44;
  ctx.fillStyle = c.brand;
  ctx.beginPath();
  ctx.moveTo(flagX, M - 8);
  ctx.lineTo(flagX + flagW, M - 8);
  ctx.lineTo(flagX + flagW - lean, M + 36);
  ctx.lineTo(flagX, M + 36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.brandInk;
  ctx.fillText(flag, flagX + 14, M + 24);

  // Title, up to two lines of heavy italic capitals.
  ctx.font = `italic 900 76px ${family}`;
  ctx.fillStyle = c.paper;
  const titleLines = wrap(ctx, data.title.toUpperCase(), inner, 2);
  let y = M + 130;
  for (const line of titleLines) {
    ctx.fillText(line, M, y);
    y += 80;
  }
  ctx.font = `400 28px ${family}`;
  ctx.fillStyle = c.muted;
  ctx.fillText(fit(ctx, data.carLine, inner), M, y - 22);

  // The car, edge to edge.
  const carTop = y + 4;
  const carH = Math.round((POSTER_W / 1200) * 620);
  ctx.drawImage(car, 0, carTop, POSTER_W, carH);

  // Parts list.
  const totalBandTop = POSTER_H - M - 132;
  let rowY = carTop + carH + 52;
  const rowH = 44;
  const room = Math.max(0, Math.floor((totalBandTop - 24 - rowY) / rowH) + 1);
  const shown = data.lines.length > room ? data.lines.slice(0, Math.max(0, room - 1)) : data.lines;
  const hidden = data.lines.length - shown.length;
  const labelW = 210;
  for (const line of shown) {
    ctx.font = `700 22px ${family}`;
    ctx.fillStyle = c.muted;
    ctx.textAlign = 'left';
    ctx.fillText(line.label.toUpperCase(), M, rowY);
    ctx.font = `700 27px ${family}`;
    ctx.fillStyle = c.paper;
    const price = line.price === null ? 'Style only' : formatINR(line.price);
    ctx.textAlign = 'right';
    ctx.font = line.price === null ? `400 24px ${family}` : `700 27px ${family}`;
    ctx.fillStyle = line.price === null ? c.muted : c.paper;
    ctx.fillText(price, POSTER_W - M, rowY);
    const priceW = ctx.measureText(price).width;
    ctx.textAlign = 'left';
    ctx.font = `400 27px ${family}`;
    ctx.fillStyle = c.paper;
    ctx.fillText(fit(ctx, line.value, inner - labelW - priceW - 24), M + labelW, rowY);
    ctx.fillStyle = c.line;
    ctx.fillRect(M, rowY + 15, inner, 1);
    rowY += rowH;
  }
  if (hidden > 0) {
    ctx.font = `400 24px ${family}`;
    ctx.fillStyle = c.muted;
    ctx.fillText(`and ${hidden} more ${hidden === 1 ? 'part' : 'parts'}`, M + labelW, rowY);
  }
  if (data.lines.length === 0) {
    ctx.font = `400 26px ${family}`;
    ctx.fillStyle = c.muted;
    ctx.fillText('Stock car. No parts fitted yet.', M, rowY);
  }

  // Total on the red band, white ink.
  ctx.fillStyle = c.brand;
  ctx.fillRect(0, totalBandTop, POSTER_W, 88);
  ctx.fillStyle = c.brandInk;
  ctx.font = `italic 900 34px ${family}`;
  ctx.textAlign = 'left';
  ctx.fillText('BUILD TOTAL', M, totalBandTop + 57);
  ctx.font = `800 46px ${family}`;
  ctx.textAlign = 'right';
  ctx.fillText(formatINR(data.total), POSTER_W - M, totalBandTop + 61);

  // Footer: the honest line, and where to find the build.
  ctx.textAlign = 'left';
  ctx.font = `400 21px ${family}`;
  ctx.fillStyle = c.muted;
  ctx.fillText('Style preview on a generic car. Fitment is confirmed on each product page.', M, totalBandTop + 128);
  if (data.link) {
    ctx.fillStyle = c.paper;
    ctx.fillText(fit(ctx, data.link, inner), M, totalBandTop + 160);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The poster could not be made.'))), 'image/png');
  });
}

/** A file name from the build title: "sunday-swift-build.png". */
export function posterFileName(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${base || 'my'}-build.png`;
}
