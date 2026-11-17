import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TicketPercent, X } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import type { ApiError } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { useCart } from '@/stores/cart';
import type { PricedCart } from '@/types/api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Type the coupon code.')
    .max(32, 'That is longer than any of our codes.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Codes are letters and numbers only.'),
});

type CouponInput = z.input<typeof schema>;
type CouponOutput = z.output<typeof schema>;

export interface CouponBoxProps {
  cart: PricedCart;
  /** A newer price (with the code just typed) is on its way. */
  updating: boolean;
  /** The latest pricing error, so a server complaint about the code lands on the field. */
  error: ApiError | null;
  onChange?: (text: string) => void;
}

/** Apply a coupon, see what it took off, remove it. A rejected code shows the server's own reason. */
export function CouponBox({ cart, updating, error, onChange }: CouponBoxProps) {
  const storeCode = useCart((state) => state.couponCode);
  const setCouponCode = useCart((state) => state.setCouponCode);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<CouponInput, unknown, CouponOutput>({ resolver: zodResolver(schema), defaultValues: { code: storeCode } });

  // A code the server refused: its reason goes on the field, once the price for that code is in.
  const rejected = Boolean(storeCode) && !cart.coupon && !updating ? cart.couponError : null;
  useEffect(() => {
    if (rejected) setError('code', { type: 'server', message: rejected });
  }, [rejected, setError]);

  // A validation error from the pricing request itself (for example a malformed code).
  useEffect(() => {
    if (error?.fields && Object.keys(error.fields).length > 0) applyApiError(error, setError, { couponCode: 'code' });
  }, [error, setError]);

  const onSubmit = handleSubmit(({ code }) => {
    clearErrors('code');
    setCouponCode(code);
    onChange?.(`Checking coupon ${code.toUpperCase()}.`);
  });

  const remove = () => {
    setCouponCode('');
    reset({ code: '' });
    onChange?.('Coupon removed.');
  };

  if (cart.coupon) {
    return (
      <div className="grid gap-2">
        <p className="type-small font-bold">Coupon</p>
        <div className="flex items-start justify-between gap-3 border border-fit bg-fit-soft p-3">
          <div className="flex min-w-0 items-start gap-2">
            <TicketPercent aria-hidden className="mt-0.5 size-5 shrink-0 text-fit" />
            <div className="grid min-w-0 gap-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="type-code">{cart.coupon.code}</span>
                <span className="font-bold text-fit tnum">-{formatINR(cart.coupon.discount)}</span>
              </p>
              {cart.coupon.description && <p className="type-small text-muted">{cart.coupon.description}</p>}
            </div>
          </div>
          <Button variant="ghost" size="sm" iconLeft={<X aria-hidden />} onClick={remove} aria-label={`Remove coupon ${cart.coupon.code}`}>
            Remove
          </Button>
        </div>
      </div>
    );
  }

  const checking = Boolean(storeCode) && updating;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-2">
      <Field label="Coupon code" error={errors.code?.message}>
        <div className="flex gap-2">
          <Input mono autoComplete="off" autoCapitalize="characters" spellCheck={false} className="min-w-0 flex-1" {...register('code')} />
          <Button type="submit" variant="dark" loading={checking}>
            Apply
          </Button>
        </div>
      </Field>
      {rejected && (
        <Button variant="link" size="sm" onClick={remove} className="justify-self-start">
          Clear the code
        </Button>
      )}
    </form>
  );
}
