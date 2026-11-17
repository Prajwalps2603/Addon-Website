import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

type CustomGroup = 'type-recipe' | 'dur' | 'container-width';

/**
 * tailwind-merge only knows Tailwind's stock theme. These are the tokens and utilities
 * src/styles/index.css adds, so a later class still overrides an earlier one
 * (`cn('type-h2', 'type-h3')`, `cn('rounded-control', 'rounded-none')`).
 */
const merge = extendTailwindMerge<CustomGroup>({
  extend: {
    theme: {
      radius: ['control'],
      shadow: ['pop', 'sheet'],
      ease: ['settle', 'pop'],
      animate: [
        'roll',
        'fade-in',
        'fade-out',
        'pop-in',
        'pop-out',
        'lean-in',
        'lean-out',
        'sheet-in-bottom',
        'sheet-out-bottom',
        'sheet-in-right',
        'sheet-out-right',
        'sheet-in-left',
        'sheet-out-left',
        'sticker',
        'tile-roll',
        'wipe',
        'shimmer',
        'ticker',
      ],
    },
    classGroups: {
      'type-recipe': [
        {
          type: [
            'display',
            'h1',
            'h2',
            'h3',
            'title',
            'lead',
            'body',
            'small',
            'label',
            'button',
            'code',
            'board',
            'price-xl',
            'price',
            'mrp',
            'stat',
          ],
        },
      ],
      dur: [{ dur: ['quick', 'base', 'settle', 'slow'] }],
      'container-width': [{ container: ['page', 'prose'] }],
      z: [{ z: ['raised', 'sticky', 'header', 'floating', 'overlay', 'popover', 'toast', 'tooltip'] }],
    },
    conflictingClassGroups: {
      dur: ['duration'],
    },
  },
});

/** Joins class names (clsx) and resolves Tailwind conflicts so the last one wins (tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
