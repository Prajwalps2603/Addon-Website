/**
 * Shared by every settings section: the save hook (one PUT of a partial per section),
 * the section frame with its own Save button, and the Zod pieces that mirror the server's rules.
 */
import { useEffect, useState, type BaseSyntheticEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver, type UseFormReturn } from 'react-hook-form';
import * as z from 'zod';
import { Button, Callout, toast } from '@/components/ui';
import { api, ApiError, errorMessage, type DeepPartial } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { isValidPincode } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/cn';
import type { AdminSettings } from '@/types/api';

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/** PUT /admin/settings with a partial. On success the admin copy is replaced and everything the storefront reads is refreshed. */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: DeepPartial<AdminSettings>) => api.admin.settings.update(patch),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.admin.settings(), next);
      // Store details, fees, COD rules, promos and search words all reach the storefront.
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
    },
  });
}

/** Asks the browser to confirm leaving the page while a section has unsaved changes. */
export function useLeaveGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

export interface SectionFormOptions<I extends FieldValues, O> {
  settings: AdminSettings;
  resolver: Resolver<I, unknown, O>;
  /** The form's values from the stored settings. */
  toForm: (settings: AdminSettings) => I;
  /** The partial to PUT. Send only what this section owns. */
  toPatch: (values: O) => DeepPartial<AdminSettings>;
  /** Used in the toasts: 'Store details saved'. */
  name: string;
  /** Maps a server field path to this form's field name, when they differ. */
  fieldFor?: (serverField: string) => string;
}

export interface SectionForm<I extends FieldValues, O> {
  form: UseFormReturn<I, unknown, O>;
  submit: (event?: BaseSyntheticEvent) => Promise<void>;
  undo: () => void;
  saving: boolean;
  formError: string | null;
  dirty: boolean;
}

/** One section's form: validates on the client, saves its own partial, puts server errors on the fields. */
export function useSectionForm<I extends FieldValues, O>({ settings, resolver, toForm, toPatch, name, fieldFor }: SectionFormOptions<I, O>): SectionForm<I, O> {
  const form = useForm<I, unknown, O>({ resolver, defaultValues: toForm(settings) as DefaultValues<I>, mode: 'onTouched' });
  const save = useSaveSettings();
  const [formError, setFormError] = useState<string | null>(null);
  const dirty = form.formState.isDirty;
  useLeaveGuard(dirty);

  const submit = form.handleSubmit(
    async (values) => {
      setFormError(null);
      try {
        const next = await save.mutateAsync(toPatch(values));
        form.reset(toForm(next));
        toast.success(`${name} saved`);
      } catch (error) {
        const rename: Partial<Record<string, Path<I>>> = {};
        if (error instanceof ApiError && fieldFor) {
          for (const key of Object.keys(error.fields)) rename[key] = fieldFor(key) as Path<I>;
        }
        const message = applyApiError(error, form.setError, rename);
        setFormError(message);
        toast.error(`Could not save ${name.toLowerCase()}`, { description: errorMessage(error) });
      }
    },
    () => setFormError('Some fields need fixing. They are marked below.'),
  );

  return {
    form,
    submit,
    undo: () => {
      setFormError(null);
      form.reset(toForm(settings));
    },
    saving: save.isPending,
    formError,
    dirty,
  };
}

// ---------------------------------------------------------------------------
// The frame of a section
// ---------------------------------------------------------------------------

export interface SectionShellProps {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Heading and rule of a settings section. Square, opened by a 1 px ink rule like a table. */
export function SectionShell({ id, title, description, children, className }: SectionShellProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('scroll-mt-32 border-t border-ink pt-5 lg:scroll-mt-8', className)}>
      <header className="grid gap-2 pb-6">
        <h2 id={`${id}-title`} className="type-h2">
          {title}
        </h2>
        {description && <div className="type-body max-w-prose text-muted">{description}</div>}
      </header>
      {children}
    </section>
  );
}

export interface SettingsFormProps<I extends FieldValues, O> extends Omit<SectionShellProps, 'children'> {
  section: SectionForm<I, O>;
  /** The Save button's object: 'Save store details'. */
  saveLabel: string;
  children: ReactNode;
}

/** A section with its own form and Save button. The save bar sticks to the foot of the screen while the section is on it and has changes. */
export function SettingsForm<I extends FieldValues, O>({ section, saveLabel, children, ...shell }: SettingsFormProps<I, O>) {
  const { submit, undo, saving, formError, dirty } = section;
  return (
    <SectionShell {...shell}>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
        {children}
        {formError && (
          <Callout tone="danger" live title="Not saved">
            {formError}
          </Callout>
        )}
        <div
          className={cn(
            'z-sticky -mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-page px-4 py-3 md:mx-0 md:px-0',
            dirty && 'sticky bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom))]',
          )}
        >
          <Button type="submit" variant={dirty ? 'primary' : 'outline'} disabled={!dirty && !formError} loading={saving}>
            {saveLabel}
          </Button>
          {dirty && (
            <Button type="button" variant="ghost" onClick={undo} disabled={saving}>
              Undo changes
            </Button>
          )}
          <p className="type-small text-muted" aria-live="polite">
            {dirty ? 'Unsaved changes' : ''}
          </p>
        </div>
      </form>
    </SectionShell>
  );
}

/** A group of fields inside a section, with a small heading. */
export function FieldGroup({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn('grid gap-4', className)}>
      <legend className="type-label mb-3 text-muted">{title}</legend>
      {description && <p className="type-small -mt-1 max-w-prose text-muted">{description}</p>}
      {children}
    </fieldset>
  );
}

/** A quiet panel showing what a shopper will read, from the values being typed. */
export function ShopperPreview({ title = 'What a shopper reads', children }: { title?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 bg-surface p-4" aria-live="polite">
      <p className="type-label text-muted">{title}</p>
      <div className="type-body max-w-prose">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Values: the same rules as server/src/lib/settings.js, with plain messages
// ---------------------------------------------------------------------------

/** '1,499' or ' 1499 ' → 1499; '' → undefined so the field reports "required" instead of reading 0. */
function toNumber(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().replace(/[,₹\s%]/g, '');
  return trimmed === '' ? undefined : Number(trimmed);
}

/** A typed number from a watched input, NaN when not a number yet. */
export function numberOf(value: unknown): number {
  const parsed = toNumber(value);
  return typeof parsed === 'number' ? parsed : Number.NaN;
}

export const rupees = () =>
  z.preprocess(
    toNumber,
    z
      .number({ error: 'Enter an amount in whole rupees.' })
      .int({ error: 'Use whole rupees, no paise.' })
      .min(0, { error: 'Must be 0 or more.' })
      .max(10_000_000, { error: 'That is more than ₹1,00,00,000.' }),
  );

export const wholeNumber = (max: number, unit: string) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: `Enter a number of ${unit}.` })
      .int({ error: `Use whole ${unit}.` })
      .min(0, { error: 'Must be 0 or more.' })
      .max(max, { error: `Use ${max} ${unit} or fewer.` }),
  );

export const percent = (max: number, whole: boolean) =>
  z.preprocess(
    toNumber,
    (whole ? z.number({ error: 'Enter a percent.' }).int({ error: 'Use a whole percent.' }) : z.number({ error: 'Enter a percent.' }))
      .min(0, { error: 'Must be 0 or more.' })
      .max(max, { error: `Use ${max}% or less.` }),
  );

export const text = (max: number) => z.string().trim().max(max, { error: `Keep it to ${max} characters.` });

export const optionalEmail = text(160).refine((value) => value === '' || z.email().safeParse(value).success, {
  error: 'Enter a valid email address, or leave it blank.',
});

export const optionalPincode = z
  .string()
  .trim()
  .refine((value) => value === '' || isValidPincode(value), { error: 'Enter a 6 digit PIN code, or leave it blank.' });

const digitCount = (value: string) => value.replace(/\D/g, '').length;

export const displayPhone = z
  .string()
  .trim()
  .max(30, { error: 'Keep it to 30 characters.' })
  .refine((value) => value === '' || (/^[0-9+\-() ]+$/.test(value) && digitCount(value) >= 10 && digitCount(value) <= 13), {
    error: 'Enter a phone number with 10 to 13 digits, or leave it blank.',
  });

export const optionalLink = z
  .string()
  .trim()
  .max(300, { error: 'Keep the link to 300 characters.' })
  .refine((value) => value === '' || /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(value), {
    error: 'Enter the full link starting with https://, or leave it blank.',
  });

/**
 * WhatsApp as wa.me wants it: digits with the country code. A ten-digit Indian mobile gets 91,
 * as the server does. Returns null when it cannot be a WhatsApp number.
 */
export function normalizeWhatsapp(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\+?[0-9 \-]*$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  if (digits === '') return '';
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^[1-9]\d{10,14}$/.test(digits)) return digits;
  return null;
}

export const whatsappNumber = z
  .string()
  .trim()
  .refine((value) => normalizeWhatsapp(value) !== null, {
    error: 'Enter the number as digits with the country code, for example 919876543210.',
  })
  .transform((value) => normalizeWhatsapp(value) ?? '');

/** 'datetime-local' value ('2026-11-20T18:00') from an ISO instant, in the browser's time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ISO instant from a 'datetime-local' value, or null when blank. */
export function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
