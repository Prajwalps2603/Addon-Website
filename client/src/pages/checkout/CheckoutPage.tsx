import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CircleAlert, Loader2, Lock, ShieldCheck, ShoppingCart } from 'lucide-react';
import { EmiNote } from '@/components/cart/EmiNote';
import { fittableLines, setStoreFitAtStudio } from '@/components/cart/studioFit';
import { ErrorState, PageHeader } from '@/components/commerce';
import PaymentPanel from '@/components/payment/PaymentPanel';
import type { CarValue, SlotValue } from '@/components/studio';
import { Accordion, AccordionItem, Button, Callout, Checkbox, EmptyState, Field, Input, Skeleton, Textarea } from '@/components/ui';
import { useActiveCar, useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useMe } from '@/hooks/useMe';
import { useSettings } from '@/hooks/useSettings';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { isValidPhone, isValidPincode, isValidState, normalizePhone } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { isInAppBrowser } from '@/lib/razorpay';
import { useDocumentMeta } from '@/lib/seo';
import { cartLineKey, useCart } from '@/stores/cart';
import { useCheckout } from '@/stores/checkout';
import type {
  Address,
  CartLineInput,
  CreateOrderRequest,
  CreateOrderResponse,
  Fulfilment,
  Order,
  PaymentInstruction,
  PaymentMethod,
  PricedCart,
  PricedLine,
  QuoteView,
} from '@/types/api';
import { AddressSection, NEW_ADDRESS, savedKey } from './parts/AddressSection';
import { CheckoutStage } from './parts/CheckoutStage';
import { FulfilmentSection } from './parts/FulfilmentSection';
import { OrderSummary } from './parts/OrderSummary';
import { orderPath, recentOrder, rememberOrderToken } from './parts/orderTokens';
import { PaymentOptions } from './parts/PaymentOptions';
import { QuoteBoard, QuoteClosed, QuoteEmpty, QuoteNotFound } from './parts/QuoteStates';
import { checkoutSchema, type CheckoutValues } from './parts/schema';
import { StudioFittingStep, StudioWhere } from './parts/StudioStep';
import { useCheckoutLead } from './parts/useCheckoutLead';
import { useCheckoutPrice } from './parts/useCheckoutPrice';
import { VehicleSection } from './parts/VehicleSection';

const FORM_ID = 'checkout-form';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGISTRATION = /^[A-Za-z0-9 -]{4,16}$/;

type Placed = { order: Order; payment: Exclude<PaymentInstruction, null> };

// ---------------------------------------------------------------------------
// Loading and empty states
// ---------------------------------------------------------------------------

function CheckoutSkeleton() {
  return (
    <div className="container-page pb-16" aria-busy="true" aria-label="Loading checkout">
      <div className="grid gap-3 pt-6 pb-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-56" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-8">
          {[0, 1, 2].map((n) => (
            <div key={n} className="grid gap-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="hidden h-96 w-full lg:block" />
      </div>
    </div>
  );
}

function EmptyCheckout() {
  const recent = useMemo(() => recentOrder(), []);
  return (
    <div className="container-page section-y">
      <EmptyState
        art={<ShoppingCart aria-hidden strokeWidth={1.5} className="size-14 text-line-strong" />}
        title="Nothing to check out"
        description={
          recent
            ? `Your cart is empty. Order ${recent.orderNumber} from this browser is saved: open it to see where it is or to finish paying.`
            : 'Your cart is empty. Add parts first, then come back here to order them.'
        }
        actions={
          <>
            {recent && (
              <Button to={orderPath(recent.orderNumber, recent.token)} variant="dark">
                Open order {recent.orderNumber}
              </Button>
            )}
            <Button to="/shop" variant={recent ? 'outline' : 'dark'}>
              Browse parts
            </Button>
          </>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// After the order exists: take the payment
// ---------------------------------------------------------------------------

function PayStep({ order, payment }: Placed) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const target = (isNew: boolean) => orderPath(order.orderNumber, order.accessToken, isNew);

  const paid = (updated: Order) => {
    queryClient.setQueryData(queryKeys.orders.detail(updated.orderNumber, order.accessToken ?? null), { ...updated, accessToken: updated.accessToken ?? order.accessToken });
    navigate(target(true), { replace: true });
  };

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title={`Order ${order.orderNumber}`}
        description={
          order.fulfilment === 'studio'
            ? 'Your order is saved and your studio slot is held. Pay to confirm it.'
            : 'Your order is saved and the parts are held for you. Pay to confirm it.'
        }
      />
      <div className="grid max-w-xl gap-6">
        <PaymentPanel order={order} instruction={payment} onPaid={paid} autoOpen onDismiss={() => navigate(target(false), { replace: true })} />
        <p className="type-small text-muted">
          Need to step away?{' '}
          <Link to={target(false)} className="link">
            Pay later from the order page
          </Link>
          . This browser remembers the order.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The place-order block (end of the form on a phone, under the summary on a computer)
// ---------------------------------------------------------------------------

interface PlaceOrderProps {
  cart: PricedCart | undefined;
  method: PaymentMethod | null;
  fulfilment: Fulfilment;
  submitting: boolean;
  formError: string | null;
  stockError: string | null;
  showTotal: boolean;
}

function PlaceOrder({ cart, method, fulfilment, submitting, formError, stockError }: PlaceOrderProps) {
  const option = cart?.paymentOptions.find((item) => item.method === method);
  const payNow = option?.payNow ?? cart?.payNow ?? 0;
  const total = option?.total ?? cart?.total ?? 0;
  const label = payNow > 0 ? `Pay ${formatINR(payNow)} and place order` : 'Place order';
  const howToPay =
    payNow > 0 && option && option.dueOnDelivery > 0
      ? `${formatINR(payNow)} now, ${formatINR(option.dueOnDelivery)} ${fulfilment === 'delivery' ? 'to the courier' : 'at the studio'}`
      : payNow > 0
        ? 'Paid online now'
        : option && option.dueOnDelivery > 0
          ? fulfilment === 'delivery'
            ? `Keep ${formatINR(option.dueOnDelivery)} ready for the courier`
            : `Pay ${formatINR(option.dueOnDelivery)} at the studio`
          : '';

  return (
    <div className="grid gap-3">
      {stockError && (
        <Callout tone="danger" live title="Part of your order just sold out">
          {stockError}
        </Callout>
      )}
      {formError && (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-stop">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </p>
      )}

      <div className="relative isolate overflow-hidden rounded-[20px] bg-black p-5 text-white sm:p-7">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-brand/35 blur-3xl" />
        <span aria-hidden className="tread pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2 opacity-15" />

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-white/55 uppercase">Total to pay</p>
            <p className="mt-1 font-display text-[clamp(2rem,5vw,2.75rem)] leading-none font-black italic tnum [font-stretch:85%]">
              {cart ? formatINR(total) : '…'}
            </p>
            {howToPay && <p className="mt-2 text-sm text-white/70">{howToPay}</p>}
            {fulfilment === 'studio' && <p className="mt-1 text-sm text-white/70">Placing the order books your studio slot.</p>}
          </div>

          <button
            type="submit"
            form={FORM_ID}
            disabled={!cart || submitting}
            aria-busy={submitting || undefined}
            className="group/po relative inline-flex h-14 shrink-0 items-center justify-center gap-2.5 overflow-hidden rounded-full bg-brand px-8 font-display text-lg font-black text-brand-ink uppercase italic transition-[transform,background-color] duration-300 hover:bg-brand-press active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-64"
          >
            {/* A light that sweeps across the button on hover. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-[left,opacity] duration-700 ease-out group-hover/po:left-[120%] group-hover/po:opacity-100 motion-reduce:hidden"
            />
            {submitting ? (
              <>
                <Loader2 aria-hidden className="size-5 animate-spin" />
                Placing order
              </>
            ) : (
              <>
                <Lock aria-hidden className="size-4" />
                {label}
                <ArrowRight aria-hidden className="size-5 transition-transform duration-300 group-hover/po:translate-x-1" />
              </>
            )}
          </button>
        </div>

        <p className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs text-white/55">
          <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-white/70" />
          <span>
            Prices include GST. By placing the order you accept the{' '}
            <Link to="/policies/terms" className="underline underline-offset-2 hover:text-white">
              terms
            </Link>{' '}
            and the{' '}
            <Link to="/policies/returns" className="underline underline-offset-2 hover:text-white">
              returns policy
            </Link>
            .
          </span>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

function addressComplete(address: Partial<CheckoutValues['shippingAddress']> | undefined): boolean {
  if (!address) return false;
  return (
    (address.name ?? '').trim().length >= 2 &&
    isValidPhone(address.phone) &&
    (address.line1 ?? '').trim().length >= 3 &&
    (address.line2 ?? '').trim().length >= 3 &&
    isValidPincode(address.pincode) &&
    (address.city ?? '').trim().length >= 2 &&
    isValidState(address.state ?? '')
  );
}

function sameAddress(a: Pick<Address, 'line1' | 'pincode'>, b: { line1: string; pincode: string }): boolean {
  return a.line1.trim().toLowerCase() === b.line1.trim().toLowerCase() && a.pincode.trim() === b.pincode.trim();
}

function carComplete(car: CarValue | null): boolean {
  if (!car) return false;
  return car.kind === 'catalogue' || car.label.trim().length >= 3;
}

const STEP_TITLES: Record<Fulfilment, string> = {
  delivery: 'Delivery address',
  pickup: 'Collect from the studio',
  studio: 'Your car and fitting slot',
};

const NOTE_HINTS: Record<Fulfilment, string> = {
  delivery: 'Delivery timing, a gate code, anything we should know.',
  pickup: 'Who is collecting, or anything we should know.',
  studio: 'Anything about the car or the fitting we should know.',
};

interface CheckoutFormProps {
  quote: QuoteView | null;
  onQuoteExpired: () => void;
  onPlaced: (placed: Placed) => void;
}

function CheckoutForm({ quote, onQuoteExpired, onPlaced }: CheckoutFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useMe();
  const settings = useSettings().data;
  const studioOn = settings?.studio.enabled ?? false;
  const storeLines = useCart((state) => state.lines);
  const couponCode = useCart((state) => state.couponCode);
  const activeVehicle = useActiveVehicle();
  const activeCar = useActiveCar();
  const storedMethod = useCheckout((state) => state.paymentMethod);
  const [forCar, setForCar] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [switchedNote, setSwitchedNote] = useState<string | null>(null);
  const [inApp] = useState(() => (typeof navigator === 'undefined' ? false : isInAppBrowser()));

  // Which lines are fitted at the studio. Cart lines carry the flag in the cart store; a quote's lines
  // are fixed, so their flags live here.
  const [quoteFit, setQuoteFit] = useState<Set<string>>(
    () => new Set((quote?.items ?? []).filter((item) => item.fitAtStudio).map((item) => cartLineKey(item))),
  );
  const items: CartLineInput[] = useMemo(() => {
    if (!quote) return storeLines;
    return quote.items.map((item) => {
      const next: CartLineInput = { ...item };
      if (quoteFit.has(cartLineKey(item))) next.fitAtStudio = true;
      else delete next.fitAtStudio;
      return next;
    });
  }, [quote, quoteFit, storeLines]);
  const fitKeys = useMemo(() => new Set(items.filter((item) => item.fitAtStudio).map((item) => cartLineKey(item))), [items]);
  const setFitKeys = useCallback(
    (keys: ReadonlySet<string> | 'none') => {
      if (quote) setQuoteFit(keys === 'none' ? new Set() : new Set(keys));
      else setStoreFitAtStudio(keys);
    },
    [quote],
  );

  // The draft from the checkout store, read once: the form owns the values from here and writes them back.
  const [draft] = useState(() => useCheckout.getState());
  const form = useForm<CheckoutValues, unknown, CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onTouched',
    defaultValues: {
      fulfilment: items.some((item) => item.fitAtStudio) ? 'studio' : 'delivery',
      contact: { ...draft.contact },
      shippingAddress: { ...draft.address },
      registrationNumber: '',
      wantsGstInvoice: draft.gstin !== '',
      gstin: draft.gstin,
      notes: draft.notes,
      saveAddress: false,
    },
  });
  const {
    register,
    control,
    setValue,
    getValues,
    setError,
    clearErrors,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  // Keep the draft in the checkout store so a refresh loses nothing, and let the receiver
  // follow the contact until the shopper types a different receiver.
  const lastContact = useRef({ name: draft.contact.name, phone: draft.contact.phone });
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      const contact = values.contact ?? {};
      const address = values.shippingAddress ?? {};
      if (name?.startsWith('contact.')) {
        const before = lastContact.current;
        if ((address.name ?? '') === '' || address.name === before.name) setValue('shippingAddress.name', contact.name ?? '');
        if ((address.phone ?? '') === '' || address.phone === before.phone) setValue('shippingAddress.phone', contact.phone ?? '');
        lastContact.current = { name: contact.name ?? '', phone: contact.phone ?? '' };
      }
      const store = useCheckout.getState();
      store.setContact({ name: contact.name ?? '', email: contact.email ?? '', phone: contact.phone ?? '' });
      store.setAddress({
        name: address.name ?? '',
        phone: address.phone ?? '',
        line1: address.line1 ?? '',
        line2: address.line2 ?? '',
        landmark: address.landmark ?? '',
        city: address.city ?? '',
        state: address.state ?? '',
        pincode: address.pincode ?? '',
      });
      store.setDetails({ gstin: values.wantsGstInvoice ? (values.gstin ?? '') : '', notes: values.notes ?? '' });
    });
    return () => subscription.unsubscribe();
  }, [form, setValue]);

  // Signed in: fill what is still empty from the account.
  const user = me.user;
  useEffect(() => {
    if (!user) return;
    const fill = (path: 'contact.name' | 'contact.email' | 'contact.phone', value: string) => {
      if (value && !getValues(path)) setValue(path, value, { shouldDirty: true });
    };
    fill('contact.name', user.name);
    fill('contact.email', user.email);
    fill('contact.phone', user.phone);
  }, [user, getValues, setValue]);

  // How the order reaches the shopper. The studio options exist only while the studio takes bookings.
  const chosen = useWatch({ control, name: 'fulfilment' }) ?? 'delivery';
  const fulfilment: Fulfilment = studioOn ? chosen : 'delivery';
  const isDelivery = fulfilment === 'delivery';
  const isStudio = fulfilment === 'studio';

  // A line marked for fitting (in the cart, Build Bay or a kit) makes it a studio order.
  useEffect(() => {
    if (studioOn && fitKeys.size > 0 && chosen !== 'studio') setValue('fulfilment', 'studio');
  }, [studioOn, fitKeys, chosen, setValue]);
  // The studio paused bookings: nothing can be fitted, and the order is delivered.
  useEffect(() => {
    if (settings && !studioOn && chosen !== 'delivery') setValue('fulfilment', 'delivery');
  }, [settings, studioOn, chosen, setValue]);

  // Saved addresses
  const addressesQuery = useQuery({
    queryKey: queryKeys.account.addresses(),
    queryFn: ({ signal }) => api.account.addresses.list({ signal }),
    enabled: me.isSignedIn,
  });
  const addresses = me.isSignedIn ? addressesQuery.data : undefined;
  const [selection, setSelection] = useState<string>(NEW_ADDRESS);

  const applyAddress = (address: Address) => {
    const fields = ['name', 'phone', 'line1', 'line2', 'landmark', 'city', 'state', 'pincode'] as const;
    for (const field of fields) setValue(`shippingAddress.${field}`, address[field] ?? '', { shouldDirty: true });
    clearErrors('shippingAddress');
  };

  const chosenInitially = useRef(false);
  useEffect(() => {
    if (chosenInitially.current || !addresses) return;
    chosenInitially.current = true;
    if (addresses.length === 0) return;
    const current = getValues('shippingAddress');
    const match = addresses.find((address) => sameAddress(address, current));
    if (match) {
      setSelection(savedKey(match.id));
      return;
    }
    if (current.line1.trim() === '') {
      const preferred = addresses.find((address) => address.isDefault) ?? addresses[0];
      if (preferred) {
        setSelection(savedKey(preferred.id));
        applyAddress(preferred);
      }
    }
    // applyAddress only calls stable form methods, so it is left out of the dependencies.
  }, [addresses, getValues]);

  const selectAddress = (next: string) => {
    setSelection(next);
    if (next === NEW_ADDRESS) {
      for (const field of ['line1', 'line2', 'landmark', 'city', 'state', 'pincode'] as const) setValue(`shippingAddress.${field}`, '');
      setValue('shippingAddress.name', getValues('contact.name'));
      setValue('shippingAddress.phone', getValues('contact.phone'));
      clearErrors('shippingAddress');
      return;
    }
    const address = addresses?.find((item) => savedKey(item.id) === next);
    if (address) applyAddress(address);
  };

  // Delivery PIN code: remembered in the cart so the cart and product pages know it too.
  const pincodeValue = useWatch({ control, name: 'shippingAddress.pincode' }) ?? '';
  const validPincode = isValidPincode(pincodeValue) ? pincodeValue.trim() : undefined;
  useEffect(() => {
    if (validPincode) useCart.getState().setPincode(validPincode);
  }, [validPincode]);

  // Pricing: re-priced whenever the payment method, the PIN code, the fulfilment or the lines change.
  const priced = useCheckoutPrice({
    items,
    paymentMethod: storedMethod ?? undefined,
    pincode: validPincode,
    quoteToken: quote?.token,
    fulfilment,
  });
  const cart = priced.cart;
  const paymentOptions = cart?.paymentOptions;
  const fittable = useMemo(() => (cart ? fittableLines(cart.lines) : []), [cart]);

  const effectiveMethod: PaymentMethod | null = useMemo(() => {
    if (!paymentOptions) return storedMethod;
    const keep = paymentOptions.find((option) => option.method === storedMethod && option.available);
    return keep?.method ?? paymentOptions.find((option) => option.available)?.method ?? null;
  }, [paymentOptions, storedMethod]);

  useEffect(() => {
    if (!paymentOptions || effectiveMethod === storedMethod) return;
    const lost = paymentOptions.find((option) => option.method === storedMethod);
    const now = paymentOptions.find((option) => option.method === effectiveMethod);
    if (lost && storedMethod) {
      setSwitchedNote(
        `${lost.label} is not available for this order${lost.reason ? `: ${lost.reason}` : '.'}${now ? ` We have picked ${now.label} instead.` : ''}`,
      );
    }
    useCheckout.getState().setDetails({ paymentMethod: effectiveMethod });
  }, [paymentOptions, effectiveMethod, storedMethod]);

  // A note about a switched payment method belongs to the delivery choice it was made for.
  useEffect(() => {
    setSwitchedNote(null);
  }, [fulfilment]);

  const chooseMethod = (method: PaymentMethod) => {
    setSwitchedNote(null);
    useCheckout.getState().setDetails({ paymentMethod: method });
  };

  // Studio fitting: the car coming in and the slot.
  const [car, setCar] = useState<CarValue | null>(() =>
    activeCar ? { kind: 'catalogue', vehicle: activeCar.vehicle, year: activeCar.year } : null,
  );
  const [carError, setCarError] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotValue | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const changeCar = (next: CarValue | null) => {
    setCar(next);
    if (carComplete(next)) setCarError(null);
  };
  // The picker passes null only when the chosen slot has just filled or passed.
  const changeSlot = useCallback((next: SlotValue | null) => {
    setSlot(next);
    setSlotError(next ? null : 'The time you chose is no longer free. Choose another.');
  }, []);

  const chooseFulfilment = (next: Fulfilment) => {
    setValue('fulfilment', next);
    clearErrors(['shippingAddress', 'registrationNumber']);
    setFormError(null);
    if (next === 'studio') {
      if (fitKeys.size === 0) setFitKeys(new Set(fittable.map((line) => cartLineKey(line))));
    } else {
      setFitKeys('none');
      setSlotError(null);
      setCarError(null);
    }
  };

  const fitLine = (line: PricedLine, fit: boolean) => {
    const next = new Set(fitKeys);
    if (fit) next.add(cartLineKey(line));
    else next.delete(cartLineKey(line));
    setFitKeys(next);
  };

  // Abandoned-checkout lead, once the phone is valid.
  const contact = useWatch({ control, name: 'contact' });
  useCheckoutLead(contact ?? {}, items, items.length > 0);

  // Step completion, for the roundels.
  const address = useWatch({ control, name: 'shippingAddress' });
  const registration = useWatch({ control, name: 'registrationNumber' }) ?? '';
  const wantsGstInvoice = useWatch({ control, name: 'wantsGstInvoice' });
  const contactDone =
    (contact?.name ?? '').trim().length >= 2 && isValidPhone(contact?.phone) && ((contact?.email ?? '') === '' || EMAIL.test((contact?.email ?? '').trim()));
  const fulfilmentDone = !isStudio || fitKeys.size > 0;
  const whereDone = isDelivery ? addressComplete(address) : isStudio ? carComplete(car) && slot !== null && REGISTRATION.test(registration.trim()) : true;
  const carDone = isStudio || !forCar || activeVehicle !== null;
  const paymentDone = effectiveMethod !== null && cart !== undefined;

  /** The studio checks that live outside the form fields. True when all is well. */
  const checkStudio = (): boolean => {
    if (!isStudio) return true;
    let ok = true;
    if (!carComplete(car)) {
      setCarError('Choose your car, or type its make, model and year.');
      ok = false;
    }
    if (!slot) {
      setSlotError('Choose a day and a time for the fitting.');
      ok = false;
    }
    return ok;
  };

  // Placing the order
  const placed = (response: CreateOrderResponse) => {
    const { order, payment } = response;
    useCheckout.getState().orderPlaced();
    rememberOrderToken(order.orderNumber, order.accessToken);
    if (!quote) useCart.getState().clear();
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() });
    if (order.fulfilment === 'studio') void queryClient.invalidateQueries({ queryKey: queryKeys.studio.diary() });
    if (me.isSignedIn) void queryClient.invalidateQueries({ queryKey: queryKeys.account.all() });
    if (quote) void queryClient.invalidateQueries({ queryKey: queryKeys.quote(quote.token) });
    if (payment === null) {
      navigate(orderPath(order.orderNumber, order.accessToken, true), { replace: true });
      return;
    }
    onPlaced({ order, payment });
  };

  const submit = handleSubmit(
    async (values) => {
      setFormError(null);
      setStockError(null);
      if (!cart) return;
      if (!cart.canCheckout) {
        setFormError(
          quote
            ? 'Part of this quote cannot be ordered as it stands. Message us and we will sort it out.'
            : 'Some parts cannot be ordered as they are. Fix them in the cart first.',
        );
        return;
      }
      if (isStudio && fitKeys.size === 0) {
        setFormError('Tick at least one part to fit, or choose Collect from our studio.');
        return;
      }
      if (!checkStudio()) {
        setFormError('Check the highlighted fields.');
        return;
      }
      if (!effectiveMethod) {
        setFormError('Choose how you want to pay.');
        return;
      }
      const contactPhone = normalizePhone(values.contact.phone) ?? values.contact.phone.trim();
      const shipPhone = normalizePhone(values.shippingAddress.phone) ?? values.shippingAddress.phone.trim();
      const leadToken = useCheckout.getState().leadToken;
      const studioCar = isStudio ? car : null;
      const request: Omit<CreateOrderRequest, 'idempotencyKey'> = {
        items,
        couponCode: quote ? undefined : couponCode || undefined,
        contact: { name: values.contact.name.trim(), email: values.contact.email.trim(), phone: contactPhone },
        fulfilment,
        shippingAddress: isDelivery
          ? {
              name: values.shippingAddress.name.trim(),
              phone: shipPhone,
              line1: values.shippingAddress.line1.trim(),
              line2: values.shippingAddress.line2.trim(),
              landmark: values.shippingAddress.landmark.trim(),
              city: values.shippingAddress.city.trim(),
              state: values.shippingAddress.state,
              pincode: values.shippingAddress.pincode.trim(),
            }
          : null,
        studioSlot: isStudio && slot ? { date: slot.date, slot: slot.slot } : undefined,
        paymentMethod: effectiveMethod,
        notes: values.notes.trim() || undefined,
        gstin: values.wantsGstInvoice ? values.gstin.trim().toUpperCase() : undefined,
        vehicleId: studioCar
          ? studioCar.kind === 'catalogue'
            ? studioCar.vehicle.id
            : undefined
          : forCar && activeVehicle
            ? activeVehicle.id
            : undefined,
        vehicleLabel: studioCar?.kind === 'typed' ? studioCar.label.trim() : undefined,
        registrationNumber: isStudio ? values.registrationNumber.trim().toUpperCase().replace(/\s+/g, ' ') : undefined,
        quoteToken: quote?.token,
        saveAddress: isDelivery && me.isSignedIn && selection === NEW_ADDRESS && values.saveAddress ? true : undefined,
      };
      // Same order, same key: a retry after a dropped connection returns the order already made.
      const idempotencyKey = useCheckout.getState().idempotencyKeyFor(JSON.stringify(request));
      try {
        const response = await api.orders.create({ ...request, leadToken: leadToken ?? undefined, idempotencyKey });
        placed(response);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'out_of_stock') {
          setStockError(`${error.message} The summary now shows what is in stock. Check it, then place the order again.`);
          priced.refetch();
          void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() });
          return;
        }
        if (error instanceof ApiError && error.code === 'slot_unavailable') {
          setSlot(null);
          setSlotError(error.message || 'That slot has just filled. Choose another time.');
          setFormError('Your slot has just filled. Choose another time, then place the order again.');
          void queryClient.invalidateQueries({ queryKey: queryKeys.studio.diary() });
          return;
        }
        if (error instanceof ApiError && error.hasFields) {
          const { studioSlot: slotProblem, vehicleLabel, vehicleId, ...formFields } = error.fields;
          if (slotProblem) setSlotError(slotProblem);
          if (vehicleLabel || vehicleId) setCarError(vehicleLabel ?? vehicleId ?? null);
          if (Object.keys(formFields).some((field) => field.startsWith('shippingAddress')) && selection !== NEW_ADDRESS) {
            setSelection(NEW_ADDRESS);
          }
          for (const [field, message] of Object.entries(formFields)) {
            setError(field as Parameters<typeof setError>[0], { type: 'server', message });
          }
          setFormError(errorMessage(error));
          return;
        }
        if (error instanceof ApiError && error.status === 409) {
          // Something else changed under the order (a quote already used, a price moved): re-price and say so.
          priced.refetch();
          setFormError(error.message);
          return;
        }
        setFormError(errorMessage(error, 'Could not place the order. Check your connection and try again.'));
      }
    },
    (invalid) => {
      // A saved address with a problem: open its fields so the shopper can see and fix it.
      if (invalid.shippingAddress && selection !== NEW_ADDRESS) setSelection(NEW_ADDRESS);
      if (invalid.contact || invalid.shippingAddress || invalid.registrationNumber) setStage('details');
      checkStudio();
      setFormError('Check the highlighted fields.');
    },
  );

  // Flipkart-style stages: the order, then delivery details, then payment. One is open at a time.
  type Stage = 'items' | 'details' | 'payment';
  const [stage, setStage] = useState<Stage>('items');
  const goTo = (next: Stage) => {
    setStage(next);
    setFormError(null);
    window.requestAnimationFrame(() => document.getElementById(`stage-${next}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const continueToPayment = async () => {
    const fields: string[] = ['contact'];
    if (isDelivery && selection === NEW_ADDRESS) fields.push('shippingAddress');
    if (isStudio) fields.push('registrationNumber');
    const valid = await form.trigger(fields as Parameters<typeof form.trigger>[0]);
    const studioOk = checkStudio();
    if (!valid || !studioOk || !contactDone || !whereDone || !fulfilmentDone) {
      if (isDelivery && selection !== NEW_ADDRESS && !whereDone) setSelection(NEW_ADDRESS);
      // Say exactly what is still needed, in the order it appears on the page.
      const missing: string[] = [];
      if (!contactDone) missing.push('your name and mobile number');
      if (!fulfilmentDone) missing.push('which parts to fit');
      if (isDelivery && !whereDone) missing.push('the delivery address');
      if (isStudio && !carComplete(car)) missing.push('your car');
      if (isStudio && !REGISTRATION.test(registration.trim())) missing.push('the registration number');
      if (isStudio && !slot) missing.push('a day and time for the fitting');
      setFormError(missing.length > 0 ? `Still needed: ${missing.join(', ')}.` : 'Check the details marked in red.');
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('#stage-details [aria-invalid="true"], #stage-details [role="alert"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      );
      return;
    }
    goTo('payment');
  };
  const detailsSummary = [
    [contact?.name?.trim(), contact?.phone ? `+91 ${contact.phone}` : ''].filter(Boolean).join(', '),
    isDelivery
      ? [address?.line1, address?.city, address?.pincode].filter((part) => part && String(part).trim()).join(', ')
      : isStudio
        ? slot
          ? `Fitting at the studio, ${slot.date} ${slot.slot}`
          : 'Fitting at the studio'
        : 'Collect from the studio',
  ]
    .filter(Boolean)
    .join(' · ');

  // Steps, numbered as they appear. The first one still to fill in is the current one.
  const steps = {
    contact: { done: contactDone },
    fulfilment: { done: fulfilmentDone, shown: studioOn },
    where: { done: whereDone },
    car: { done: carDone, shown: !isStudio },
    payment: { done: paymentDone },
  };
  const stepOrder = (['contact', 'fulfilment', 'where', 'car', 'payment'] as const).filter((key) => (steps[key] as { shown?: boolean }).shown !== false);
  type StepKey = (typeof stepOrder)[number];
  const stepNumber = (key: StepKey) => stepOrder.indexOf(key) + 1;
  const currentStep = stepOrder.find((key) => !steps[key].done) ?? null;
  const sectionState = (key: StepKey) => ({ step: stepNumber(key), done: steps[key].done, current: currentStep === key });

  const chosenOption = cart?.paymentOptions.find((option) => option.method === effectiveMethod);
  const summaryProps = { cart, isPending: priced.isPending, isUpdating: priced.isUpdating, fromQuote: quote !== null };
  const placeProps = { cart, method: effectiveMethod, fulfilment, submitting: isSubmitting, formError, stockError };

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title="Checkout"
        breadcrumbs={quote ? undefined : [{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]}
        description={me.isSignedIn || quote ? undefined : 'No account needed. We send order updates to your mobile.'}
      />

      {quote && <QuoteBoard quote={quote} onExpire={onQuoteExpired} className="mb-8" />}

      {priced.isError && !cart ? (
        <ErrorState error={priced.error} onRetry={priced.refetch} title="Could not price your order" />
      ) : (
        <>
          <div className="mb-2 hidden">
            <Accordion>
              <AccordionItem
                value="summary"
                title={cart ? `Order summary (${cart.itemCount})` : 'Order summary'}
                aside={cart ? <span className="type-price text-ink tnum">{formatINR(chosenOption?.total ?? cart.total)}</span> : <Skeleton className="h-5 w-16" />}
              >
                <OrderSummary {...summaryProps} heading={false} />
              </AccordionItem>
            </Accordion>
          </div>

          <div className="grid gap-10">
            <form id={FORM_ID} onSubmit={submit} noValidate className="checkout-soft grid min-w-0 gap-10">
              <div id="stage-items" className="scroll-mt-24">
                <CheckoutStage
                  n={1}
                  title="Order summary"
                  open={stage === 'items'}
                  done={stage !== 'items'}
                  summary={cart ? `${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'} · ${formatINR(chosenOption?.total ?? cart.total)}` : undefined}
                  onChange={() => goTo('items')}
                >
                  <OrderSummary {...summaryProps} heading={false} />
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <Link to="/cart" className="link text-sm font-bold">
                      Edit cart
                    </Link>
                    <Button size="lg" onClick={() => goTo('details')} disabled={!cart || !cart.canCheckout} className="!rounded-[10px] sm:min-w-56">
                      Continue
                    </Button>
                  </div>
                </CheckoutStage>
              </div>

              <div id="stage-details" className="scroll-mt-24">
                <CheckoutStage
                  n={2}
                  title={isDelivery ? 'Delivery address' : 'Your details'}
                  open={stage === 'details'}
                  done={stage === 'payment'}
                  summary={detailsSummary}
                  onChange={() => goTo('details')}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Your name" error={errors.contact?.name?.message} required className="sm:col-span-2">
                      <Input autoComplete="name" {...register('contact.name')} />
                    </Field>
                    <Field label="Mobile number" hint="10 digits. Order updates come here." error={errors.contact?.phone?.message} required>
                      <Input type="tel" inputMode="tel" autoComplete="tel-national" leading="+91" {...register('contact.phone')} />
                    </Field>
                    <Field label="Email" optional hint="We email the GST invoice here." error={errors.contact?.email?.message}>
                      <Input type="email" inputMode="email" autoComplete="email" {...register('contact.email')} />
                    </Field>
                  </div>
                  {!me.isSignedIn && !me.isPending && (
                    <p className="type-small text-muted">
                      Have an account?{' '}
                      <Link to={`/login?next=${encodeURIComponent(`/checkout${quote ? `?quote=${quote.token}` : ''}`)}`} className="link">
                        Sign in
                      </Link>{' '}
                      to use your saved addresses.
                    </p>
                  )}

                  {studioOn && (
                    <div className="grid gap-3 border-t border-line pt-5">
                      <h3 className="font-bold">How do you want it?</h3>
                      <FulfilmentSection
                        value={fulfilment}
                        onChange={chooseFulfilment}
                        cart={cart}
                        fittable={fittable}
                        fitKeys={fitKeys}
                        onFitLine={fitLine}
                        studioAddress={settings?.studio.address ?? ''}
                        loading={priced.isPending}
                      />
                    </div>
                  )}

                  <div className="grid gap-3 border-t border-line pt-5">
                    <h3 className="font-bold">{STEP_TITLES[fulfilment]}</h3>
                    {isDelivery ? (
                      <AddressSection
                        form={form}
                        isSignedIn={me.isSignedIn}
                        addresses={addresses}
                        addressesLoading={me.isSignedIn && addressesQuery.isPending}
                        selection={selection}
                        onSelect={selectAddress}
                      />
                    ) : isStudio ? (
                      <StudioFittingStep
                        form={form}
                        car={car}
                        onCarChange={changeCar}
                        carError={carError}
                        slot={slot}
                        onSlotChange={changeSlot}
                        slotError={slotError}
                        settings={settings}
                      />
                    ) : settings ? (
                      <StudioWhere settings={settings} intro="Collect the parts from the studio during opening hours. Bring your order number." />
                    ) : (
                      <Skeleton className="h-24 w-full" />
                    )}
                  </div>

                  {!isStudio && (
                    <div className="grid gap-3 border-t border-line pt-5">
                      <h3 className="font-bold">Which car is it for</h3>
                      <VehicleSection forCar={forCar} onForCarChange={setForCar} />
                    </div>
                  )}

                  <div className="flex flex-col-reverse items-stretch gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-end">
                    {formError && stage === 'details' && (
                      <p role="alert" className="flex items-start gap-2 text-sm font-medium text-stop sm:mr-auto">
                        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                        <span>{formError}</span>
                      </p>
                    )}
                    <Button size="lg" onClick={() => void continueToPayment()} className="!rounded-[10px] sm:min-w-56">
                      {isDelivery ? 'Deliver here' : 'Continue'}
                    </Button>
                  </div>
                </CheckoutStage>
              </div>

              <div id="stage-payment" className="scroll-mt-24">
                <CheckoutStage n={3} title="Payment" open={stage === 'payment'} done={false}>
                  <PaymentOptions
                    options={paymentOptions}
                    value={effectiveMethod}
                    onChange={chooseMethod}
                    loading={priced.isPending}
                    switchedNote={switchedNote}
                    inAppBrowser={inApp}
                    fulfilment={cart?.fulfilment ?? fulfilment}
                  />
                  {cart && <EmiNote total={chosenOption?.total ?? cart.total} />}

                  <div className="grid gap-4 border-t border-line pt-5">
                    <Checkbox
                      label="I need a GST invoice for my business"
                      description="Your GSTIN goes on the invoice so you can claim the input tax."
                      {...register('wantsGstInvoice')}
                    />
                    {wantsGstInvoice && (
                      <Field label="GSTIN" hint="15 characters, like 27ABCDE1234F1Z5." error={errors.gstin?.message} required className="sm:max-w-sm">
                        <Input mono autoComplete="off" maxLength={15} {...register('gstin')} />
                      </Field>
                    )}
                    <Field label="Notes for the shop" optional hint={NOTE_HINTS[fulfilment]} error={errors.notes?.message}>
                      <Textarea rows={3} maxLength={500} {...register('notes')} />
                    </Field>
                  </div>

                  <div className="border-t border-line pt-5">
                    <PlaceOrder {...placeProps} showTotal />
                  </div>
                </CheckoutStage>
              </div>
            </form>

          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const quoteToken = params.get('quote')?.trim() || null;
  const storeLines = useCart((state) => state.lines);
  const [placed, setPlaced] = useState<Placed | null>(null);

  useDocumentMeta({ title: placed ? `Pay for order ${placed.order.orderNumber}` : 'Checkout', noindex: true });

  const quoteQuery = useQuery({
    queryKey: queryKeys.quote(quoteToken ?? ''),
    queryFn: ({ signal }) => api.quotes.get(quoteToken ?? '', { signal }),
    enabled: quoteToken !== null && placed === null,
  });

  if (placed) return <PayStep order={placed.order} payment={placed.payment} />;

  if (quoteToken) {
    if (quoteQuery.isPending) {
      return <CheckoutSkeleton />;
    }
    if (quoteQuery.error) {
      return (
        <div className="container-page section-y">
          {quoteQuery.error.isNotFound ? <QuoteNotFound /> : <ErrorState error={quoteQuery.error} onRetry={() => void quoteQuery.refetch()} />}
        </div>
      );
    }
    const quote = quoteQuery.data;
    if (quote.status !== 'open') {
      return (
        <div className="container-page section-y">
          <QuoteClosed quote={quote} />
        </div>
      );
    }
    if (quote.items.length === 0) {
      return (
        <div className="container-page section-y">
          <QuoteEmpty quote={quote} />
        </div>
      );
    }
    return <CheckoutForm key={quote.token} quote={quote} onQuoteExpired={() => void quoteQuery.refetch()} onPlaced={setPlaced} />;
  }

  if (storeLines.length === 0) return <EmptyCheckout />;
  return <CheckoutForm quote={null} onQuoteExpired={() => undefined} onPlaced={setPlaced} />;
}
