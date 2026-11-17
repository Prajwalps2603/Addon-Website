import { zodResolver } from '@hookform/resolvers/zod';
import { useWatch } from 'react-hook-form';
import * as z from 'zod';
import { CircleCheck, CircleDashed } from 'lucide-react';
import { Badge, Callout, Field, Input, Switch } from '@/components/ui';
import { formatINR } from '@/lib/format';
import type { AdminSettings } from '@/types/api';
import { FieldGroup, numberOf, percent, rupees, SettingsForm, ShopperPreview, text, useSectionForm } from './shared';

const schema = z.object({
  cod: z
    .object({
      enabled: z.boolean(),
      fee: rupees(),
      minOrder: rupees(),
      maxOrder: rupees(),
      advancePercent: percent(90, true),
    })
    .refine((cod) => cod.maxOrder === 0 || cod.maxOrder >= cod.minOrder, {
      path: ['maxOrder'],
      error: 'The upper limit must be above the lower limit. Use 0 for no upper limit.',
    }),
  prepaidDiscountPercent: percent(50, false),
  payments: z.object({
    upiId: z
      .string()
      .trim()
      .refine((value) => value === '' || /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$/.test(value), {
        error: 'Enter a UPI ID such as shopname@okhdfcbank, or leave it blank.',
      }),
    upiPayeeName: text(80),
  }),
});

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** The order value the examples are worked on. */
const EXAMPLE_ORDER = 2000;
const rupee = <span aria-hidden>₹</span>;

const RAZORPAY_VARIABLES = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const;

export function PaymentsSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm: (s) => ({
      cod: { ...s.cod },
      prepaidDiscountPercent: s.prepaidDiscountPercent,
      payments: { upiId: s.payments.upiId, upiPayeeName: s.payments.upiPayeeName },
    }),
    toPatch: (values) => values,
    name: 'Payments',
  });
  const {
    register,
    control,
    formState: { errors },
  } = section.form;
  const cod = useWatch({ control, name: 'cod' });
  const prepaid = numberOf(useWatch({ control, name: 'prepaidDiscountPercent' }));
  const upiId = (useWatch({ control, name: 'payments.upiId' }) ?? '').trim();

  const codOn = Boolean(cod?.enabled);
  const fee = numberOf(cod?.fee);
  const advance = numberOf(cod?.advancePercent);
  const minOrder = numberOf(cod?.minOrder);
  const maxOrder = numberOf(cod?.maxOrder);

  // The same sums as server/src/lib/pricing.js.
  const codTotal = EXAMPLE_ORDER + (Number.isNaN(fee) ? 0 : fee);
  const payNow = advance > 0 ? Math.ceil((codTotal * advance) / 100) : 0;
  const prepaidSaving = prepaid > 0 ? Math.round((EXAMPLE_ORDER * prepaid) / 100) : 0;

  const codSentence = !codOn
    ? 'Cash on delivery is not offered.'
    : [
        fee > 0 ? `Cash on delivery costs ${formatINR(fee)} extra.` : 'Cash on delivery costs nothing extra.',
        payNow > 0
          ? `On a ${formatINR(EXAMPLE_ORDER)} order you pay ${formatINR(payNow)} online now and ${formatINR(codTotal - payNow)} to the courier.`
          : null,
        minOrder > 0 && maxOrder > 0
          ? `Available on orders from ${formatINR(minOrder)} to ${formatINR(maxOrder)}.`
          : minOrder > 0
            ? `Available on orders from ${formatINR(minOrder)}.`
            : maxOrder > 0
              ? `Available on orders up to ${formatINR(maxOrder)}.`
              : null,
      ]
        .filter(Boolean)
        .join(' ');

  const razorpay = settings.payments.razorpay;
  const keyId = settings.payments.razorpayKeyId;
  const e = errors.cod;

  return (
    <SettingsForm
      id="payments"
      title="Payments"
      description="Every way to pay is priced in rupees side by side at checkout, so a fee or a discount set here is shown before the shopper chooses."
      section={section}
      saveLabel="Save payments"
    >
      <FieldGroup title="Cash on delivery">
        <Switch
          label="Offer cash on delivery"
          description="Only on products marked as COD eligible."
          labelFirst
          {...register('cod.enabled')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="COD fee" error={e?.fee?.message} hint="Added to the order and shown before checkout. 0 for none.">
            <Input inputMode="numeric" className="tnum" leading={rupee} {...register('cod.fee')} />
          </Field>
          <Field
            label="Advance paid online"
            error={e?.advancePercent?.message}
            hint={
              payNow > 0
                ? `On a ${formatINR(EXAMPLE_ORDER)} order with the fee: ${formatINR(payNow)} now, ${formatINR(codTotal - payNow)} to the courier.`
                : 'Percent of the total paid up front to cut fake orders. 0 for plain cash on delivery.'
            }
          >
            <Input inputMode="numeric" className="tnum" trailing={<span aria-hidden>%</span>} {...register('cod.advancePercent')} />
          </Field>
          <Field label="Smallest order" error={e?.minOrder?.message} hint="0 for no lower limit.">
            <Input inputMode="numeric" className="tnum" leading={rupee} {...register('cod.minOrder')} />
          </Field>
          <Field label="Largest order" error={e?.maxOrder?.message} hint="0 for no upper limit.">
            <Input inputMode="numeric" className="tnum" leading={rupee} {...register('cod.maxOrder')} />
          </Field>
        </div>
        <ShopperPreview>{codSentence}</ShopperPreview>
      </FieldGroup>

      <FieldGroup title="Paying online">
        <Field
          label="Discount for paying online in full"
          error={errors.prepaidDiscountPercent?.message}
          hint={
            prepaidSaving > 0
              ? `Percent off the parts. On ${formatINR(EXAMPLE_ORDER)} of parts that is ${formatINR(prepaidSaving)} off. Not given on quotes.`
              : 'Percent off the parts for UPI or card payments. 0 for none.'
          }
        >
          <Input inputMode="decimal" className="tnum sm:max-w-48" trailing={<span aria-hidden>%</span>} {...register('prepaidDiscountPercent')} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Direct UPI">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="UPI ID" optional error={errors.payments?.upiId?.message} hint="Leave blank to stop offering direct UPI.">
            <Input mono autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="shopname@okhdfcbank" {...register('payments.upiId')} />
          </Field>
          <Field label="Payee name" optional error={errors.payments?.upiPayeeName?.message} hint="The name the shopper's UPI app shows.">
            <Input {...register('payments.upiPayeeName')} />
          </Field>
        </div>
        <Callout tone="info" title={upiId ? 'You check these payments by hand' : 'Direct UPI is off'}>
          {upiId
            ? 'The shopper pays from any UPI app and types the 12-digit reference number. Nothing confirms the money to the shop automatically: check your bank app before you mark the order paid. These orders wait in Follow-ups under UPI to verify.'
            : 'Add a UPI ID to let shoppers pay straight to your account, with no gateway fee.'}
        </Callout>
      </FieldGroup>

      <FieldGroup title="Cards, netbanking and wallets (Razorpay)">
        <div className="grid gap-3 border border-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            {razorpay ? (
              <Badge tone="fit" icon={<CircleCheck aria-hidden />}>
                Connected
              </Badge>
            ) : (
              <Badge tone="neutral" icon={<CircleDashed aria-hidden />}>
                Not set up
              </Badge>
            )}
            {razorpay && keyId.startsWith('rzp_test_') && <Badge tone="warn">Test mode: no real money moves</Badge>}
            {razorpay && keyId && <span className="type-code text-muted">{keyId}</span>}
          </div>
          <p className="type-small max-w-prose text-muted">
            {razorpay
              ? 'Shoppers can pay by card, netbanking and wallets. The keys live in the server’s environment file, not here.'
              : 'The keys are not stored in settings: they go in the server’s environment file (.env), then the server is restarted. Until then, checkout offers UPI and cash on delivery only.'}
          </p>
          <ul aria-label="Environment variables" className="flex flex-wrap gap-2">
            {RAZORPAY_VARIABLES.map((name) => (
              <li key={name} className="type-code rounded-control bg-surface px-2 py-1">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </FieldGroup>
    </SettingsForm>
  );
}
