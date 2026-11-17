import { Link } from 'react-router';
import { AddToCartButton, FitBadge, Price, ProductFrame } from '@/components/commerce';
import { Button } from '@/components/ui';
import type { RelatedProduct } from '@/types/api';

/**
 * "You will also need" and "Works well with": short rows, each with the shop's note on why,
 * and a one-tap add. Parts that need a choice first (a size, a design) link to their page instead.
 */
export function Relations({ relations }: { relations: readonly RelatedProduct[] }) {
  const requires = relations.filter((relation) => relation.kind === 'requires');
  const pairs = relations.filter((relation) => relation.kind === 'pairs_with');
  if (requires.length === 0 && pairs.length === 0) return null;

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      {requires.length > 0 && (
        <RelationGroup
          id="needs-title"
          title="You will also need"
          description="It will not work, or not fit, without these. Skip any you already have."
          items={requires}
        />
      )}
      {pairs.length > 0 && <RelationGroup id="pairs-title" title="Works well with" items={pairs} />}
    </div>
  );
}

function RelationGroup({ id, title, description, items }: { id: string; title: string; description?: string; items: RelatedProduct[] }) {
  return (
    <section aria-labelledby={id} className="grid content-start gap-3">
      <div className="grid gap-1">
        <h2 id={id} className="type-h2">
          {title}
        </h2>
        {description && <p className="type-small text-muted">{description}</p>}
      </div>
      <ul className="divide-y divide-line border-y border-ink">
        {items.map(({ product, note }) => {
          const needsChoice = product.hasVariants || product.customKind !== null;
          return (
            <li key={product.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
              <Link to={`/p/${product.slug}`} tabIndex={-1} aria-hidden className="block">
                <ProductFrame image={product.image} alt="" artKind={product.artKind} muted={!product.inStock} />
              </Link>
              <div className="grid min-w-0 content-start gap-1">
                <Link to={`/p/${product.slug}`} className="focus-ring line-clamp-2 leading-snug font-bold underline-offset-4 hover:underline">
                  {product.name}
                </Link>
                {note && <p className="type-small text-muted">{note}</p>}
                <Price size="sm" price={product.price} mrp={product.mrp} regularPrice={product.regularPrice} drop={product.drop} from={product.hasVariants} />
                <FitBadge product={product} />
              </div>
              <div className="col-start-2 self-center sm:col-start-3">
                {!product.inStock ? (
                  <p className="type-small font-bold text-stop">Sold out</p>
                ) : needsChoice ? (
                  <Button to={`/p/${product.slug}`} variant="outline" size="sm">
                    {product.customKind ? 'Design it' : 'Choose'}
                  </Button>
                ) : (
                  <AddToCartButton productId={product.id} productName={product.name} tone="outline" size="sm" openCart={false}>
                    Add
                    <span className="sr-only"> {product.name}</span>
                  </AddToCartButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
