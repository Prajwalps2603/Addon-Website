import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Button, Callout, Drawer, Field, Input, Segmented, Switch, toast } from '@/components/ui';
import { errorMessage, api } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { queryKeys } from '@/lib/queryKeys';
import type { Coupon, CouponInput } from '@/types/api';
import { istDay, istDayEnd, istDayStart } from './dates';

const digits = z.string().trim().regex(/^\d*$/, { error: 'Whole rupees, digits only' });

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,23}$/, { error: '3 to 24 letters or digits, no spaces' }),
    description: z.string().trim().max(140, { error: 'Keep it under 140 characters' }),
    type: z.enum(['percent', 'flat', 'free_shipping']),
    value: digits,
    minOrder: digits,
    maxDiscount: digits,
    startsAt: z.string(),
    endsAt: z.string(),
    usageLimit: digits,
    isActive: z.boolean(),
  })
  .superRefine((form, ctx) => {
    const value = Number(form.value || 0);
    if (form.type === 'percent' && (value < 1 || value > 90)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Between 1 and 90 percent' });
    }
    if (form.type === 'flat' && value < 1) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter the rupees off' });
    }
    if (form.type === 'flat' && form.minOrder && value >= Number(form.minOrder)) {
      ctx.addIssue({ code: 'custom', path: ['minOrder'], message: 'Set the minimum order above the amount off' });
    }
    if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end is before the start' });
    }
    if (form.usageLimit && Number(form.usageLimit) < 1) {
      ctx.addIssue({ code: 'custom', path: ['usageLimit'], message: 'At least 1, or leave it blank for no limit' });
    }
  });
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

function toForm(coupon: Coupon | null): Values {
  return {
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    type: coupon?.type ?? 'percent',
    value: coupon && coupon.type !== 'free_shipping' ? String(coupon.value) : '',
    minOrder: coupon?.minOrder ? String(coupon.minOrder) : '',
    maxDiscount: coupon?.maxDiscount ? String(coupon.maxDiscount) : '',
    startsAt: istDay(coupon?.startsAt),
    endsAt: istDay(coupon?.endsAt),
    usageLimit: coupon?.usageLimit ? String(coupon.usageLimit) : '',
    isActive: coupon?.isActive ?? true,
  };
}

function toInput(form: Output): CouponInput {
  const percent = form.type === 'percent';
  return {
    code: form.code,
    description: form.description,
    type: form.type,
    value: form.type === 'free_shipping' ? 0 : Number(form.value || 0),
    minOrder: Number(form.minOrder || 0),
    maxDiscount: percent && form.maxDiscount ? Number(form.maxDiscount) : null,
    startsAt: form.startsAt ? istDayStart(form.startsAt) : null,
    endsAt: form.endsAt ? istDayEnd(form.endsAt) : null,
    usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
    isActive: form.isActive,
  };
}

/** One plain line for what a coupon does: "10% off, up to ₹500, on orders over ₹2,000". */
export function couponSummary(coupon: Pick<Coupon, 'type' | 'value' | 'maxDiscount' | 'minOrder'>): string {
  const what =
    coupon.type === 'percent'
      ? `${coupon.value}% off${coupon.maxDiscount ? `, up to ${formatINR(coupon.maxDiscount)}` : ''}`
      : coupon.type === 'flat'
        ? `${formatINR(coupon.value)} off`
        : 'Free delivery';
  return coupon.minOrder > 0 ? `${what}, on orders of ${formatINR(coupon.minOrder)} or more` : what;
}

const TYPE_OPTIONS = [
  { value: 'percent' as const, label: 'Percent' },
  { value: 'flat' as const, label: 'Rupees' },
  { value: 'free_shipping' as const, label: 'Free delivery' },
];

export interface CouponDrawerProps {
  open: boolean;
  /** null creates a new coupon. */
  coupon: Coupon | null;
  onClose: () => void;
}

export function CouponDrawer({ open, coupon, onClose }: CouponDrawerProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values, unknown, Output>({ resolver: zodResolver(schema), defaultValues: toForm(null) });

  useEffect(() => {
    if (open) {
      reset(toForm(coupon));
      setFormError('');
    }
  }, [open, coupon, reset]);

  const type = useWatch({ control, name: 'type' });
  const value = useWatch({ control, name: 'value' });
  const minOrder = useWatch({ control, name: 'minOrder' });
  const maxDiscount = useWatch({ control, name: 'maxDiscount' });

  const save = useMutation({
    mutationFn: (input: CouponInput) => (coupon ? api.admin.coupons.update(coupon.id, input) : api.admin.coupons.create(input)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.coupons() });
      toast.success(coupon ? `Coupon ${saved.code} updated` : `Coupon ${saved.code} created`, { description: couponSummary(saved) });
      onClose();
    },
    onError: (error) => {
      setFormError(applyApiError(error, setError));
      toast.error('Could not save the coupon', { description: errorMessage(error) });
    },
  });

  const preview = couponSummary({
    type: type ?? 'percent',
    value: Number(value || 0),
    maxDiscount: maxDiscount ? Number(maxDiscount) : null,
    minOrder: Number(minOrder || 0),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={coupon ? `Edit ${coupon.code}` : 'New coupon'}
      description={coupon ? `Used ${coupon.usedCount} ${coupon.usedCount === 1 ? 'time' : 'times'} so far.` : 'Customers type the code in the cart.'}
      size="md"
      footer={
        <Button type="submit" form={formId} size="lg" block loading={save.isPending}>
          {coupon ? 'Save coupon' : 'Create coupon'}
        </Button>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError('');
          save.mutate(toInput(values));
        })}
        className="grid gap-5"
      >
        {formError && (
          <Callout tone="danger" live>
            {formError}
          </Callout>
        )}
        <Field label="Code" hint="Letters and digits. Shown in capitals." error={errors.code?.message} required>
          <Input mono autoComplete="off" autoCapitalize="characters" spellCheck={false} {...register('code')} />
        </Field>
        <Field label="Description" optional hint="What the customer sees when it applies." error={errors.description?.message}>
          <Input autoComplete="off" {...register('description')} />
        </Field>

        <div className="grid gap-2">
          <p className="type-label text-muted" aria-hidden>
            Discount
          </p>
          <Controller
            control={control}
            name="type"
            render={({ field }) => <Segmented label="Discount" options={TYPE_OPTIONS} value={field.value} onChange={field.onChange} block />}
          />
        </div>

        {type !== 'free_shipping' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={type === 'percent' ? 'Percent off' : 'Rupees off'} error={errors.value?.message} required>
              <Input inputMode="numeric" className="tnum" leading={type === 'flat' ? '₹' : undefined} trailing={type === 'percent' ? '%' : undefined} {...register('value')} />
            </Field>
            {type === 'percent' && (
              <Field label="Cap" optional hint="Most it takes off." error={errors.maxDiscount?.message}>
                <Input inputMode="numeric" className="tnum" leading="₹" {...register('maxDiscount')} />
              </Field>
            )}
          </div>
        )}
        <Field label="Minimum order" optional hint="Items total before delivery." error={errors.minOrder?.message}>
          <Input inputMode="numeric" className="tnum" leading="₹" {...register('minOrder')} />
        </Field>

        <p className="type-small bg-surface p-3">
          <span className="font-bold">Reads as: </span>
          {preview}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" optional hint="From 00:00" error={errors.startsAt?.message}>
            <Input type="date" className="tnum" {...register('startsAt')} />
          </Field>
          <Field label="Ends" optional hint="Until 23:59" error={errors.endsAt?.message}>
            <Input type="date" className="tnum" {...register('endsAt')} />
          </Field>
        </div>
        <Field label="Usage limit" optional hint="Total uses across all customers. Blank for no limit." error={errors.usageLimit?.message}>
          <Input inputMode="numeric" className="tnum" {...register('usageLimit')} />
        </Field>
        <Switch label="Active" description="Off: the code stops working at once." {...register('isActive')} />
      </form>
    </Drawer>
  );
}
