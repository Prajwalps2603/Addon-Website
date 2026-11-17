/**
 * Side-profile geometry for the three cars. Local coordinates: x runs from the rear bumper (0) to the
 * front bumper (length), y = 0 is the ground at stock ride height and negative y is up. The car faces right.
 * Scale is roughly 1 unit = 5 mm, so the cars keep believable proportions.
 */
import type { BuildBodyType } from '../contract';

export interface Pt {
  x: number;
  y: number;
}

export interface CarGeometry {
  type: BuildBodyType;
  length: number;
  /** Tyre outer radius at stock size. */
  wheelR: number;
  rearX: number;
  frontX: number;
  /** Radius of the wheel-arch cutout. */
  archR: number;
  /** y of the body bottom between and around the arches. */
  sillY: number;
  /** Silhouette with arch cutouts. */
  body: string;
  /** Side glass shapes. */
  glass: string[];
  /** Pillars and shut lines, drawn as thin strokes. */
  shutLines: string[];
  /** Shoulder crease, drawn as a highlight then shadow pair. */
  shoulder: string;
  /** Lower body crease. */
  lowerCrease: string;
  /** Headlamp and tail lamp shapes. */
  headlamp: string;
  taillamp: string;
  /** Where the beams start. */
  headlampAt: Pt;
  taillampAt: Pt;
  /** Front grille / intake shape on the bumper face. */
  grille: string;
  mirror: string;
  handles: Pt[];
  /** Fuel flap position (on the rear quarter). */
  fuelFlap: Pt;
  /** Vertical gradient stops for the body shading (y values). */
  shadeY: { roof: number; belt: number; shoulder: number; crease: number; bottom: number };
  roof: { x1: number; x2: number; y: number };
  /** Top of the rear end where lip and ducktail spoilers sit, and the slope there. */
  deck: Pt;
  /** Rear end of the roof (roof spoiler). */
  roofEnd: Pt;
  /** GT wing mount point (on the boot or tailgate). */
  wingMount: Pt;
  /** Front bumper lower corner and the x where the bumper bottom starts. */
  frontLower: Pt;
  frontLowerStart: number;
  rearLower: Pt;
  rearLowerEnd: number;
  /** Bumper face x and the lamp line height, for pods and the bull bar. */
  noseX: number;
  noseTop: number;
  /** Belt line: rear x, front x and y at each end (decal stripe). */
  belt: { x1: number; y1: number; x2: number; y2: number };
  /** A-pillar base and roof front (snorkel route). */
  aPillarBase: Pt;
  aPillarTop: Pt;
  /** Where the two roof-rack feet stand on the roof. */
  rackFeet: [Pt, Pt];
  /** Roof light bar mount (front of the roof). */
  lightBarAt: Pt;
  /** Visible roof rails (stock on the SUV). */
  roofRails: boolean;
  /** Plastic arch cladding (SUV). */
  cladding: boolean;
}

/** Arc over the top of a wheel, from the sill on one side to the sill on the other. */
function arch(cx: number, wheelY: number, r: number, y: number): string {
  const dy = y - wheelY;
  const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
  return `L ${f(cx - dx)} ${f(y)} A ${r} ${r} 0 1 1 ${f(cx + dx)} ${f(y)}`;
}

function f(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** Closed arch-well shape (the dark space above the tyre). */
export function archWell(g: CarGeometry, cx: number): string {
  const wheelY = -g.wheelR;
  const r = g.archR - 1;
  const y = g.sillY + 6;
  const dy = y - wheelY;
  const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
  return `M ${f(cx - dx)} ${f(y)} A ${r} ${r} 0 1 1 ${f(cx + dx)} ${f(y)} Z`;
}

/** The fender lip, a stroke just outside the arch cutout. */
export function archLip(g: CarGeometry, cx: number, extra = 0): string {
  const wheelY = -g.wheelR;
  const r = g.archR + extra;
  const y = g.sillY - 2;
  const dy = y - wheelY;
  const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
  return `M ${f(cx - dx)} ${f(y)} A ${r} ${r} 0 1 1 ${f(cx + dx)} ${f(y)}`;
}

function hatchback(): CarGeometry {
  const R = 62;
  const rearX = 138;
  const frontX = 628;
  const archR = 72;
  const sillY = -44;
  const wy = -R;
  const body = [
    `M 26 -50`,
    `C 30 -46 34 ${sillY} 44 ${sillY}`,
    arch(rearX, wy, archR, sillY),
    arch(frontX, wy, archR, sillY),
    `L 738 ${sillY}`,
    `C 756 -46 764 -56 767 -72`,
    `L 771 -108`,
    `C 773 -126 768 -138 752 -146`,
    `C 700 -164 610 -182 548 -194`,
    `C 500 -226 462 -262 430 -288`,
    `C 402 -304 300 -308 214 -304`,
    `C 176 -302 150 -296 132 -286`,
    `C 112 -262 96 -240 84 -222`,
    `C 70 -204 60 -186 48 -166`,
    `C 38 -150 32 -132 30 -112`,
    `L 26 -68`,
    `Z`,
  ].join(' ');
  return {
    type: 'hatchback',
    length: 780,
    wheelR: R,
    rearX,
    frontX,
    archR,
    sillY,
    body,
    glass: [
      `M 528 -200 C 496 -224 468 -250 440 -274 C 424 -284 396 -288 366 -289 L 362 -206 Z`,
      `M 350 -206 L 354 -289 C 312 -291 268 -291 232 -288 L 238 -208 Z`,
      `M 226 -209 L 220 -287 C 186 -286 162 -280 146 -270 C 132 -254 120 -236 112 -222 C 110 -212 116 -209 126 -209 Z`,
    ],
    shutLines: [
      `M 546 -196 C 552 -150 552 -96 544 -50`,
      `M 357 -206 L 354 -48`,
      `M 233 -208 C 240 -160 236 -120 214 -98`,
      `M 538 -196 L 356 -206`,
    ],
    shoulder: `M 54 -176 C 200 -184 420 -188 744 -150`,
    lowerCrease: `M 222 -88 C 340 -92 460 -94 548 -92`,
    headlamp: `M 700 -160 C 728 -154 750 -148 762 -140 C 766 -132 764 -126 756 -124 C 734 -128 712 -138 700 -146 Z`,
    taillamp: `M 84 -220 C 74 -206 62 -188 52 -170 C 60 -166 72 -166 80 -170 C 86 -186 90 -204 92 -214 Z`,
    headlampAt: { x: 762, y: -134 },
    taillampAt: { x: 54, y: -176 },
    grille: `M 742 -104 C 754 -102 764 -96 768 -88 L 766 -70 C 756 -66 744 -66 736 -70 Z`,
    mirror: `M 522 -206 C 512 -214 500 -220 486 -218 C 480 -210 482 -200 490 -196 C 502 -194 516 -198 522 -206 Z`,
    handles: [
      { x: 470, y: -176 },
      { x: 288, y: -178 },
    ],
    fuelFlap: { x: 168, y: -170 },
    shadeY: { roof: -306, belt: -200, shoulder: -176, crease: -96, bottom: -44 },
    roof: { x1: 200, x2: 420, y: -305 },
    deck: { x: 92, y: -236 },
    roofEnd: { x: 132, y: -287 },
    wingMount: { x: 112, y: -262 },
    frontLower: { x: 762, y: -48 },
    frontLowerStart: frontX + archR,
    rearLower: { x: 30, y: -52 },
    rearLowerEnd: rearX - archR,
    noseX: 771,
    noseTop: -140,
    belt: { x1: 60, y1: -168, x2: 742, y2: -142 },
    aPillarBase: { x: 548, y: -194 },
    aPillarTop: { x: 432, y: -288 },
    rackFeet: [{ x: 236, y: -305 }, { x: 396, y: -301 }],
    lightBarAt: { x: 408, y: -300 },
    roofRails: false,
    cladding: false,
  };
}

function sedan(): CarGeometry {
  const R = 63;
  const rearX = 172;
  const frontX = 690;
  const archR = 73;
  const sillY = -44;
  const wy = -R;
  const body = [
    `M 30 -54`,
    `C 34 -48 40 ${sillY} 52 ${sillY}`,
    arch(rearX, wy, archR, sillY),
    arch(frontX, wy, archR, sillY),
    `L 836 ${sillY}`,
    `C 856 -46 864 -56 868 -70`,
    `L 874 -100`,
    `C 876 -114 872 -124 858 -130`,
    `C 800 -150 700 -170 612 -186`,
    `C 560 -222 520 -256 476 -280`,
    `C 440 -294 360 -296 300 -292`,
    `C 262 -290 236 -282 214 -266`,
    `C 190 -244 172 -224 152 -206`,
    `C 120 -202 80 -200 50 -196`,
    `C 38 -194 31 -186 30 -170`,
    `C 28 -150 27 -130 28 -112`,
    `L 28 -70`,
    `Z`,
  ].join(' ');
  return {
    type: 'sedan',
    length: 880,
    wheelR: R,
    rearX,
    frontX,
    archR,
    sillY,
    body,
    glass: [
      `M 592 -194 C 556 -222 520 -250 486 -270 C 456 -282 428 -284 404 -284 L 398 -200 Z`,
      `M 386 -200 L 392 -284 C 352 -285 318 -284 292 -281 C 270 -276 256 -270 246 -262 L 268 -202 Z`,
      `M 256 -203 L 236 -258 C 222 -248 208 -234 196 -220 C 194 -208 200 -204 212 -204 Z`,
    ],
    shutLines: [
      `M 610 -188 C 616 -140 614 -96 604 -50`,
      `M 392 -200 L 388 -48`,
      `M 272 -202 C 278 -160 274 -120 252 -100`,
      `M 600 -190 L 390 -201`,
      `M 152 -206 C 120 -206 80 -204 40 -198`,
    ],
    shoulder: `M 40 -172 C 260 -182 520 -180 852 -138`,
    lowerCrease: `M 252 -88 C 380 -92 500 -94 612 -90`,
    headlamp: `M 790 -154 C 820 -148 848 -140 864 -130 C 868 -124 864 -118 856 -117 C 830 -120 806 -130 790 -140 Z`,
    taillamp: `M 36 -192 C 70 -196 110 -198 140 -196 C 136 -186 126 -178 112 -176 C 84 -174 58 -174 32 -174 Z`,
    headlampAt: { x: 864, y: -126 },
    taillampAt: { x: 36, y: -184 },
    grille: `M 846 -100 C 858 -98 868 -92 872 -84 L 868 -68 C 858 -64 846 -64 838 -68 Z`,
    mirror: `M 586 -200 C 576 -208 562 -214 548 -212 C 542 -204 544 -194 552 -190 C 566 -188 580 -192 586 -200 Z`,
    handles: [
      { x: 520, y: -172 },
      { x: 326, y: -176 },
    ],
    fuelFlap: { x: 210, y: -170 },
    shadeY: { roof: -296, belt: -196, shoulder: -174, crease: -96, bottom: -44 },
    roof: { x1: 290, x2: 470, y: -294 },
    deck: { x: 44, y: -198 },
    roofEnd: { x: 230, y: -276 },
    wingMount: { x: 96, y: -199 },
    frontLower: { x: 862, y: -48 },
    frontLowerStart: frontX + archR,
    rearLower: { x: 32, y: -56 },
    rearLowerEnd: rearX - archR,
    noseX: 874,
    noseTop: -128,
    belt: { x1: 44, y1: -166, x2: 850, y2: -134 },
    aPillarBase: { x: 612, y: -186 },
    aPillarTop: { x: 478, y: -280 },
    rackFeet: [{ x: 312, y: -293 }, { x: 446, y: -290 }],
    lightBarAt: { x: 456, y: -289 },
    roofRails: false,
    cladding: false,
  };
}

function suv(): CarGeometry {
  const R = 78;
  const rearX = 152;
  const frontX = 700;
  const archR = 90;
  const sillY = -58;
  const wy = -R;
  const body = [
    `M 24 -70`,
    `C 26 -62 32 ${sillY} 44 ${sillY}`,
    arch(rearX, wy, archR, sillY),
    arch(frontX, wy, archR, sillY),
    `L 828 ${sillY}`,
    `C 844 -60 852 -70 854 -86`,
    `L 858 -156`,
    `C 860 -176 854 -186 840 -192`,
    `C 790 -200 700 -212 620 -226`,
    `C 590 -262 560 -296 532 -326`,
    `C 518 -336 492 -340 462 -340`,
    `L 120 -338`,
    `C 92 -337 76 -332 66 -320`,
    `C 54 -292 42 -262 36 -234`,
    `C 32 -212 28 -182 26 -152`,
    `L 24 -90`,
    `Z`,
  ].join(' ');
  return {
    type: 'suv',
    length: 860,
    wheelR: R,
    rearX,
    frontX,
    archR,
    sillY,
    body,
    glass: [
      `M 602 -240 C 580 -266 558 -292 538 -314 C 526 -325 504 -328 478 -328 L 472 -246 Z`,
      `M 460 -246 L 466 -328 L 274 -328 L 276 -247 Z`,
      `M 262 -247 L 260 -328 L 112 -328 C 94 -327 84 -322 78 -312 C 70 -294 64 -270 62 -252 C 62 -249 66 -248 74 -248 Z`,
    ],
    shutLines: [
      `M 620 -228 C 624 -180 620 -142 606 -114 L 602 -66`,
      `M 466 -246 L 462 -60`,
      `M 268 -247 C 274 -192 270 -152 250 -128`,
      `M 608 -240 L 466 -246`,
      `M 268 -247 L 62 -250`,
    ],
    shoulder: `M 30 -216 C 220 -222 520 -220 842 -188`,
    lowerCrease: `M 262 -118 C 380 -122 500 -122 600 -118`,
    headlamp: `M 772 -204 C 802 -200 830 -194 850 -188 C 854 -180 852 -172 844 -170 C 816 -174 790 -180 772 -188 Z`,
    taillamp: `M 62 -314 C 54 -294 46 -268 40 -242 C 48 -238 58 -238 64 -242 C 68 -264 72 -290 76 -308 Z`,
    headlampAt: { x: 850, y: -180 },
    taillampAt: { x: 46, y: -272 },
    grille: `M 838 -158 C 848 -156 854 -150 856 -140 L 856 -104 C 848 -100 838 -100 830 -104 Z`,
    mirror: `M 596 -240 C 584 -250 568 -256 552 -254 C 544 -244 546 -232 556 -228 C 572 -226 588 -230 596 -240 Z`,
    handles: [
      { x: 560, y: -218 },
      { x: 372, y: -222 },
    ],
    fuelFlap: { x: 196, y: -214 },
    shadeY: { roof: -340, belt: -246, shoulder: -216, crease: -120, bottom: -58 },
    roof: { x1: 130, x2: 470, y: -340 },
    deck: { x: 92, y: -337 },
    roofEnd: { x: 96, y: -336 },
    wingMount: { x: 84, y: -330 },
    frontLower: { x: 850, y: -62 },
    frontLowerStart: frontX + archR,
    rearLower: { x: 26, y: -70 },
    rearLowerEnd: rearX - archR,
    noseX: 858,
    noseTop: -186,
    belt: { x1: 34, y1: -208, x2: 838, y2: -184 },
    aPillarBase: { x: 620, y: -226 },
    aPillarTop: { x: 532, y: -326 },
    rackFeet: [{ x: 170, y: -339 }, { x: 420, y: -340 }],
    lightBarAt: { x: 480, y: -340 },
    roofRails: true,
    cladding: true,
  };
}

const GEOMETRY: Record<BuildBodyType, CarGeometry> = {
  hatchback: hatchback(),
  sedan: sedan(),
  suv: suv(),
};

export function carGeometry(type: BuildBodyType): CarGeometry {
  return GEOMETRY[type] ?? GEOMETRY.hatchback;
}
