import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Banknote, CircleX, Truck } from 'lucide-react';
import { Checkbox, Field, Input, RadioGroup, Select, Skeleton, type RadioOption } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateRange } from '@/lib/format';
import { formatPhone, isValidPincode, isValidState, STATE_NAMES } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import type { Address } from '@/types/api';
import type { CheckoutValues } from './schema';

export const NEW_ADDRESS = 'new';
export const savedKey = (id: number) => `saved-${id}`;

const STATE_OPTIONS = STATE_NAMES.map((name) => ({ value: name, label: name }));

function addressLine(address: Pick<Address, 'line1' | 'line2' | 'landmark' | 'city' | 'state' | 'pincode'>): string {
  return [address.line1, address.line2, address.landmark && `near ${address.landmark}`, address.city, `${address.state} ${address.pincode}`]
    .filter(Boolean)
    .join(', ');
}

/** The delivery estimate for the PIN code being typed: dates, COD, and the state it belongs to. */
function PincodeEstimate({ pincode, onState }: { pincode: string; onState: (state: string) => void }) {
  const valid = isValidPincode(pincode);
  const { data, error, isFetching } = useQuery({
    queryKey: queryKeys.shipping(pincode),
    queryFn: ({ signal }) => api.shipping.estimate(pincode, { signal }),
    enabled: valid,
    staleTime: 10 * 60_000,
  });

  // Only a new answer fills the state, so a shopper who corrects it by hand is not overruled on every render.
  const fill = useRef(onState);
  useEffect(() => {
    fill.current = onState;
  });
  useEffect(() => {
    if (data?.serviceable && isValidState(data.state)) fill.current(data.state);
  }, [data]);

  if (!valid) return null;
  if (isFetching && !data) return <Skeleton className="h-5 w-56" aria-label="Checking delivery to this PIN code" />;
  if (error) return <p className="type-small text-muted">{error.message}</p>;
  if (!data) return null;
  if (!data.serviceable) {
    return (
      <p role="status" className="type-small flex items-start gap-2 font-medium text-stop">
        <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{data.message || 'We do not deliver to this PIN code yet.'}</span>
      </p>
    );
  }
  return (
    <div role="status" className="type-small grid gap-1">
      <p className="flex items-start gap-2">
        <Truck aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Arrives <strong className="tnum">{formatDateRange(data.earliest, data.latest)}</strong>
          {data.state && <span className="text-muted"> · {data.state}</span>}
        </span>
      </p>
      <p className="flex items-start gap-2 text-muted">
        <Banknote aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{data.codAvailable ? 'Cash on delivery is available here.' : 'Cash on delivery is not available here. Pay online instead.'}</span>
      </p>
    </div>
  );
}

export interface AddressSectionProps {
  form: UseFormReturn<CheckoutValues>;
  isSignedIn: boolean;
  addresses: Address[] | undefined;
  addressesLoading: boolean;
  selection: string;
  onSelect: (selection: string) => void;
}

export function AddressSection({ form, isSignedIn, addresses, addressesLoading, selection, onSelect }: AddressSectionProps) {
  const {
    register,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = form;
  const pincode = useWatch({ control, name: 'shippingAddress.pincode' }) ?? '';
  const addressErrors = errors.shippingAddress;
  const saved = addresses ?? [];
  const showFields = !addressesLoading && (selection === NEW_ADDRESS || saved.length === 0);

  const fillState = (state: string) => {
    if (getValues('shippingAddress.state') !== state) setValue('shippingAddress.state', state, { shouldValidate: true, shouldDirty: true });
  };

  const options: RadioOption[] = [
    ...saved.map((address) => ({
      value: savedKey(address.id),
      label: (
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span>{address.label || address.name}</span>
          {address.isDefault && <span className="type-label text-muted">Default</span>}
        </span>
      ),
      description: (
        <>
          {address.label && address.label !== address.name && <span className="block text-ink">{address.name}</span>}
          <span className="block">{addressLine(address)}</span>
          <span className="block tnum">{formatPhone(address.phone)}</span>
        </>
      ),
    })),
    { value: NEW_ADDRESS, label: 'Deliver somewhere else', description: 'Type a new address' },
  ];

  return (
    <div className="grid gap-5">
      {isSignedIn && addressesLoading && (
        <div className="grid gap-2" aria-label="Loading your saved addresses">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {saved.length > 0 && (
        <RadioGroup legend="Your saved addresses" variant="card" options={options} value={selection} onChange={onSelect} />
      )}

      {!showFields && !addressesLoading && <PincodeEstimate pincode={pincode} onState={fillState} />}

      {showFields && (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Receiver's name" error={addressErrors?.name?.message} required>
              <Input autoComplete="shipping name" {...register('shippingAddress.name')} />
            </Field>
            <Field label="Receiver's mobile" hint="The courier calls this number." error={addressErrors?.phone?.message} required>
              <Input type="tel" inputMode="tel" autoComplete="shipping tel-national" leading="+91" {...register('shippingAddress.phone')} />
            </Field>
            <Field label="PIN code" error={addressErrors?.pincode?.message} required>
              <Input
                inputMode="numeric"
                autoComplete="shipping postal-code"
                maxLength={6}
                mono
                {...register('shippingAddress.pincode')}
              />
            </Field>
          </div>
          <PincodeEstimate pincode={pincode} onState={fillState} />
          <Field label="Flat, house no., building" error={addressErrors?.line1?.message} required>
            <Input autoComplete="shipping address-line1" {...register('shippingAddress.line1')} />
          </Field>
          <Field label="Area, street, sector" error={addressErrors?.line2?.message} required>
            <Input autoComplete="shipping address-line2" {...register('shippingAddress.line2')} />
          </Field>
          <Field label="Landmark" optional hint="Couriers find you faster with one: a temple, school or shop nearby." error={addressErrors?.landmark?.message}>
            <Input {...register('shippingAddress.landmark')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Town or city" error={addressErrors?.city?.message} required>
              <Input autoComplete="shipping address-level2" {...register('shippingAddress.city')} />
            </Field>
            <Field label="State" error={addressErrors?.state?.message} required>
              <Select placeholder="Choose a state" options={STATE_OPTIONS} autoComplete="shipping address-level1" {...register('shippingAddress.state')} />
            </Field>
          </div>
          {isSignedIn && <Checkbox label="Save this address to my account" {...register('saveAddress')} />}
        </div>
      )}
    </div>
  );
}
