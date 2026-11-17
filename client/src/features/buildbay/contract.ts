/**
 * Build Bay contract: shared by the art (stage/CarStage.tsx), the page, the gallery and the seed.
 * The style keys are exactly the table in docs/BUILD_SPEC.md section 7. Do not rename them:
 * saved builds and catalogue products (`buildSlot` + `buildStyle`) refer to them.
 */
import type { BuildSlot, BuildState } from '@/types/api';

export type BuildBodyType = BuildState['bodyType'];

export interface CarStageProps {
  state: BuildState;
  className?: string;
  /** No animation: for thumbnails and posters. */
  static?: boolean;
}

export interface BuildStyleOption {
  slot: BuildSlot;
  /** The key stored in BuildPart.style and in a product's buildStyle. */
  style: string;
  label: string;
  /** Body types this style is offered on. */
  bodyTypes: BuildBodyType[];
  /** True when the part is drawn in a colour the shopper picks (BuildPart.color). */
  takesColor: boolean;
}

export const BUILD_BODY_TYPES: readonly BuildBodyType[] = ['hatchback', 'sedan', 'suv'];

const ALL: BuildBodyType[] = ['hatchback', 'sedan', 'suv'];
const SUV_ONLY: BuildBodyType[] = ['suv'];

function option(slot: BuildSlot, style: string, label: string, bodyTypes = ALL, takesColor = false): BuildStyleOption {
  return { slot, style, label, bodyTypes: [...bodyTypes], takesColor };
}

/** Every slot with the styles it offers, in the order the build sheet lists them. */
export const BUILD_SLOT_STYLES: Readonly<Record<BuildSlot, readonly BuildStyleOption[]>> = {
  wheels: [
    option('wheels', 'five-spoke', 'Five-spoke', ALL, true),
    option('wheels', 'multi-spoke', 'Multi-spoke', ALL, true),
    option('wheels', 'mesh', 'Mesh', ALL, true),
    option('wheels', 'split-spoke', 'Split-spoke', ALL, true),
    option('wheels', 'turbine', 'Turbine', ALL, true),
    option('wheels', 'steelie', 'Steel wheel', ALL, true),
  ],
  spoiler: [
    option('spoiler', 'lip', 'Lip spoiler'),
    option('spoiler', 'ducktail', 'Ducktail'),
    option('spoiler', 'roof', 'Roof spoiler', ['hatchback', 'suv']),
    option('spoiler', 'gt-wing', 'GT wing'),
  ],
  splitter: [option('splitter', 'lip', 'Lip splitter'), option('splitter', 'race', 'Race splitter')],
  skirts: [option('skirts', 'blade', 'Blade side skirts')],
  diffuser: [option('diffuser', 'fins', 'Finned diffuser')],
  exhaust: [
    option('exhaust', 'single', 'Single tip'),
    option('exhaust', 'twin', 'Twin tip'),
    option('exhaust', 'quad', 'Quad tip'),
  ],
  roofRack: [
    option('roofRack', 'crossbars', 'Crossbars'),
    option('roofRack', 'basket', 'Roof basket'),
    option('roofRack', 'box', 'Roof box'),
  ],
  lightBar: [option('lightBar', 'roof-bar', 'Roof light bar'), option('lightBar', 'bumper-pods', 'Bumper pods')],
  underglow: [option('underglow', 'glow', 'Underglow', ALL, true)],
  decal: [option('decal', 'stripe', 'Racing stripe', ALL, true), option('decal', 'side-graphic', 'Side graphic', ALL, true)],
  bullBar: [option('bullBar', 'bar', 'Bull bar', SUV_ONLY)],
  sideStep: [option('sideStep', 'board', 'Side step', SUV_ONLY)],
  snorkel: [option('snorkel', 'snorkel', 'Snorkel', SUV_ONLY)],
  lowering: [option('lowering', 'springs', 'Lowering springs'), option('lowering', 'coilover', 'Coilovers')],
};

export const BUILD_SLOTS = Object.keys(BUILD_SLOT_STYLES) as BuildSlot[];

export const BUILD_SLOT_LABELS: Readonly<Record<BuildSlot, string>> = {
  wheels: 'Wheels',
  spoiler: 'Spoiler',
  splitter: 'Front splitter',
  skirts: 'Side skirts',
  diffuser: 'Rear diffuser',
  exhaust: 'Exhaust tip',
  roofRack: 'Roof rack',
  lightBar: 'Light bar',
  underglow: 'Underglow',
  decal: 'Decals',
  bullBar: 'Bull bar',
  sideStep: 'Side step',
  snorkel: 'Snorkel',
  lowering: 'Lowering',
};

/** Choosing a lowering style sets BuildState.rideHeight to this. */
export const LOWERING_RIDE_HEIGHT: Readonly<Record<string, number>> = { springs: -1, coilover: -2 };

/** The styles of a slot that suit a body type. Empty when the slot is not offered on it (bull bar on a hatchback). */
export function buildStylesFor(slot: BuildSlot, bodyType: BuildBodyType): BuildStyleOption[] {
  return BUILD_SLOT_STYLES[slot].filter((style) => style.bodyTypes.includes(bodyType));
}

export function findBuildStyle(slot: BuildSlot, style: string | null | undefined): BuildStyleOption | undefined {
  return BUILD_SLOT_STYLES[slot].find((candidate) => candidate.style === style);
}

/**
 * A stock car in the night garage: no parts, standard ride height and wheels, clear glass.
 * Frozen, because every build starts from this one object: copy it (`{ ...DEFAULT_BUILD_STATE, parts: {} }`), never edit it.
 */
export const DEFAULT_BUILD_STATE: BuildState = Object.freeze({
  bodyType: 'hatchback',
  paint: '#D5D8DD',
  rideHeight: 0,
  wheelSize: 0,
  night: true,
  tint: 0,
  parts: Object.freeze({}),
});
