import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Callout, Checkbox, Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { isValidPincode, isValidState, STATE_NAMES } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import type { Address, AddressInput } from '@/types/api';
import { addressSchema, type AddressFormInput, type AddressFormOutput } from './schemas';

const STATE_OPTIONS = STATE_NAMES.map((name) => ({ value: name, label: name }));

export function toAddressInput(address: Address): AddressInput {
  return {
    label: address.label,
    name: address.name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    isDefault: address.isDefault,
  };
}

interface AddressFormProps {
  id: string;
  /** The address being edited, or null for a new one. */
  address: Address | null;
  /** Prefills a new address. */
  defaults: { name: string; phone: string; isDefault: boolean };
  /** Saves and resolves; a rejection is shown on the form. */
  onSave: (input: AddressInput) => Promise<unknown>;
}

/**
 * The address form. The Drawer around it holds the submit button (`form={id}`).
 * The PIN code fills in the state from the delivery estimate.
 */
export function AddressForm({ id, address, defaults, onSave }: AddressFormProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [stateFromPin, setStateFromPin] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<AddressFormInput, unknown, AddressFormOutput>({
    resolver: zodResolver(addressSchema),
    defaultValues: address
      ? {
          label: address.label,
          name: address.name,
          phone: address.phone,
          pincode: address.pincode,
          line1: address.line1,
          line2: address.line2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          isDefault: address.isDefault,
        }
      : { label: '', name: defaults.name, phone: defaults.phone, pincode: '', line1: '', line2: '', landmark: '', city: '', state: '', isDefault: defaults.isDefault },
  });

  const pincode = useWatch({ control, name: 'pincode' }) ?? '';
  const lastPin = useRef(address?.pincode ?? '');
  const stateByHand = useRef(false);
  const stateField = register('state');

  useEffect(() => {
    const pin = pincode.trim();
    if (!isValidPincode(pin) || pin === lastPin.current) return;
    lastPin.current = pin;
    let live = true;
    queryClient
      .fetchQuery({ queryKey: queryKeys.shipping(pin), queryFn: () => api.shipping.estimate(pin), staleTime: 60 * 60_000 })
      .then((estimate) => {
        if (!live || !estimate.state || !isValidState(estimate.state)) return;
        // A state the shopper chose by hand is theirs: the hint names the PIN code's state instead.
        const current = getValues('state');
        if (current !== estimate.state && !(stateByHand.current && current)) {
          setValue('state', estimate.state, { shouldValidate: true, shouldDirty: true });
        }
        setStateFromPin(estimate.state);
      })
      .catch(() => {
        // The shopper can still choose the state by hand.
      });
    return () => {
      live = false;
    };
  }, [pincode, queryClient, getValues, setValue]);

  const state = useWatch({ control, name: 'state' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSave({ ...values, label: values.label || undefined });
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  return (
    <form id={id} noValidate onSubmit={onSubmit} className="grid gap-5">
      {formError && (
        <Callout tone="danger" live>
          {formError}
        </Callout>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={errors.name?.message}>
          <Input autoComplete="name" autoCapitalize="words" {...register('name')} />
        </Field>
        <Field label="Mobile number" hint="The courier calls this number." error={errors.phone?.message}>
          <Input type="tel" inputMode="numeric" autoComplete="tel-national" leading="+91" maxLength={14} {...register('phone')} />
        </Field>
      </div>
      <Field label="PIN code" error={errors.pincode?.message} className="max-w-48">
        <Input inputMode="numeric" autoComplete="postal-code" maxLength={6} mono {...register('pincode')} />
      </Field>
      <Field label="Flat, house number, building" error={errors.line1?.message}>
        <Input autoComplete="address-line1" {...register('line1')} />
      </Field>
      <Field label="Area, street, sector" optional error={errors.line2?.message}>
        <Input autoComplete="address-line2" {...register('line2')} />
      </Field>
      <Field label="Landmark" optional hint="Helps the courier find you." error={errors.landmark?.message}>
        <Input {...register('landmark')} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Town or city" error={errors.city?.message}>
          <Input autoComplete="address-level2" {...register('city')} />
        </Field>
        <Field
          label="State"
          hint={
            stateFromPin
              ? stateFromPin === state
                ? stateByHand.current
                  ? undefined
                  : 'Filled in from the PIN code.'
                : `This PIN code is in ${stateFromPin}. Check the state.`
              : undefined
          }
          error={errors.state?.message}
        >
          <Select
            options={STATE_OPTIONS}
            placeholder="Choose the state"
            autoComplete="address-level1"
            {...stateField}
            onChange={(event) => {
              stateByHand.current = true;
              return stateField.onChange(event);
            }}
          />
        </Field>
      </div>
      <Field label="Label" optional hint="Home, Work, Parents. Shown when you pick an address at checkout." error={errors.label?.message}>
        <Input maxLength={30} {...register('label')} />
      </Field>
      <Checkbox label="Use as my default address" description="Checkout fills this in first." {...register('isDefault')} />
    </form>
  );
}
