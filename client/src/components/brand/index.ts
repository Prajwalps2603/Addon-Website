/**
 * Brand components: the logo and the motifs. Each motif carries real data or it is not shown.
 * Import from here: `import { Logo, PitBoard, CompoundRing } from '@/components/brand'`.
 */
export { Logo, type LogoProps } from './Logo';
export { LogoTyre, type LogoTyreProps } from './logoTyre';
export { RollingTyre, type RollingTyreProps } from './RollingTyre';
export { TyreGlyph, type TyreGlyphProps } from './tyre';
export { TreadDivider, type TreadDividerProps } from './TreadDivider';
export {
  PitBoard,
  BoardTile,
  BoardWord,
  BoardSlot,
  type BoardSlotProps,
  type BoardTileProps,
  type BoardWordProps,
  type PitBoardProps,
} from './PitBoard';
export { CompoundRing, compoundFor, type Compound, type CompoundInfo, type CompoundRingProps } from './CompoundRing';
export { TimingRow, TimingTower, type TimingRowProps, type TimingTowerProps } from './TimingRow';
export { Roundel, type RoundelProps } from './Roundel';
export { StickerChip, type StickerChipProps } from './StickerChip';
export { FacebookIcon, InstagramIcon, WhatsAppIcon, YouTubeIcon, type SocialIconProps } from './SocialIcons';
export { PaymentMark, PaymentMarks, type PaymentKind, type PaymentMarkProps, type PaymentMarksProps } from './PaymentMarks';
