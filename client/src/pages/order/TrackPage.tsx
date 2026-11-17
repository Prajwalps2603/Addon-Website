import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { PageHeader, WhatsAppButton } from '@/components/commerce';
import { Button, Callout, Field, Input } from '@/components/ui';
import { api, isApiError } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { isValidPhone, normalizePhone } from '@/lib/india';
import { useDocumentMeta } from '@/lib/seo';
import type { Order } from '@/types/api';
import { OrderView } from './parts/OrderView';

const schema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(1, { error: 'Enter the order number' })
    .max(40, { error: 'That is longer than any order number' })
    .transform((value) => value.toUpperCase()),
  phone: z
    .string()
    .trim()
    .min(1, { error: 'Enter the phone number you ordered with' })
    .refine(isValidPhone, { error: 'Enter a 10 digit Indian mobile number' })
    .transform((value) => normalizePhone(value) ?? value),
});
type TrackInput = z.input<typeof schema>;
type TrackOutput = z.output<typeof schema>;

/** The server's answer in shopper's words. A miss never says which half was wrong. */
function friendlyError(error: unknown): string | null {
  if (!isApiError(error)) return 'Something went wrong. Try again in a minute.';
  if (error.status === 404 || error.status === 403) {
    return 'No order matches that number and phone. Check both: the number is in your order confirmation, and the phone is the one you gave at checkout.';
  }
  if (error.status === 429) return 'Too many tries in a short time. Wait a few minutes and try again.';
  if (error.status === 0) return 'You seem to be offline. Check your connection and try again.';
  if (error.hasFields) return null;
  return error.message;
}

/**
 * /track: find an order with its number and the phone used to place it. Nothing typed here is
 * stored: the phone is sent once and the order lives in memory until the page is left.
 */
export default function TrackPage() {
  const [params] = useSearchParams();
  const prefilled = params.get('orderNumber')?.trim() ?? '';
  const [order, setOrder] = useState<Order | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useDocumentMeta({
    title: order ? `Order ${order.orderNumber}` : 'Track your order',
    description: 'Find your order with its number and your phone: status, delivery date, tracking and invoice.',
    noindex: Boolean(order),
  });

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<TrackInput, unknown, TrackOutput>({
    resolver: zodResolver(schema),
    defaultValues: { orderNumber: prefilled, phone: '' },
  });

  const lookup = useMutation({
    mutationFn: (values: TrackOutput) => api.orders.track(values),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const found = await lookup.mutateAsync(values);
      setOrder(found);
    } catch (error) {
      const friendly = friendlyError(error);
      const summary = applyApiError(error, setError);
      setFormError(friendly ?? summary);
    }
  });

  useEffect(() => {
    if (order) resultRef.current?.focus();
  }, [order]);

  useEffect(() => {
    if (!order) setFocus(prefilled ? 'phone' : 'orderNumber');
  }, [order, prefilled, setFocus]);

  if (order) {
    return (
      <div className="container-page">
        <div ref={resultRef} tabIndex={-1} className="outline-none">
          <OrderView
            order={order}
            token={order.accessToken}
            onOrderChange={setOrder}
            before={
              <div className="pt-4 md:pt-6">
                <Button variant="link" iconLeft={<ArrowLeft aria-hidden />} onClick={() => { setOrder(null); setFormError(null); }}>
                  Look up another order
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page pb-16">
      <PageHeader title="Track your order" description="Enter the order number and the phone you ordered with. We show the status, the delivery date and the courier's tracking." />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-16">
        <form noValidate onSubmit={onSubmit} className="grid content-start gap-5" aria-describedby={formError ? 'track-error' : undefined}>
          <Field label="Order number" hint="It looks like ADN-261117-K7Q2." error={errors.orderNumber?.message}>
            <Input
              mono
              inputSize="lg"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              {...register('orderNumber')}
            />
          </Field>
          <Field label="Phone number" hint="The mobile number given at checkout." error={errors.phone?.message}>
            <Input inputSize="lg" type="tel" inputMode="tel" autoComplete="tel" leading={<span className="type-small text-muted">+91</span>} {...register('phone')} />
          </Field>
          {formError && (
            <div id="track-error">
              <Callout tone="danger" live>
                {formError}
              </Callout>
            </div>
          )}
          <Button type="submit" size="lg" block loading={lookup.isPending} iconLeft={<Search aria-hidden />}>
            Find my order
          </Button>
        </form>

        <aside aria-labelledby="track-help-heading" className="grid content-start gap-3 border-t border-ink pt-4 lg:border-t-0 lg:border-l lg:border-line lg:pt-0 lg:pl-8">
          <h2 id="track-help-heading" className="type-h3">
            Cannot find the number?
          </h2>
          <p className="type-body max-w-prose text-muted">
            It is on the order page you saw after paying, and in any message we sent about the order. Signed-in customers see every order under My account.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" to="/account/orders">
              My orders
            </Button>
            <WhatsAppButton text="Hi, I need help finding my order.">Ask on WhatsApp</WhatsAppButton>
          </div>
        </aside>
      </div>
    </div>
  );
}
