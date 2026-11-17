import { Check, Scale } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button, IconButton, toast, type ButtonSize } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MAX_COMPARE, useCompare, useIsCompared } from '@/stores/compare';

export interface CompareButtonProps {
  productId: number;
  /** Used in the accessible name: "Compare Addon Aero Spoiler". */
  productName?: string;
  /** `icon` for toolbars, `button` for the product page, `text` for the small toggle at the foot of a product card. */
  variant?: 'icon' | 'button' | 'text';
  size?: ButtonSize;
  /** `icon` only: a white disc behind the icon, for sitting on a photo. */
  onPhoto?: boolean;
  className?: string;
}

/**
 * Adds a product to the comparison (up to four). A pressed toggle. Adding offers the way to the
 * compare page; a fifth product is refused with the reason.
 */
export function CompareButton({ productId, productName, variant = 'icon', size = 'md', onPhoto = false, className }: CompareButtonProps) {
  const compared = useIsCompared(productId);
  const navigate = useNavigate();
  const subject = productName ? ` ${productName}` : '';

  const onClick = () => {
    const openCompare = { label: 'Open compare', onClick: () => void navigate('/compare') };
    const result = useCompare.getState().toggle(productId);
    if (result === 'full') {
      toast.error(`You can compare ${MAX_COMPARE} parts at a time`, { description: 'Remove one to add this.', action: openCompare, id: 'compare' });
    } else if (result === 'added') {
      const count = useCompare.getState().ids.length;
      toast.success(count > 1 ? `${count} parts ready to compare` : 'Added to compare', {
        description: count > 1 ? undefined : 'Add one more to see them side by side.',
        action: count > 1 ? openCompare : undefined,
        id: 'compare',
      });
    }
  };

  const icon = <Scale aria-hidden />;

  if (variant === 'text') {
    return (
      <button
        type="button"
        aria-pressed={compared}
        onClick={onClick}
        className={cn(
          'tap-44 inline-flex items-center gap-1.5 text-[0.8125rem] leading-snug font-bold underline decoration-1 underline-offset-4 hover:decoration-2 [&_svg]:size-4 [&_svg]:shrink-0',
          className,
        )}
      >
        {compared ? <Check aria-hidden /> : icon}
        {compared ? 'In compare' : 'Compare'}
        {productName && <span className="sr-only">{subject}</span>}
      </button>
    );
  }

  if (variant === 'button') {
    return (
      <Button variant={compared ? 'dark' : 'outline'} size={size} aria-pressed={compared} onClick={onClick} iconLeft={icon} className={className}>
        {compared ? 'In compare' : 'Compare'}
        {productName && <span className="sr-only">{subject}</span>}
      </Button>
    );
  }

  return (
    <IconButton
      label={compared ? `Remove${subject} from compare` : `Compare${subject}`}
      size={size}
      variant={compared ? 'dark' : 'ghost'}
      aria-pressed={compared}
      onClick={onClick}
      className={cn(onPhoto && 'rounded-full border border-line', onPhoto && !compared && 'bg-page hover:bg-surface', className)}
    >
      {icon}
    </IconButton>
  );
}
