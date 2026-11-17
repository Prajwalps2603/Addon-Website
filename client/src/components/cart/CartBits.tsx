import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { iconForArtKind } from '@/components/commerce';
import { Button, Callout, EmptyState, Skeleton } from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/cn';

/** The server's plain notices about this cart ("Only 2 left of ...: quantity updated."). */
export function CartMessages({ messages, className }: { messages: string[]; className?: string }) {
  if (messages.length === 0) return null;
  return (
    <Callout tone="warn" live className={className} title={messages.length === 1 ? messages[0] : 'A few things changed in your cart'}>
      {messages.length > 1 && (
        <ul className="grid list-disc gap-1 pl-4">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </Callout>
  );
}

/** A polite live region for cart changes. Visually hidden. */
export function CartAnnouncer({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}

export interface CartEmptyProps {
  /** Drawer: smaller, centred. */
  compact?: boolean;
  onNavigate?: () => void;
  className?: string;
}

/** The empty cart: say so, then offer the shop's real categories. */
export function CartEmpty({ compact = false, onNavigate, className }: CartEmptyProps) {
  const { data: categories, isPending } = useCategories();
  const top = (categories ?? []).filter((category) => category.isActive !== false).slice(0, compact ? 6 : 8);

  return (
    <div className={cn('grid gap-6', className)}>
      <EmptyState
        size={compact ? 'sm' : 'md'}
        align={compact ? 'center' : 'start'}
        title="Your cart is empty"
        description="Pick your car first and every part tells you whether it fits."
        actions={
          <Button to="/shop" onClick={onNavigate} iconRight={<ArrowRight aria-hidden />}>
            Browse the shop
          </Button>
        }
      />
      {(isPending || top.length > 0) && (
        <nav aria-label="Shop by category" className="grid gap-2">
          <p className="type-label text-muted">Shop by category</p>
          <ul className={cn('grid border-t border-line', !compact && 'sm:grid-cols-2 sm:gap-x-6')}>
            {isPending
              ? Array.from({ length: 4 }, (_, index) => (
                  <li key={index} className="border-b border-line py-3">
                    <Skeleton className="h-5 w-40" />
                  </li>
                ))
              : top.map((category) => {
                  const Icon = iconForArtKind(category.artKind);
                  return (
                    <li key={category.id} className="border-b border-line">
                      <Link
                        to={`/shop/${category.slug}`}
                        onClick={onNavigate}
                        className="group flex min-h-12 items-center gap-3 py-2 font-bold focus-ring-inset hover:bg-surface"
                      >
                        <Icon aria-hidden className="size-5 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1">{category.name}</span>
                        {category.productCount > 0 && <span className="type-small font-normal text-muted tnum">{category.productCount}</span>}
                        <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform dur-quick group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </nav>
      )}
    </div>
  );
}
