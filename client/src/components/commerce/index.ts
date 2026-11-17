/**
 * Commerce components: the shopping building blocks every page shares.
 * Import from here: `import { ProductGrid, Price, FitBadge } from '@/components/commerce'`.
 * Props and usage for each: client/DESIGN.md ("Commerce components") and the /styleguide page.
 */

// products
export { ProductFrame, type ProductFrameProps } from './ProductFrame';
export { ProductCard, type ProductCardProps } from './ProductCard';
export { ProductCardSkeleton, type ProductCardSkeletonProps } from './ProductCardSkeleton';
export { ProductGrid, type ProductGridProps } from './ProductGrid';
export { ProductRail, type ProductRailProps } from './ProductRail';
export { iconForArtKind } from './categoryIcons';

// price, stock and drops
export { Price, percentBelow, type PriceProps } from './Price';
export { StockNote, type StockNoteProps } from './StockNote';
export { DropBadge, type DropBadgeProps } from './DropBadge';
export { DemoBadge, type DemoBadgeProps } from './DemoBadge';

// fit and the garage
export { FitBadge, describeFit, fitsPath, type FitBadgeProps, type FitDescription, type FitState, type FitSubject } from './FitBadge';
export { VehiclePicker, VehiclePickerInline, type VehiclePickerInlineProps } from './VehiclePicker';
export { VehicleSteps, type VehicleStepsProps } from './VehicleSteps';
export { GarageButton, type GarageButtonProps } from './GarageButton';

// the Straight Label and Plain Talk
export { StraightLabelChips, type StraightLabelChipsProps } from './StraightLabelChips';
export { StraightLabelPanel, type StraightLabelPanelProps } from './StraightLabelPanel';
export { LEGALITY_WORDS, WARRANTY_WORDS, WIRING_WORDS, type LabelLevel, type LabelWords } from './labelWords';
export { Jargon, JargonText, useGlossary, type Glossary, type JargonProps, type JargonTextProps } from './Jargon';

// buying
export { AddToCartButton, type AddToCartButtonProps } from './AddToCartButton';
export { QtyStepper, type QtyStepperProps } from './QtyStepper';
export { WishlistButton, type WishlistButtonProps } from './WishlistButton';
export { CompareButton, type CompareButtonProps } from './CompareButton';
export { PincodeCheck, type PincodeCheckProps } from './PincodeCheck';
export { CustomSummary, type CustomSummaryProps } from './CustomSummary';

// sharing
export { WhatsAppButton, type WhatsAppButtonProps } from './WhatsAppButton';
export { ShareButton, type ShareButtonProps } from './ShareButton';

// page furniture
export { SectionHeading, type SectionHeadingProps } from './SectionHeading';
export { PageHeader, type PageHeaderProps } from './PageHeader';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { ScrollDots, type ScrollDotsProps } from './ScrollDots';

// Kept here as well because docs/BUILD_SPEC.md lists them with the commerce components.
export { CompoundRing, compoundFor, type CompoundRingProps } from '@/components/brand';
export { EmptyState, type EmptyStateProps } from '@/components/ui';
