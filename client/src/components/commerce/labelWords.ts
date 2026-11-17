import type { Legality, WarrantyImpact, Wiring } from '@/types/api';

/**
 * One wording for the Straight Label facts, shared by the chips on product cards and the full panel.
 * `good` is green, `caution` is orange, `stop` is red and is kept for the one hard no: not legal on the road.
 */
export type LabelLevel = 'good' | 'caution' | 'stop';

export interface LabelWords {
  /** The verdict as the panel states it. */
  label: string;
  /** The same verdict cut down for a chip on a product card. */
  chip: string;
  level: LabelLevel;
  /** What it means, used when the product carries no note of its own. */
  detail: string;
}

export const LEGALITY_WORDS: Record<Legality, LabelWords> = {
  road_legal: {
    label: 'Road legal',
    chip: 'Road legal',
    level: 'good',
    detail: 'Fine to use on public roads as supplied.',
  },
  check_rules: {
    label: 'Check the rules first',
    chip: 'Check road rules',
    level: 'caution',
    detail: 'Legal in some forms or in some states only. Check what applies where you drive before fitting it.',
  },
  off_road_only: {
    label: 'Off-road only',
    chip: 'Off-road only',
    level: 'stop',
    detail: 'Not for public roads. It is sold for private land, tracks and shows.',
  },
};

export const WARRANTY_WORDS: Record<WarrantyImpact, LabelWords> = {
  none: {
    label: 'No effect on the car warranty',
    chip: 'Warranty safe',
    level: 'good',
    detail: 'It changes nothing the car maker covers.',
  },
  possible: {
    label: 'May affect the car warranty',
    chip: 'Warranty risk',
    level: 'caution',
    detail: 'A dealer could blame a related fault on this part. Keep the original so the car can be put back.',
  },
  likely: {
    label: 'Likely to affect the car warranty',
    chip: 'Affects warranty',
    level: 'caution',
    detail: 'Expect the dealer to refuse warranty work on the parts this changes.',
  },
};

export const WIRING_WORDS: Record<Wiring, LabelWords & { term: string | null }> = {
  none: {
    label: 'No wiring',
    chip: 'No wiring',
    level: 'good',
    detail: 'Nothing electrical to connect.',
    term: null,
  },
  plug_and_play: {
    label: 'Plug and play',
    chip: 'Plug and play',
    level: 'good',
    detail: 'Uses the sockets already in the car. No wire is cut.',
    term: 'Plug and play',
  },
  splice: {
    label: 'Splice: wires are cut and joined',
    chip: 'Wires cut',
    level: 'caution',
    detail: 'A wire of the car has to be cut into. Have a fitter do it properly, and expect questions at the service centre.',
    term: 'Splice',
  },
};
