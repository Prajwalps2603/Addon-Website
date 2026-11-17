import { zodResolver } from '@hookform/resolvers/zod';
import { Truck } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button, Callout, Drawer, Field, Input } from '@/components/ui';
import { applyApiError } from '@/lib/forms';
import type { Order } from '@/types/api';
import { useOrderUpdate } from './useOrderUpdate';

/** Couriers most Indian sellers use. Suggestions only: any name can be typed. */
const CARRIERS = ['Delhivery', 'Blue Dart', 'DTDC', 'India Post Speed Post', 'Ekart', 'Xpressbees', 'Shadowfax', 'Ecom Express', 'Professional Couriers', 'Shiprocket'];

const schema = z.object({
  carrier: z.string().trim().min(2, { error: 'Name the courier' }).max(80),
  number: z.string().trim().min(3, { error: 'Enter the tracking or AWB number' }).max(80),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), { error: 'Paste the full link, starting with https://' }),
});
type Values = z.infer<typeof schema>;

export interface ShippingDrawerProps {
  order: Order;
  open: boolean;
  /** `ship` marks the order shipped with the tracking; `edit` only corrects the tracking. */
  mode: 'ship' | 'edit';
  onClose: () => void;
}

export function ShippingDrawer({ order, open, mode, onClose }: ShippingDrawerProps) {
  const formId = useId();
  const listId = useId();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({ carrier: order.tracking.carrier, number: order.tracking.number, url: order.tracking.url });
      setFormError('');
    }
  }, [open, order.tracking, reset]);

  const update = useOrderUpdate(order.orderNumber, onClose);

  const submit = handleSubmit((values) => {
    setFormError('');
    update.mutate(
      {
        body: {
          ...(mode === 'ship' ? { status: 'shipped' as const } : {}),
          trackingCarrier: values.carrier,
          trackingNumber: values.number,
          trackingUrl: values.url,
        },
        success: mode === 'ship' ? `Order ${order.orderNumber} marked shipped` : 'Tracking updated',
        description: `${values.carrier}, ${values.number}`,
      },
      {
        onError: (error) =>
          setFormError(
            applyApiError(error, setError, { trackingCarrier: 'carrier', trackingNumber: 'number', trackingUrl: 'url' }),
          ),
      },
    );
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mode === 'ship' ? 'Mark shipped' : 'Edit tracking'}
      description={mode === 'ship' ? 'The customer gets the courier and tracking number by email.' : order.orderNumber}
      footer={
        <Button type="submit" form={formId} size="lg" block variant={mode === 'ship' ? 'primary' : 'dark'} iconLeft={<Truck aria-hidden />} loading={update.isPending}>
          {mode === 'ship' ? 'Mark shipped' : 'Save tracking'}
        </Button>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-4">
        {formError && (
          <Callout tone="danger" live>
            {formError}
          </Callout>
        )}
        <Field label="Courier" error={errors.carrier?.message} required>
          <Input list={listId} autoComplete="off" autoCapitalize="words" {...register('carrier')} />
        </Field>
        <datalist id={listId}>
          {CARRIERS.map((carrier) => (
            <option key={carrier} value={carrier} />
          ))}
        </datalist>
        <Field label="Tracking number" hint="The AWB or consignment number on the label." error={errors.number?.message} required>
          <Input mono autoComplete="off" autoCapitalize="characters" spellCheck={false} {...register('number')} />
        </Field>
        <Field label="Tracking link" optional hint="The courier's page for this parcel." error={errors.url?.message}>
          <Input type="url" inputMode="url" autoComplete="off" placeholder="https://" {...register('url')} />
        </Field>
      </form>
    </Drawer>
  );
}
