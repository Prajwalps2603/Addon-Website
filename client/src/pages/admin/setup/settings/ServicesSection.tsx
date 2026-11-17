import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import * as z from 'zod';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { CONSULT_ID, chargeLabel } from '@/components/studio';
import { Badge, Button, Checkbox, Field, IconButton, Input, Skeleton, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { minutesLabel, pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminSettings, Category, StudioService } from '@/types/api';
import { FieldGroup, numberOf, rupees, SettingsForm, text, useSectionForm, wholeNumber } from './shared';

const MAX_SERVICES = 40;

const serviceSchema = z.object({
  // The service's own id. Not 'id': useFieldArray keeps that name for its row keys.
  serviceId: z
    .string()
    .trim()
    .max(40, { error: 'Keep it to 40 characters.' })
    .regex(/^[a-z0-9][a-z0-9-]*$/, { error: 'Use lower-case letters, numbers and hyphens, for example stereo-install.' }),
  name: text(80).min(1, { error: 'Name the service.' }),
  charge: rupees(),
  minutes: wholeNumber(24 * 60, 'minutes'),
  blurb: text(300),
  subcategorySlugs: z.array(z.string()).max(40, { error: 'Keep it to 40 subcategories.' }),
});

const schema = z
  .object({ services: z.array(serviceSchema).max(MAX_SERVICES, { error: `Keep it to ${MAX_SERVICES} services.` }) })
  .superRefine((values, ctx) => {
    const ids = values.services.map((service) => service.serviceId.trim());
    ids.forEach((id, index) => {
      if (id && ids.indexOf(id) !== index) ctx.addIssue({ code: 'custom', path: ['services', index, 'serviceId'], message: 'Another service already uses this id.' });
    });
  });

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;
type ServiceInput = Input['services'][number];

function toForm(s: AdminSettings): Input {
  return { services: s.services.map(({ id, ...service }) => ({ ...service, serviceId: id, subcategorySlugs: [...service.subcategorySlugs] })) };
}

function toPatch(values: Output): { services: StudioService[] } {
  return {
    services: values.services.map(({ serviceId, ...service }) => ({
      ...service,
      id: serviceId.trim(),
      blurb: service.blurb.trim(),
      subcategorySlugs: serviceId.trim() === CONSULT_ID ? [] : [...new Set(service.subcategorySlugs)],
    })),
  };
}

function fieldFor(serverField: string): string {
  return serverField.replace(/^services\.(\d+)\.id$/, 'services.$1.serviceId').replace(/^services\.(\d+)\.subcategorySlugs\.\d+$/, 'services.$1.subcategorySlugs');
}

/** 'Speaker fitting' → 'speaker-fitting'. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function newService(): ServiceInput {
  return { serviceId: '', name: '', charge: 0, minutes: 60, blurb: '', subcategorySlugs: [] };
}

interface SubcategoryGroup {
  parent: Category;
  children: Category[];
}

/** Top-level categories with their subcategories, for the "fits these parts" ticks. */
function useSubcategoryGroups() {
  const query = useQuery({
    queryKey: queryKeys.admin.categories.list(),
    queryFn: ({ signal }) => api.admin.categories.list({ signal }),
    staleTime: 5 * 60_000,
  });
  const groups = useMemo<SubcategoryGroup[]>(() => {
    const all = query.data ?? [];
    const parents = all.filter((category) => category.parentId === null);
    return parents
      .map((parent) => ({
        parent,
        children: (parent.children?.length ? parent.children : all.filter((category) => category.parentId === parent.id)).slice().sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .filter((group) => group.children.length > 0)
      .sort((a, b) => a.parent.sortOrder - b.parent.sortOrder);
  }, [query.data]);
  return { query, groups };
}

export function ServicesSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm,
    toPatch,
    name: 'Fitting services',
    fieldFor,
  });
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = section.form;
  const services = useFieldArray({ control, name: 'services' });
  const watched = useWatch({ control, name: 'services' });
  const { query: categories, groups } = useSubcategoryGroups();
  const savedIds = useMemo(() => new Set(settings.services.map((service) => service.id)), [settings.services]);

  // Which service each subcategory is ticked under, to warn when one part would have two fitting charges.
  const owners = useMemo(() => {
    const map = new Map<string, number[]>();
    (watched ?? []).forEach((service, index) => {
      for (const slug of service?.subcategorySlugs ?? []) map.set(slug, [...(map.get(slug) ?? []), index]);
    });
    return map;
  }, [watched]);

  const [open, setOpen] = useState<string | null>(null);
  const openNewest = useRef(false);
  const newest = services.fields[services.fields.length - 1]?.id;
  useEffect(() => {
    if (openNewest.current && newest) {
      openNewest.current = false;
      setOpen(newest);
    }
  }, [newest]);

  const unmapped = groups.flatMap((group) => group.children).filter((child) => !owners.has(child.slug));

  return (
    <SettingsForm
      id="services"
      title="Fitting services"
      description="What the studio fits and what it charges. A part can be fitted at the studio when its subcategory is ticked under a service; the charge is added at checkout as a service. Charges include GST."
      section={section}
      saveLabel="Save services"
    >
      {services.fields.length === 0 ? (
        <p className="type-small text-muted">No services. Shoppers cannot book a fitting, and no part offers fitting at the studio.</p>
      ) : (
        <ol className="grid border-t border-line">
          {services.fields.map((row, index) => (
            <ServiceRow
              key={row.id}
              index={index}
              count={services.fields.length}
              control={control}
              register={register}
              errors={errors}
              saved={savedIds.has(row.serviceId)}
              groups={groups}
              groupsLoading={categories.isPending}
              owners={owners}
              open={open === row.id}
              onToggle={() => setOpen((current) => (current === row.id ? null : row.id))}
              onMove={(to) => services.move(index, to)}
              onRemove={() => services.remove(index)}
              onName={(name) => {
                // A new service takes its id from the name until the id is typed by hand.
                const current = watched?.[index];
                if (!current || savedIds.has(current.serviceId)) return;
                if (current.serviceId === '' || current.serviceId === slugify(current.name)) {
                  setValue(`services.${index}.serviceId`, slugify(name), { shouldDirty: true });
                }
              }}
            />
          ))}
        </ol>
      )}
      {errors.services?.root?.message && <p className="type-small font-bold text-stop">{errors.services.root.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          iconLeft={<Plus aria-hidden />}
          disabled={services.fields.length >= MAX_SERVICES}
          onClick={() => {
            openNewest.current = true;
            services.append(newService(), { shouldFocus: false });
          }}
        >
          Add a service
        </Button>
        {groups.length > 0 && unmapped.length > 0 && (
          <p className="type-small text-muted">
            {pluralize(unmapped.length, 'subcategory', 'subcategories')} not fitted at the studio: {unmapped.slice(0, 6).map((child) => child.name).join(', ')}
            {unmapped.length > 6 ? ' and more' : ''}.
          </p>
        )}
      </div>
    </SettingsForm>
  );
}

interface ServiceRowProps {
  index: number;
  count: number;
  control: Control<Input, unknown, Output>;
  register: UseFormRegister<Input>;
  errors: FieldErrors<Input>;
  /** Already saved: the id stays fixed, because bookings refer to it. */
  saved: boolean;
  groups: SubcategoryGroup[];
  groupsLoading: boolean;
  owners: Map<string, number[]>;
  open: boolean;
  onToggle: () => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onName: (name: string) => void;
}

function ServiceRow({ index, count, control, register, errors, saved, groups, groupsLoading, owners, open, onToggle, onMove, onRemove, onName }: ServiceRowProps) {
  const service = useWatch({ control, name: `services.${index}` });
  const e = errors.services?.[index];
  const hasError = Boolean(e);
  const panelId = `service-panel-${index}`;
  const consult = service?.serviceId === CONSULT_ID;
  const ticked = service?.subcategorySlugs?.length ?? 0;
  const charge = numberOf(service?.charge);
  const minutes = numberOf(service?.minutes);
  const nameField = register(`services.${index}.name`);
  const shared = (service?.subcategorySlugs ?? []).filter((slug) => (owners.get(slug)?.length ?? 0) > 1);

  return (
    <li className="border-b border-line">
      <div className="flex items-start gap-2 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="focus-ring-inset grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-control text-left"
        >
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate font-extrabold">{service?.name || 'New service'}</span>
            <span className="type-small text-muted tnum">
              {[
                Number.isNaN(charge) ? null : chargeLabel({ id: service?.serviceId ?? '', charge }),
                Number.isNaN(minutes) || minutes === 0 ? null : minutesLabel(minutes),
                consult ? 'Booked on its own' : ticked > 0 ? `fits ${pluralize(ticked, 'subcategory', 'subcategories')}` : 'Booked on its own only',
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          </span>
          <ChevronDown aria-hidden className={cn('size-5 transition-transform dur-base', open && 'rotate-180')} />
          <span className="sr-only">{open ? 'Close' : 'Edit'} service {index + 1}</span>
        </button>
        <span className="flex shrink-0">
          <IconButton label={`Move service ${index + 1} up`} size="sm" disabled={index === 0} onClick={() => onMove(index - 1)}>
            <ArrowUp aria-hidden />
          </IconButton>
          <IconButton label={`Move service ${index + 1} down`} size="sm" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
            <ArrowDown aria-hidden />
          </IconButton>
          <IconButton label={`Remove service ${index + 1}`} size="sm" onClick={onRemove}>
            <Trash2 aria-hidden />
          </IconButton>
        </span>
      </div>
      {(hasError || shared.length > 0) && (
        <div className="flex flex-wrap gap-2 pb-3">
          {hasError && (
            <Badge tone="stop" size="sm" icon={<TriangleAlert aria-hidden />}>
              Needs fixing
            </Badge>
          )}
          {shared.length > 0 && (
            <Badge tone="warn" size="sm" icon={<TriangleAlert aria-hidden />}>
              Shares a subcategory with another service
            </Badge>
          )}
        </div>
      )}

      <div id={panelId} hidden={!open && !hasError} className="grid gap-4 pb-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field label="Name" error={e?.name?.message}>
            <Input
              maxLength={80}
              {...nameField}
              onChange={(event) => {
                void nameField.onChange(event);
                onName(event.target.value);
              }}
            />
          </Field>
          <Field
            label="Id"
            error={e?.serviceId?.message}
            hint={saved ? 'Fixed once saved: bookings refer to it.' : 'Made from the name. Lower-case letters and hyphens.'}
          >
            <Input mono autoCapitalize="none" spellCheck={false} readOnly={saved} aria-readonly={saved} className={saved ? 'text-muted' : undefined} {...register(`services.${index}.serviceId`)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fitting charge" error={e?.charge?.message} hint="Per part fitted, GST included. 0 when the fitting comes with the part.">
            <Input inputMode="numeric" className="tnum" leading={<span aria-hidden>₹</span>} {...register(`services.${index}.charge`)} />
          </Field>
          <Field label="Time it takes" error={e?.minutes?.message} hint="Told to the customer when they book.">
            <Input inputMode="numeric" className="tnum" trailing={<span className="type-small text-muted">min</span>} {...register(`services.${index}.minutes`)} />
          </Field>
        </div>
        <Field label="Short description" optional error={e?.blurb?.message} hint="One line on the booking page.">
          <Textarea rows={2} maxLength={300} {...register(`services.${index}.blurb`)} />
        </Field>

        {consult ? (
          <p className="type-small text-muted">The free consultation is booked on its own. It is never charged on a part.</p>
        ) : (
          <FieldGroup title="Fits parts from" description="Parts in a ticked subcategory get a Fit at the studio option in the cart, with this charge.">
            {groupsLoading ? (
              <div className="grid gap-2 sm:grid-cols-2" aria-hidden>
                {[0, 1, 2, 3].map((key) => (
                  <Skeleton key={key} className="h-6 w-48" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <p className="type-small text-muted">No subcategories in the catalogue yet.</p>
            ) : (
              <Controller
                control={control}
                name={`services.${index}.subcategorySlugs`}
                render={({ field }) => {
                  const value = field.value ?? [];
                  return (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {groups.map((group) => (
                        <div key={group.parent.id} className="grid content-start gap-1">
                          <p className="type-label text-muted">{group.parent.name}</p>
                          {group.children.map((child) => {
                            const elsewhere = (owners.get(child.slug) ?? []).some((owner) => owner !== index);
                            return (
                              <Checkbox
                                key={child.id}
                                label={child.name}
                                description={elsewhere ? 'Also under another service' : undefined}
                                checked={value.includes(child.slug)}
                                onChange={(event) =>
                                  field.onChange(event.target.checked ? [...value, child.slug] : value.filter((slug) => slug !== child.slug))
                                }
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
            )}
            {e?.subcategorySlugs?.message && <p className="type-small font-bold text-stop">{e.subcategorySlugs.message}</p>}
          </FieldGroup>
        )}
      </div>
    </li>
  );
}
