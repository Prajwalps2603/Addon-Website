import { BUILD_SLOT_STYLES, BUILD_SLOTS } from '../contract';
import type { BuildStyleOption } from '../contract';

/** A named colour the shopper can pick. */
export interface NamedColour {
  name: string;
  hex: string;
}

/** Every slot and style in the contract, with its label, in build-sheet order. */
export const BUILD_STYLES: BuildStyleOption[] = BUILD_SLOTS.flatMap((slot) => BUILD_SLOT_STYLES[slot].map((option) => ({ ...option })));

/** Paint colours offered on the stage. The first is the default stock silver. */
export const PAINTS: NamedColour[] = [
  { name: 'Lunar Silver', hex: '#D5D8DD' },
  { name: 'Polar White', hex: '#F1F2EF' },
  { name: 'Graphite Grey', hex: '#4B5057' },
  { name: 'Jet Black', hex: '#15171B' },
  { name: 'Racing Yellow', hex: '#FFD500' },
  { name: 'Torch Red', hex: '#B81E2A' },
  { name: 'Ocean Blue', hex: '#1F4C8F' },
  { name: 'Forest Green', hex: '#2E5A45' },
  { name: 'Copper Bronze', hex: '#8E5532' },
  { name: 'Desert Beige', hex: '#C7B597' },
];

/** Wheel finishes. The first is the stock painted silver. */
export const WHEEL_FINISHES: NamedColour[] = [
  { name: 'Silver', hex: '#C3C7CC' },
  { name: 'Gunmetal', hex: '#4A4F56' },
  { name: 'Gloss black', hex: '#1A1C20' },
  { name: 'Bronze', hex: '#A67A3E' },
  { name: 'Racing Yellow', hex: '#FFD500' },
  { name: 'White', hex: '#EEF0F2' },
];

/** Colours for underglow and decals. The first, the default, is a bright red to sit with the brand. */
export const GLOW_COLOURS: NamedColour[] = [
  { name: 'Red', hex: '#FF3B3B' },
  { name: 'Ice white', hex: '#E8F3FF' },
  { name: 'Cyan', hex: '#2FD3F2' },
  { name: 'Lime', hex: '#8BEA3C' },
  { name: 'Racing Yellow', hex: '#FFD500' },
  { name: 'Amber', hex: '#FF9A1F' },
];

export const DEFAULT_WHEEL_FINISH = WHEEL_FINISHES[0].hex;
export const DEFAULT_GLOW = GLOW_COLOURS[0].hex;
