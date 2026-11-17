import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import * as z from 'zod';
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Plus, Trash2, TriangleAlert, Video } from 'lucide-react';
import { InstagramIcon } from '@/components/brand';
import { Badge, Button, Field, IconButton, Input, toast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { imageVariant } from '@/lib/images';
import { cn } from '@/lib/cn';
import type { AdminSettings, StudioWorkItem } from '@/types/api';
import { optionalLink, SettingsForm, text, useSectionForm } from './shared';

const MAX_ITEMS = 60;

/** An uploaded file (/uploads/...) or a full https link, or blank: the server's rule for video and poster. */
const mediaLink = z
  .string()
  .trim()
  .max(300, { error: 'Keep the link to 300 characters.' })
  .regex(/^(|\/(?!\/)\S*|https:\/\/\S+)$/, { error: 'Use an uploaded file or a full https:// link, or leave it blank.' });

const itemSchema = z.object({
  // The item's own id. Not 'id': useFieldArray keeps that name for its row keys.
  workId: z.string(),
  title: text(120).min(1, { error: 'Give the job a title.' }),
  car: text(80),
  kind: text(40),
  url: optionalLink,
  video: mediaLink,
  poster: mediaLink,
});

const schema = z.object({ studioWork: z.array(itemSchema).max(MAX_ITEMS, { error: `Keep it to ${MAX_ITEMS} jobs.` }) });

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

function toForm(s: AdminSettings): Input {
  return { studioWork: s.studioWork.map(({ id, ...item }) => ({ ...item, workId: id })) };
}

function toPatch(values: Output): { studioWork: StudioWorkItem[] } {
  return { studioWork: values.studioWork.map(({ workId, ...item }) => ({ ...item, id: workId })) };
}

function fieldFor(serverField: string): string {
  return serverField.replace(/^studioWork\.(\d+)\.id$/, 'studioWork.$1.workId');
}

/** The kinds already in use, offered as suggestions (Full build, Lighting, Audio...). */
function kindsOf(items: readonly { kind?: string }[] | undefined): string[] {
  return [...new Set((items ?? []).map((item) => item.kind?.trim() ?? '').filter(Boolean))].sort();
}

export function StudioWorkSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm,
    toPatch,
    name: 'Studio work',
    fieldFor,
  });
  const {
    register,
    control,
    formState: { errors },
  } = section.form;
  const items = useFieldArray({ control, name: 'studioWork' });
  const watched = useWatch({ control, name: 'studioWork' });
  const kinds = kindsOf(watched);
  const instagram = settings.social.instagram;

  const [open, setOpen] = useState<string | null>(null);
  const openNewest = useRef(false);
  const newest = items.fields[0]?.id;
  useEffect(() => {
    if (openNewest.current && newest) {
      openNewest.current = false;
      setOpen(newest);
    }
  }, [newest]);

  return (
    <SettingsForm
      id="studio-work"
      title="From the studio"
      description="Recent jobs from the studio, shown on the home page and the booking page in this order. Link each one to its Instagram post or reel."
      section={section}
      saveLabel="Save studio work"
    >
      <datalist id="studio-work-kinds">
        {kinds.map((kind) => (
          <option key={kind} value={kind} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          iconLeft={<Plus aria-hidden />}
          disabled={items.fields.length >= MAX_ITEMS}
          onClick={() => {
            openNewest.current = true;
            items.prepend(
              { workId: '', title: '', car: '', kind: '', url: instagram ? `${instagram.replace(/\/+$/, '')}/reels/` : '', video: '', poster: '' },
              { shouldFocus: false },
            );
          }}
        >
          Add a job at the top
        </Button>
        <p className="type-small text-muted">
          {items.fields.length} of {MAX_ITEMS}
        </p>
      </div>
      {items.fields.length === 0 ? (
        <p className="type-small text-muted">No jobs. The studio work row is hidden on the shop.</p>
      ) : (
        <ol className="grid border-t border-line">
          {items.fields.map((row, index) => (
            <WorkRow
              key={row.id}
              index={index}
              count={items.fields.length}
              control={control}
              register={register}
              errors={errors}
              open={open === row.id}
              onToggle={() => setOpen((current) => (current === row.id ? null : row.id))}
              onMove={(to) => items.move(index, to)}
              onRemove={() => items.remove(index)}
            />
          ))}
        </ol>
      )}
      {errors.studioWork?.root?.message && <p className="type-small font-bold text-stop">{errors.studioWork.root.message}</p>}
    </SettingsForm>
  );
}

interface WorkRowProps {
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

function WorkRow({ index, count, control, register, errors, open, onToggle, onMove, onRemove }: WorkRowProps) {
  const item = useWatch({ control, name: `studioWork.${index}` });
  const e = errors.studioWork?.[index];
  const hasError = Boolean(e);
  const panelId = `work-panel-${index}`;

  return (
    <li className="border-b border-line">
      <div className="flex items-start gap-2 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="focus-ring-inset grid min-w-0 flex-1 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-control text-left"
        >
          <span className="grid aspect-square place-items-center overflow-hidden border border-line bg-surface">
            {item?.poster ? (
              <img src={imageVariant(item.poster, 480)} alt="" width={56} height={56} loading="lazy" decoding="async" className="size-full object-cover" />
            ) : item?.video ? (
              <Video aria-hidden className="size-5 text-muted" />
            ) : (
              <InstagramIcon size={20} title="" />
            )}
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate font-extrabold">{item?.title || 'New job'}</span>
            <span className="type-small truncate text-muted">{[item?.car, item?.kind].filter(Boolean).join(', ') || 'No car or kind yet'}</span>
          </span>
          <ChevronDown aria-hidden className={cn('size-5 transition-transform dur-base', open && 'rotate-180')} />
          <span className="sr-only">{open ? 'Close' : 'Edit'} job {index + 1}</span>
        </button>
        <span className="flex shrink-0">
          <IconButton label={`Move job ${index + 1} up`} size="sm" disabled={index === 0} onClick={() => onMove(index - 1)}>
            <ArrowUp aria-hidden />
          </IconButton>
          <IconButton label={`Move job ${index + 1} down`} size="sm" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
            <ArrowDown aria-hidden />
          </IconButton>
          <IconButton label={`Remove job ${index + 1}`} size="sm" onClick={onRemove}>
            <Trash2 aria-hidden />
          </IconButton>
        </span>
      </div>
      {hasError && (
        <div className="pb-3">
          <Badge tone="stop" size="sm" icon={<TriangleAlert aria-hidden />}>
            Needs fixing
          </Badge>
        </div>
      )}

      <div id={panelId} hidden={!open && !hasError} className="grid gap-4 pb-5">
        <Field label="Title" error={e?.title?.message} hint="What was done, in a few words: Tri-colour projector fog lamps.">
          <Input maxLength={120} {...register(`studioWork.${index}.title`)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Car" optional error={e?.car?.message} hint="Make and model. Blank for an offer post.">
            <Input maxLength={80} {...register(`studioWork.${index}.car`)} />
          </Field>
          <Field label="Kind of work" optional error={e?.kind?.message} hint="Full build, Lighting, Audio, Films...">
            <Input maxLength={40} list="studio-work-kinds" {...register(`studioWork.${index}.kind`)} />
          </Field>
        </div>
        <Field label="Link to the post" optional error={e?.url?.message} hint="The reel or post on Instagram, starting with https://">
          <Input type="url" inputMode="url" {...register(`studioWork.${index}.url`)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name={`studioWork.${index}.poster`}
            render={({ field }) => <PosterField value={field.value} onChange={field.onChange} error={e?.poster?.message} title={item?.title ?? ''} />}
          />
          <Controller
            control={control}
            name={`studioWork.${index}.video`}
            render={({ field }) => <VideoField value={field.value} onChange={field.onChange} error={e?.video?.message} />}
          />
        </div>
      </div>
    </li>
  );
}

/** The reel clip for a job: upload an MP4 straight from the phone or PC. It plays on the home page when hovered. */
function VideoField({ value, onChange, error }: { value: string; onChange: (url: string) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.admin.uploads.video(file);
      onChange(url);
      toast.success('Video uploaded', { description: 'Save studio work to keep it.' });
    } catch (failure) {
      toast.error('Could not upload the video', { description: errorMessage(failure) });
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="grid content-start gap-2">
      <p className="type-small font-bold">
        Reel video <span className="font-normal text-muted">(optional, MP4 up to 60 MB)</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <video src={value} muted playsInline preload="metadata" className="h-24 w-14 border border-line bg-black object-cover" />
        ) : (
          <span className="type-small text-muted">No video yet. The card shows a photo instead.</span>
        )}
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" iconLeft={<Video aria-hidden />} loading={uploading} onClick={() => input.current?.click()}>
            {value ? 'Replace video' : 'Upload video'}
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange('')}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </div>
      {error && <p className="type-small text-stop">{error}</p>}
    </div>
  );
}

function PosterField({ value, onChange, error, title }: { value: string; onChange: (url: string) => void; error?: string; title: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { urls } = await api.admin.uploads.images([file]);
      if (urls[0]) {
        onChange(urls[0]);
        toast.success('Poster uploaded', { description: 'Save studio work to keep it.' });
      }
    } catch (failure) {
      toast.error('Could not upload the poster', { description: errorMessage(failure) });
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="grid content-start gap-2">
      <p className="type-small font-bold">
        Poster <span className="font-normal text-muted">(optional)</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img
            src={imageVariant(value, 480)}
            alt={title ? `Poster for ${title}` : 'Chosen poster'}
            width={96}
            height={96}
            loading="lazy"
            decoding="async"
            className="size-24 border border-line object-cover"
          />
        ) : (
          <span className="type-small text-muted">No poster yet.</span>
        )}
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" iconLeft={<ImagePlus aria-hidden />} loading={uploading} onClick={() => input.current?.click()}>
            {value ? 'Replace' : 'Upload a photo'}
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange('')}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </div>
      <p className="type-small text-muted">A still from the reel, JPG, PNG or WebP up to 8 MB.</p>
      {error && <p className="type-small font-bold text-stop">{error}</p>}
    </div>
  );
}
