import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { RollingTyre } from '@/components/brand';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { imageVariant } from '@/lib/images';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

export interface PhotoPickerProps {
  /** Uploaded photo URLs, as the report will send them. */
  value: string[];
  onChange: (urls: string[]) => void;
  /** Told while an upload is running, so the form can wait for it. */
  onBusyChange?: (busy: boolean) => void;
  max?: number;
  error?: string;
}

interface Pending {
  id: number;
  preview: string;
}

/**
 * Up to three photos for a fitted report. Each batch uploads as soon as it is chosen,
 * shows a preview at once and can be removed again before sending.
 */
export function PhotoPicker({ value, onChange, onBusyChange, max = 3, error }: PhotoPickerProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const counter = useRef(0);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => onBusyChange?.(pending.length > 0), [pending.length, onBusyChange]);

  const room = max - value.length - pending.length;

  const choose = async (list: FileList | null) => {
    setProblem(null);
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const wrongType = files.find((file) => !ACCEPT.includes(file.type));
    if (wrongType) {
      setProblem(`${wrongType.name} is not a JPG, PNG or WebP photo.`);
      return;
    }
    const tooBig = files.find((file) => file.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setProblem(`${tooBig.name} is over ${MAX_MB} MB. Choose a smaller photo.`);
      return;
    }
    const batch = files.slice(0, Math.max(0, room));
    if (files.length > batch.length) setProblem(`Only ${max} photos fit on a report. The first ${batch.length || 'none'} of these were added.`);
    if (batch.length === 0) return;

    const items = batch.map((file) => {
      counter.current += 1;
      return { id: counter.current, preview: URL.createObjectURL(file) };
    });
    setPending((current) => [...current, ...items]);
    try {
      const { urls } = await api.reports.uploadPhotos(batch);
      onChange([...latest.current, ...urls].slice(0, max));
    } catch (failure) {
      setProblem(errorMessage(failure, 'The photos did not upload. Try again.'));
    } finally {
      items.forEach((item) => URL.revokeObjectURL(item.preview));
      setPending((current) => current.filter((item) => !items.some((done) => done.id === item.id)));
      if (input.current) input.current.value = '';
    }
  };

  const message = problem ?? error;

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="type-small font-bold">
          Photos
        </label>
        <span className="type-small text-muted">Optional, up to {max}</span>
      </div>
      <p className="type-small text-muted">The part on the car helps the next buyer most. JPG, PNG or WebP, {MAX_MB} MB each.</p>

      <ul className="grid grid-cols-3 gap-2 sm:max-w-md" aria-label="Photos added">
        {value.map((url, index) => (
          <li key={url} className="plane-frame relative aspect-square overflow-hidden border border-line">
            <img src={imageVariant(url, 480)} alt={`Photo ${index + 1}`} width={160} height={160} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== url))}
              className="absolute top-1 right-1 grid size-9 place-items-center rounded-control bg-ink text-page hover:bg-ink-2"
              aria-label={`Remove photo ${index + 1}`}
            >
              <X aria-hidden className="size-4" />
            </button>
          </li>
        ))}
        {pending.map((item) => (
          <li key={item.id} className="plane-frame relative aspect-square overflow-hidden border border-line" aria-busy="true">
            <img src={item.preview} alt="Uploading photo" className="size-full object-cover opacity-50" />
            <span className="absolute inset-0 grid place-items-center">
              <RollingTyre size={28} label="Uploading" />
            </span>
          </li>
        ))}
        {room > 0 && (
          <li>
            <label
              htmlFor={inputId}
              className={cn(
                'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border border-dashed border-line-strong text-muted',
                'transition-colors dur-quick hover:border-ink hover:text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
              )}
            >
              <ImagePlus aria-hidden className="size-6" />
              <span className="type-small font-bold">Add photo</span>
              <input
                ref={input}
                id={inputId}
                type="file"
                accept={ACCEPT.join(',')}
                multiple
                className="sr-only"
                onChange={(event) => void choose(event.target.files)}
              />
            </label>
          </li>
        )}
      </ul>
      {message && (
        <p role="alert" className="type-small font-medium text-stop">
          {message}
        </p>
      )}
    </div>
  );
}
