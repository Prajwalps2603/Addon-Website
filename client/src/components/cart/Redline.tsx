import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import type { PricedCart } from '@/types/api';

/*
 * The Redline: free-delivery progress drawn as a tachometer.
 *
 * The dial sweeps 240 degrees. The free-delivery threshold sits at THRESHOLD_AT of the sweep and
 * everything past it is the green "free" zone, so a needle in the green really means free delivery.
 * The needle is the goods value (items less coupon, the figure the server compares) against the
 * one real threshold from settings. The shift light below the hub comes on (Tread Red, with the word
 * FREE) when delivery is free. Hidden for orders collected or fitted at the studio.
 */

const SWEEP_START = -120;
const SWEEP = 240;
const THRESHOLD_AT = 0.8;
const CX = 60;
const CY = 58;
const R = 50;

function point(angle: number, radius: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
}

function arc(from: number, to: number, radius: number): string {
  const [x0, y0] = point(from, radius);
  const [x1, y1] = point(to, radius);
  const large = to - from > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const THRESHOLD_ANGLE = SWEEP_START + THRESHOLD_AT * SWEEP;
const END_ANGLE = SWEEP_START + SWEEP;
// Eleven ticks 24 degrees apart: the ninth lands on the threshold mark.
const TICKS = Array.from({ length: 11 }, (_, index) => SWEEP_START + index * (SWEEP / 10));

export interface RedlineReading {
  /** False when there is nothing to show: no threshold set, or nothing in the cart counts yet. */
  show: boolean;
  isFree: boolean;
  threshold: number;
  /** Items less coupon: the value the threshold is measured against. */
  goods: number;
  toGo: number;
  /** 0 to 1 along the dial. */
  position: number;
  /** The plain sentence. */
  sentence: string;
  /** One more line under it. */
  detail: string;
}

export function readRedline(cart: PricedCart): RedlineReading {
  const threshold = Math.max(0, cart.freeShippingThreshold);
  const goods = Math.max(0, cart.subtotal - cart.discount);
  const toGo = Math.max(0, cart.amountToFreeShipping);
  const isFree = toGo === 0;
  // Collected or fitted at the studio: nothing is delivered, so there is no delivery to make free.
  const show = threshold > 0 && cart.itemCount > 0 && cart.fulfilment === 'delivery';
  const ratio = threshold > 0 ? goods / threshold : 1;
  const position = Math.min(1, Math.max(0, isFree ? Math.max(ratio, 1) * THRESHOLD_AT : Math.min(ratio, 0.999) * THRESHOLD_AT));

  let detail: string;
  if (!isFree) detail = `Delivery is free on orders from ${formatINR(threshold)}.`;
  else if (cart.shippingFee > 0) detail = `${formatINR(cart.shippingFee)} still applies for a large part.`;
  else if (goods < threshold) detail = 'Your coupon covers delivery.';
  else detail = `Your order is over ${formatINR(threshold)}.`;

  return {
    show,
    isFree,
    threshold,
    goods,
    toGo,
    position,
    sentence: isFree ? 'Delivery is free' : `${formatINR(toGo)} more for free delivery`,
    detail,
  };
}

export interface RedlineDialProps {
  /** 0 to 1 along the sweep. */
  position: number;
  isFree: boolean;
  /** Rendered width in px. */
  size?: number;
  className?: string;
}

/** The dial alone. Decorative: the words beside it carry the meaning. */
export function RedlineDial({ position, isFree, size = 112, className }: RedlineDialProps) {
  // The needle rises from rest on first show, then follows the cart. Under reduced motion the
  // global CSS removes the transition, so it simply sits at its reading.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(position));
    return () => cancelAnimationFrame(frame);
  }, [position]);

  const needle = SWEEP_START + Math.min(1, Math.max(0, shown)) * SWEEP;

  return (
    <svg
      viewBox="0 0 120 92"
      width={size}
      height={(size * 92) / 120}
      aria-hidden
      focusable="false"
      className={cn('shrink-0 overflow-visible', className)}
    >
      {/* Track up to the threshold, then the free zone. */}
      <path d={arc(SWEEP_START, THRESHOLD_ANGLE, R)} fill="none" strokeWidth={2} className="stroke-line-strong" strokeLinecap="butt" />
      <path d={arc(THRESHOLD_ANGLE, END_ANGLE, R)} fill="none" strokeWidth={6} className="stroke-fit" strokeLinecap="butt" />

      {TICKS.map((angle, index) => {
        if (Math.abs(angle - THRESHOLD_ANGLE) < 0.01) return null;
        const inFree = angle > THRESHOLD_ANGLE;
        const major = index % 2 === 0;
        const [x0, y0] = point(angle, R - (major ? 11 : 7));
        const [x1, y1] = point(angle, R - 3);
        return (
          <line
            key={angle}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            strokeWidth={major ? 2 : 1.25}
            className={inFree ? 'stroke-fit' : major ? 'stroke-ink' : 'stroke-line-strong'}
          />
        );
      })}

      {/* The threshold mark: the one real number on the dial. */}
      {(() => {
        const [x0, y0] = point(THRESHOLD_ANGLE, R - 15);
        const [x1, y1] = point(THRESHOLD_ANGLE, R + 4);
        return <line x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={3} className="stroke-ink" />;
      })()}

      {/* Shift light. */}
      <rect
        key={isFree ? 'on' : 'off'}
        x={CX - 15}
        y={76}
        width={30}
        height={10}
        rx={2}
        strokeWidth={1.5}
        className={cn(isFree ? 'fill-brand stroke-ink animate-pop-in' : 'fill-surface-2 stroke-line-strong')}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
      {isFree && (
        <text
          x={CX}
          y={83.6}
          textAnchor="middle"
          className="fill-brand-ink"
          style={{ fontSize: 7, fontWeight: 900, fontStyle: 'italic', letterSpacing: '0.04em' }}
        >
          FREE
        </text>
      )}

      {/* Needle. Rotated with a transform so it can move on the compositor. */}
      <g
        className="transition-transform dur-slow ease-settle"
        style={{ transform: `rotate(${needle}deg)`, transformOrigin: `${CX}px ${CY}px`, transformBox: 'view-box' }}
      >
        <line x1={CX} y1={CY + 7} x2={CX} y2={CY - R + 5} strokeWidth={2.5} strokeLinecap="round" className="stroke-ink" />
      </g>
      <circle cx={CX} cy={CY} r={5.5} className="fill-ink" />
      <circle cx={CX} cy={CY} r={2} className="fill-page" />
    </svg>
  );
}

export interface RedlineProps {
  cart: PricedCart;
  /** `sm` for the drawer, `md` for the cart page. */
  size?: 'sm' | 'md';
  /** Dims while a newer price is on its way. */
  updating?: boolean;
  className?: string;
}

/**
 * Free-delivery progress as a tachometer with its sentence. The meter role carries the same
 * reading for screen readers. Renders nothing when the store has no free-delivery threshold.
 */
export function Redline({ cart, size = 'md', updating = false, className }: RedlineProps) {
  const reading = readRedline(cart);
  if (!reading.show) return null;
  const small = size === 'sm';

  return (
    <div
      role="meter"
      aria-label="Free delivery"
      aria-valuemin={0}
      aria-valuemax={reading.threshold}
      aria-valuenow={Math.min(reading.goods, reading.threshold)}
      aria-valuetext={`${reading.sentence}. ${reading.detail}`}
      className={cn('flex items-center gap-3 transition-opacity dur-base', updating && 'opacity-60', className)}
    >
      <RedlineDial position={reading.position} isFree={reading.isFree} size={small ? 76 : 112} />
      <div className="grid min-w-0 gap-0.5">
        <p className={cn('font-extrabold tnum leading-tight', small ? 'text-base' : 'text-lg', reading.isFree ? 'text-fit' : 'text-ink')}>
          {reading.sentence}
        </p>
        <p className="type-small text-muted tnum">{reading.detail}</p>
      </div>
    </div>
  );
}
