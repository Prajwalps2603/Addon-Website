import type { SVGProps } from 'react';

/*
 * lucide-react 1.x ships no brand icons, so these four are drawn here on lucide's own grid:
 * 24 x 24, 2 px round strokes, currentColor. They sit beside lucide icons without a change of weight.
 */

export interface SocialIconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Width and height in px. */
  size?: number;
  /** Accessible name. Leave it out when the link or button around the icon already has one. */
  title?: string;
}

function base({ size = 20, title, ...rest }: SocialIconProps): SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true }),
    ...rest,
  };
}

export function InstagramIcon(props: SocialIconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

export function FacebookIcon(props: SocialIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function YouTubeIcon(props: SocialIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  );
}

export function WhatsAppIcon(props: SocialIconProps) {
  return (
    <svg {...base(props)}>
      <path d="m3 21 1.65-3.8a9 9 0 1 1 3.4 2.9z" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
  );
}
