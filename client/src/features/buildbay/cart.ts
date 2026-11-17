import { toast } from '@/components/ui';
import { capitalize, pluralize } from '@/lib/format';
import { MAX_CART_LINES, cartLineKey, useCart } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import type { ProductSummary } from '@/types/api';
import { markForStudio } from './studio';

export interface BuildCartResult {
  added: ProductSummary[];
  alreadyIn: ProductSummary[];
  /** Products with sizes or colours to choose: these open on their own page. */
  needChoice: ProductSummary[];
  soldOut: ProductSummary[];
  cartFull: ProductSummary[];
}

/** Products in a build that can go straight into the cart and the ones that need a choice first. */
export function splitForCart(products: readonly ProductSummary[]): { direct: ProductSummary[]; needChoice: ProductSummary[] } {
  const direct: ProductSummary[] = [];
  const needChoice: ProductSummary[] = [];
  for (const product of products) (product.hasVariants || product.customKind ? needChoice : direct).push(product);
  return { direct, needChoice };
}

/**
 * Adds every product of a build to the cart once: a product already in the cart is left as it is.
 * Products with variants are not added; the caller links to them so the shopper can choose.
 */
export function addBuildToCart(products: readonly ProductSummary[], options: { fitAtStudio?: boolean } = {}): BuildCartResult {
  const result: BuildCartResult = { added: [], alreadyIn: [], needChoice: [], soldOut: [], cartFull: [] };
  const seen = new Set<number>();
  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    if (product.hasVariants || product.customKind) {
      result.needChoice.push(product);
      continue;
    }
    if (!product.inStock) {
      result.soldOut.push(product);
      continue;
    }
    const cart = useCart.getState();
    const key = cartLineKey({ productId: product.id, variantId: null, custom: null });
    if (cart.lines.some((line) => cartLineKey(line) === key)) {
      result.alreadyIn.push(product);
      continue;
    }
    if (cart.lines.length >= MAX_CART_LINES) {
      result.cartFull.push(product);
      continue;
    }
    cart.add({ productId: product.id, variantId: null, qty: 1 });
    result.added.push(product);
  }

  if (options.fitAtStudio) markForStudio([...result.added, ...result.alreadyIn].map((product) => product.id));

  const notes: string[] = [];
  if (options.fitAtStudio && (result.added.length || result.alreadyIn.length)) notes.push('marked for fitting at our studio; choose the slot at checkout');
  if (result.alreadyIn.length) notes.push(`${pluralize(result.alreadyIn.length, 'part')} already in your cart`);
  if (result.needChoice.length) notes.push(`${pluralize(result.needChoice.length, 'part')} ${result.needChoice.length === 1 ? 'needs a size or colour chosen on its page' : 'need a size or colour chosen on their pages'}`);
  if (result.soldOut.length) notes.push(`${pluralize(result.soldOut.length, 'part')} sold out`);
  if (result.cartFull.length) notes.push(`cart full, ${pluralize(result.cartFull.length, 'part')} left out`);
  const description = notes.length ? `${capitalize(notes.join('; '))}.` : undefined;

  if (result.added.length || (options.fitAtStudio && result.alreadyIn.length)) {
    toast.success(result.added.length ? `Added ${pluralize(result.added.length, 'part')} to your cart` : 'Parts in your cart marked for fitting', { description, id: 'build-cart' });
    useUi.getState().openCart();
  } else {
    toast.info('Nothing new to add', { description: description ?? 'This build has no parts from the catalogue yet.', id: 'build-cart' });
  }
  return result;
}
