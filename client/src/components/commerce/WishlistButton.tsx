import { Heart } from 'lucide-react';
import { Button, IconButton, type ButtonSize } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useIsWishlisted, useWishlist } from '@/stores/wishlist';

export interface WishlistButtonProps {
  productId: number;
  /** Used in the accessible name: "Save Addon Aero Spoiler". */
  productName?: string;
  /** `icon` is the heart on a card or beside a title. `button` spells it out: "Save" / "Saved". */
  variant?: 'icon' | 'button';
  size?: ButtonSize;
  /** `icon` only: a white disc behind the heart, for sitting on a photo. */
  onPhoto?: boolean;
  className?: string;
}

/**
 * Saves a product to the wishlist (kept on this device, and on the account when signed in).
 * A pressed toggle: the heart fills with Tread Red when saved.
 */
export function WishlistButton({ productId, productName, variant = 'icon', size = 'md', onPhoto = false, className }: WishlistButtonProps) {
  const saved = useIsWishlisted(productId);
  const toggle = useWishlist((state) => state.toggle);
  const subject = productName ? ` ${productName}` : '';
  const heart = <Heart aria-hidden className={cn(saved && 'fill-current text-brand')} />;

  if (variant === 'button') {
    return (
      <Button variant="outline" size={size} aria-pressed={saved} onClick={() => toggle(productId)} iconLeft={heart} className={className}>
        {saved ? 'Saved' : 'Save'}
        {productName && <span className="sr-only">{subject}</span>}
      </Button>
    );
  }

  return (
    <IconButton
      label={saved ? `Remove${subject} from saved` : `Save${subject}`}
      size={size}
      aria-pressed={saved}
      onClick={() => toggle(productId)}
      className={cn(onPhoto && 'rounded-full border border-line bg-page hover:bg-surface', className)}
    >
      {heart}
    </IconButton>
  );
}
