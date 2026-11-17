import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import * as z from 'zod';
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { Badge, Button, Field, IconButton, Input, Segmented, type BadgeToneName } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { imageVariant } from '@/lib/images';
import { cn } from '@/lib/cn';
import type { AdminSettings, PromoBanner } from '@/types/api';
import { PhotoPicker } from './PhotoPicker';
import { FieldGroup, fromLocalInput, SettingsForm, text, toLocalInput, useSectionForm } from './shared';

const MAX_ANNOUNCEMENTS = 8;
const MAX_PROMOS = 12;

const promoSchema = z
  .object({
    // The banner's own id. Not 'id': useFieldArray keeps that name for its row keys.
    promoId: z.string(),
    eyebrow: text(40),
    title: text(80).min(1, { error: 'Give the banner a title.' }),
    subtitle: text(200),
    ctaLabel: text(40),
    ctaHref: z
      .string()
      .trim()
      .max(200, { error: 'Keep the link to 200 characters.' })
      .regex(/^\/(?!\/)/, { error: 'Use a page on this store, starting with /, for example /shop/lighting.' }),
    image: z.string(),
    tone: z.enum(['yellow', 'dark', 'light']),
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .refine((promo) => !promo.startsAt || !promo.endsAt || new Date(promo.endsAt) > new Date(promo.startsAt), {
    path: ['endsAt'],
    error: 'The end must be after the start.',
  });

const schema = z.object({
  announcements: z
    .array(z.object({ text: text(140).min(1, { error: 'Write the message, or remove this line.' }) }))
    .max(MAX_ANNOUNCEMENTS, { error: `Keep it to ${MAX_ANNOUNCEMENTS} messages.` }),
  allPromos: z.array(promoSchema).max(MAX_PROMOS, { error: `Keep it to ${MAX_PROMOS} banners.` }),
});

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;
type PromoInput = Input['allPromos'][number];

function toForm(s: AdminSettings): Input {
  return {
    announcements: s.announcements.map((message) => ({ text: message })),
    allPromos: s.allPromos.map(({ id, ...promo }) => ({
      ...promo,
      promoId: id,
      startsAt: toLocalInput(promo.startsAt),
      endsAt: toLocalInput(promo.endsAt),
    })),
  };
}

function toPatch(values: Output) {
  return {
    announcements: values.announcements.map((row) => row.text),
    allPromos: values.allPromos.map(
      ({ promoId, ...promo }): PromoBanner => ({
        ...promo,
        id: promoId,
        startsAt: fromLocalInput(promo.startsAt),
        endsAt: fromLocalInput(promo.endsAt),
      }),
    ),
  };
}

/** 'announcements.2' (a plain string on the server) → 'announcements.2.text' here. */
function fieldFor(serverField: string): string {
  if (/^announcements\.\d+$/.test(serverField)) return `${serverField}.text`;
  return serverField.replace(/^allPromos\.(\d+)\.id$/, 'allPromos.$1.promoId');
}

const TONES = [
  { value: 'yellow', label: 'Red' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const;

function promoState(promo: Pick<PromoInput, 'startsAt' | 'endsAt'>): { label: string; tone: BadgeToneName } {
  const now = Date.now();
  const starts = promo.startsAt ? new Date(promo.startsAt).getTime() : null;
  const ends = promo.endsAt ? new Date(promo.endsAt).getTime() : null;
  if (ends !== null && !Number.isNaN(ends) && ends <= now) return { label: 'Ended', tone: 'neutral' };
  if (starts !== null && !Number.isNaN(starts) && starts > now) return { label: `Starts ${formatDateTime(new Date(starts))}`, tone: 'info' };
  if (ends !== null && !Number.isNaN(ends)) return { label: `Live until ${formatDateTime(new Date(ends))}`, tone: 'fit' };
  return { label: 'Live', tone: 'fit' };
}

function newPromo(): PromoInput {
  return {
    promoId: '',
    eyebrow: '',
    title: '',
    subtitle: '',
    ctaLabel: '',
    ctaHref: '/shop',
    image: '',
    tone: 'dark',
    startsAt: '',
    endsAt: '',
  };
}

export function HomeSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm,
    toPatch,
    name: 'Home page',
    fieldFor,
  });
  const {
    register,
    control,
    formState: { errors },
  } = section.form;
  const announcements = useFieldArray({ control, name: 'announcements' });
  const promos = useFieldArray({ control, name: 'allPromos' });
  const [open, setOpen] = useState<string | null>(null);
  const openNewest = useRef(false);
  const newest = promos.fields[promos.fields.length - 1]?.id;
  useEffect(() => {
    // A banner just added opens for editing.
    if (openNewest.current && newest) {
      openNewest.current = false;
      setOpen(newest);
    }
  }, [newest]);

  return (
    <SettingsForm
      id="home"
      title="Home page"
      description="The ticker at the very top of every page and the banners on the home page. Banners can run between two dates; outside them they stay saved but hidden."
      section={section}
      saveLabel="Save home page"
    >
      <FieldGroup title={`Announcements, ${announcements.fields.length} of ${MAX_ANNOUNCEMENTS}`} description="Short facts, one per line: delivery, COD, returns. They scroll in the ticker in this order.">
        {announcements.fields.length === 0 ? (
          <p className="type-small text-muted">No announcements. The ticker is hidden.</p>
        ) : (
          <ol className="grid gap-2">
            {announcements.fields.map((row, index) => (
              <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
                <Field label={`Announcement ${index + 1}`} labelHidden error={errors.announcements?.[index]?.text?.message}>
                  <Input maxLength={140} {...register(`announcements.${index}.text`)} />
                </Field>
                <div className="flex">
                  <IconButton label={`Move announcement ${index + 1} up`} disabled={index === 0} onClick={() => announcements.move(index, index - 1)}>
                    <ArrowUp aria-hidden />
                  </IconButton>
                  <IconButton label={`Remove announcement ${index + 1}`} onClick={() => announcements.remove(index)}>
                    <Trash2 aria-hidden />
                  </IconButton>
                </div>
              </li>
            ))}
          </ol>
        )}
        {errors.announcements?.root?.message && <p className="type-small text-stop">{errors.announcements.root.message}</p>}
        <div>
          <Button
            variant="outline"
            size="sm"
            iconLeft={<Plus aria-hidden />}
            disabled={announcements.fields.length >= MAX_ANNOUNCEMENTS}
            onClick={() => announcements.append({ text: '' }, { shouldFocus: true })}
          >
            Add an announcement
          </Button>
        </div>
      </FieldGroup>

      <FieldGroup title={`Banners, ${promos.fields.length} of ${MAX_PROMOS}`} description="Shown on the home page in this order while they are live.">
        {promos.fields.length === 0 ? (
          <p className="type-small text-muted">No banners. The home page shows none.</p>
        ) : (
          <ol className="grid border-t border-line">
            {promos.fields.map((row, index) => (
              <PromoRow
                key={row.id}
                index={index}
                count={promos.fields.length}
                control={control}
                register={register}
                errors={errors}
                open={open === row.id}
                onToggle={() => setOpen((current) => (current === row.id ? null : row.id))}
                onMove={(to) => promos.move(index, to)}
                onRemove={() => promos.remove(index)}
              />
            ))}
          </ol>
        )}
        <div>
          <Button
            variant="outline"
            size="sm"
            iconLeft={<Plus aria-hidden />}
            disabled={promos.fields.length >= MAX_PROMOS}
            onClick={() => {
              openNewest.current = true;
              promos.append(newPromo(), { shouldFocus: false });
            }}
          >
            Add a banner
          </Button>
        </div>
      </FieldGroup>
    </SettingsForm>
  );
}

interface PromoRowProps {
  index: number;
  count: number;
  control: Control<Input, unknown, Output>;
  register: UseFormRegister<Input>;
  errors: FieldErrors<Input>;
  open: boolean;
  onToggle: () => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

function PromoRow({ index, count, control, register, errors, open, onToggle, onMove, onRemove }: PromoRowProps) {
  const promo = useWatch({ control, name: `allPromos.${index}` });
  const [picking, setPicking] = useState(false);
  const e = errors.allPromos?.[index];
  const hasError = Boolean(e);
  const state = promoState(promo ?? { startsAt: '', endsAt: '' });
  const panelId = `promo-panel-${index}`;
  const tone = promo?.tone ?? 'dark';

  return (
    <li className="border-b border-line">
      <div className="flex items-start gap-3 py-3">
        {/* The banner as the home page will draw it, small. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="focus-ring-inset grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
        >
          <span
            className={cn(
              'grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3',
              tone === 'yellow' && 'plane-brand',
              tone === 'dark' && 'plane-board',
              tone === 'light' && 'border border-line bg-surface',
            )}
          >
            <span className="grid min-w-0 gap-0.5">
              {promo?.eyebrow && <span className="type-label truncate text-muted">{promo.eyebrow}</span>}
              <span className="truncate font-extrabold">{promo?.title || 'Untitled banner'}</span>
            </span>
            {promo?.image && (
              <img src={imageVariant(promo.image, 480)} alt="" width={96} height={54} loading="lazy" decoding="async" className="h-10 w-16 object-cover" />
            )}
          </span>
          <ChevronDown aria-hidden className={cn('size-5 transition-transform dur-base', open && 'rotate-180')} />
          <span className="sr-only">{open ? 'Close' : 'Edit'} banner {index + 1}</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <Badge tone={state.tone} size="sm">
          {state.label}
        </Badge>
        {hasError && (
          <Badge tone="stop" size="sm" icon={<TriangleAlert aria-hidden />}>
            Needs fixing
          </Badge>
        )}
        <span className="ml-auto flex">
          <IconButton label={`Move banner ${index + 1} up`} size="sm" disabled={index === 0} onClick={() => onMove(index - 1)}>
            <ArrowUp aria-hidden />
          </IconButton>
          <IconButton label={`Move banner ${index + 1} down`} size="sm" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
            <ArrowDown aria-hidden />
          </IconButton>
          <IconButton label={`Remove banner ${index + 1}`} size="sm" onClick={onRemove}>
            <Trash2 aria-hidden />
          </IconButton>
        </span>
      </div>

      <div id={panelId} hidden={!open && !hasError} className="grid gap-4 pb-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Eyebrow" optional hint="A word or two above the title." error={e?.eyebrow?.message}>
            <Input maxLength={40} {...register(`allPromos.${index}.eyebrow`)} />
          </Field>
          <Field label="Title" error={e?.title?.message}>
            <Input maxLength={80} {...register(`allPromos.${index}.title`)} />
          </Field>
        </div>
        <Field label="Subtitle" optional error={e?.subtitle?.message}>
          <Input maxLength={200} {...register(`allPromos.${index}.subtitle`)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button text" optional hint="Says what happens: Plan my kit." error={e?.ctaLabel?.message}>
            <Input maxLength={40} {...register(`allPromos.${index}.ctaLabel`)} />
          </Field>
          <Field label="Button link" hint="A page on this store, starting with /" error={e?.ctaHref?.message}>
            <Input mono autoCapitalize="none" spellCheck={false} {...register(`allPromos.${index}.ctaHref`)} />
          </Field>
        </div>
        <Controller
          control={control}
          name={`allPromos.${index}.tone`}
          render={({ field }) => <Segmented label="Colour" options={TONES} value={field.value} onChange={field.onChange} />}
        />
        <Controller
          control={control}
          name={`allPromos.${index}.image`}
          render={({ field }) => (
            <div className="grid gap-2">
              <p className="type-small font-bold">Photo</p>
              <div className="flex flex-wrap items-center gap-3">
                {field.value ? (
                  <img src={imageVariant(field.value, 480)} alt="Chosen banner photo" width={160} height={90} loading="lazy" decoding="async" className="aspect-video w-40 object-cover" />
                ) : (
                  <span className="type-small text-muted">No photo: the banner is type only.</span>
                )}
                <Button variant="outline" size="sm" iconLeft={<ImagePlus aria-hidden />} onClick={() => setPicking(true)}>
                  {field.value ? 'Change photo' : 'Choose a photo'}
                </Button>
              </div>
              <PhotoPicker open={picking} onClose={() => setPicking(false)} value={field.value} onChange={(url) => field.onChange(url)} />
            </div>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Show from" optional hint="Blank: from now." error={e?.startsAt?.message}>
            <Input type="datetime-local" {...register(`allPromos.${index}.startsAt`)} />
          </Field>
          <Field label="Show until" optional hint="Blank: until you remove it." error={e?.endsAt?.message}>
            <Input type="datetime-local" {...register(`allPromos.${index}.endsAt`)} />
          </Field>
        </div>
      </div>
    </li>
  );
}
