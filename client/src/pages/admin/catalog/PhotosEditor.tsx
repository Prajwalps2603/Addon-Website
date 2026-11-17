import { useRef, useState, type DragEvent } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from 'lucide-react';
import { TreadDivider } from '@/components/brand';
import { ProductFrame } from '@/components/commerce';
import { Badge, Button, Callout, IconButton } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { moveItem } from './utils';

const MAX_PHOTOS = 12;
const MAX_MB = 8;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface PhotosEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Alt text base: the product name. */
  productName: string;
  artKind?: string | null;
  error?: string;
}

/**
 * Product photos: upload several at once (each file in turn, so the owner sees real progress),
 * drag or use the arrows to reorder, the first is the main photo.
 */
export function PhotosEditor({ value, onChange, productName, artKind, error }: PhotosEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState(false);
  // The latest list, for uploads that finish after other edits.
  const latest = useRef(value);
  latest.current = value;

  const room = MAX_PHOTOS - value.length;
  const uploading = progress !== null;

  async function upload(files: File[]) {
    const notes: string[] = [];
    const usable = files.filter((file) => {
      if (!TYPES.includes(file.type)) {
        notes.push(`${file.name}: use a JPG, PNG or WebP photo.`);
        return false;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        notes.push(`${file.name}: larger than ${MAX_MB} MB.`);
        return false;
      }
      return true;
    });
    const batch = usable.slice(0, Math.max(0, MAX_PHOTOS - latest.current.length));
    if (usable.length > batch.length) notes.push(`Only ${MAX_PHOTOS} photos fit on a product: ${pluralize(usable.length - batch.length, 'file')} left out.`);
    setProblems(notes);
    if (batch.length === 0) return;

    setProgress({ done: 0, total: batch.length });
    for (const [index, file] of batch.entries()) {
      try {
        const { urls } = await api.admin.uploads.images([file]);
        onChange([...latest.current, ...urls]);
        latest.current = [...latest.current, ...urls];
      } catch (err) {
        notes.push(`${file.name}: ${errorMessage(err)}`);
        setProblems([...notes]);
      }
      setProgress({ done: index + 1, total: batch.length });
    }
    setProgress(null);
  }

  const onZoneDrop = (event: DragEvent<HTMLDivElement>) => {
    setDropOver(false);
    if (event.dataTransfer.files.length > 0) {
      event.preventDefault();
      void upload(Array.from(event.dataTransfer.files));
    }
  };

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            setDropOver(true);
          }
        }}
        onDragLeave={() => setDropOver(false)}
        onDrop={onZoneDrop}
        className={cn(
          'grid gap-4 border border-dashed p-4 transition-colors dur-quick',
          dropOver ? 'border-ink bg-brand-soft' : 'border-line-strong',
        )}
      >
        {value.length > 0 ? (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Photos, main photo first">
            {value.map((url, index) => (
              <li
                key={url}
                draggable
                onDragStart={(event) => {
                  setDragFrom(index);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(index));
                }}
                onDragOver={(event) => {
                  if (dragFrom !== null) event.preventDefault();
                }}
                onDrop={(event) => {
                  if (dragFrom === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(moveItem(value, dragFrom, index));
                  setDragFrom(null);
                }}
                onDragEnd={() => setDragFrom(null)}
                className={cn('grid gap-1.5 bg-page', dragFrom === index && 'opacity-50')}
              >
                <ProductFrame
                  image={url}
                  alt={`${productName || 'Product'}, photo ${index + 1}`}
                  artKind={artKind}
                  className="cursor-grab border border-line active:cursor-grabbing"
                >
                  {index === 0 && (
                    <Badge tone="brand" variant="solid" size="sm" className="absolute top-2 left-2">
                      Main photo
                    </Badge>
                  )}
                </ProductFrame>
                <div className="flex items-center justify-between">
                  <IconButton label={`Move photo ${index + 1} earlier`} size="sm" disabled={index === 0} onClick={() => onChange(moveItem(value, index, index - 1))}>
                    <ArrowLeft aria-hidden />
                  </IconButton>
                  <IconButton
                    label={`Move photo ${index + 1} later`}
                    size="sm"
                    disabled={index === value.length - 1}
                    onClick={() => onChange(moveItem(value, index, index + 1))}
                  >
                    <ArrowRight aria-hidden />
                  </IconButton>
                  <IconButton label={`Remove photo ${index + 1}`} size="sm" onClick={() => onChange(value.filter((_, i) => i !== index))}>
                    <Trash2 aria-hidden />
                  </IconButton>
                </div>
                {index > 0 && (
                  <Button variant="link" size="sm" onClick={() => onChange(moveItem(value, index, 0))} className="justify-self-start">
                    Make main photo
                  </Button>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="type-body text-muted">
            No photos yet. The shop shows the category icon and "Photo coming soon" until you add one.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="dark"
            iconLeft={<ImagePlus aria-hidden />}
            onClick={() => fileInput.current?.click()}
            disabled={room <= 0 || uploading}
            loading={uploading}
          >
            {value.length === 0 ? 'Add photos' : 'Add more photos'}
          </Button>
          <span className="type-small text-muted tnum">
            {room <= 0 ? `${MAX_PHOTOS} of ${MAX_PHOTOS}: remove one to add another.` : `JPG, PNG or WebP, up to ${MAX_MB} MB each. ${room} more fit.`}
          </span>
          <span className="type-small hidden text-muted md:inline">You can also drop files here.</span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={TYPES.join(',')}
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void upload(files);
          }}
        />

        {progress && (
          <div aria-live="polite">
            <TreadDivider progress={progress.done / progress.total} label={`Uploading photo ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`} />
            <p className="type-small mt-1.5 text-muted tnum">
              Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}
            </p>
          </div>
        )}
      </div>

      {problems.length > 0 && (
        <Callout tone="warn" title="Some photos were not added">
          <ul className="grid gap-1">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Callout>
      )}
      {error && (
        <p role="alert" className="type-small text-stop">
          {error}
        </p>
      )}
    </div>
  );
}
