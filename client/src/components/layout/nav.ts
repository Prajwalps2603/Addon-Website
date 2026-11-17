import { CalendarCheck, Car, Wallet, type LucideIcon } from 'lucide-react';
import type { Category } from '@/types/api';

export interface ToolLink {
  to: string;
  name: string;
  /** One line on what the tool does. */
  blurb: string;
  Icon: LucideIcon;
}

/** The interactive tools, in the order they appear in the header and the menu drawer. */
export const TOOLS: readonly ToolLink[] = [
  { to: '/new-car', name: 'New Car planner', blurb: 'Three kits for the car you are about to take delivery of.', Icon: CalendarCheck },
  { to: '/pocket-builds', name: 'Pocket Builds', blurb: 'Type a budget and get a complete kit under it.', Icon: Wallet },
];

export interface TextLink {
  to: string;
  label: string;
}

export const HELP_LINKS: readonly TextLink[] = [
  { to: '/track', label: 'Track an order' },
  { to: '/contact', label: 'Contact us' },
  { to: '/faq', label: 'Questions and answers' },
  { to: '/straight-label', label: 'Fitted reports and the Straight Label' },
  { to: '/glossary', label: 'Glossary of car terms' },
  { to: '/about', label: 'About the shop' },
  { to: '/credits', label: 'Photo credits' },
];

export const POLICY_LINKS: readonly TextLink[] = [
  { to: '/policies/shipping', label: 'Shipping' },
  { to: '/policies/returns', label: 'Returns and refunds' },
  { to: '/policies/warranty', label: 'Warranty' },
  { to: '/policies/privacy', label: 'Privacy' },
  { to: '/policies/terms', label: 'Terms of sale' },
];

export function categoryPath(category: Pick<Category, 'slug'>, parent?: Pick<Category, 'slug'> | null): string {
  return parent ? `/shop/${parent.slug}/${category.slug}` : `/shop/${category.slug}`;
}

/** Top-level categories in the shop's own order. */
export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function partsCount(count: number): string {
  return `${count.toLocaleString('en-IN')} ${count === 1 ? 'part' : 'parts'}`;
}

/** "99+" past two digits, so a badge never grows wider than its icon. */
export function badgeCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}
