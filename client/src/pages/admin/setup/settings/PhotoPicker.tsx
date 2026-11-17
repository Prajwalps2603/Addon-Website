import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ImageOff, Upload } from 'lucide-react';
import { Button, Drawer, EmptyState, Skeleton, toast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { imageVariant } from '@/lib/images';
import { cn } from '@/lib/cn';

interface EditorialPhoto {
  url: string;
  thumb: string;
  title: string;
}

/** The editorial photos from the credits list (loaded only when the picker opens). */
async function loadEditorial(): Promise<EditorialPhoto[]> {
  const module = await import('@/data/photoCredits.json');
  const rows = (module.default ?? []) as unknown as { url?: string; thumb?: string; title?: string }[];
  return rows
    .filter((row): row is { url: string; thumb?: string; title?: string } => typeof row.url === 'string' && row.url.startsWith('/editorial/'))
    .map((row) => ({ url: row.url, thumb: row.thumb || imageVariant(row.url, 960), title: row.title ?? '' }));
}

export interface PhotoPickerProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (url: string) => void;
}

/** Choose a banner photo: one of the editorial photos, or upload your own. */
export function PhotoPicker({ open, onClose, value, onChange }: PhotoPickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const photos = useQuery({ queryKey: ['editorial-photos'], queryFn: loadEditorial, enabled: open, staleTime: Infinity });

  const choose = (url: string) => {
    onChange(url);
    onClose();
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { urls } = await api.admin.uploads.images([file]);
      const url = urls[0];
      if (url) {
        toast.success('Photo uploaded');
        choose(url);
      }
    } catch (error) {
      toast.error('Could not upload the photo', { description: errorMessage(error) });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Banner photo"
      description="A wide photo works best. Uploads are resized for the web."
      size="lg"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button iconLeft={<Upload aria-hidden />} loading={uploading} onClick={() => fileInput.current?.click()}>
            Upload a photo
          </Button>
          {value && (
            <Button variant="ghost" iconLeft={<ImageOff aria-hidden />} onClick={() => choose('')}>
              No photo
            </Button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </div>
      }
    >
      {photos.isPending ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-video w-full" />
          ))}
        </div>
      ) : photos.error || photos.data.length === 0 ? (
        <EmptyState
          size="sm"
          title="No editorial photos here yet"
          description="Upload a photo of your own instead."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3" aria-label="Editorial photos">
          {photos.data.map((photo) => {
            const selected = photo.url === value;
            return (
              <li key={photo.url}>
                <button
                  type="button"
                  onClick={() => choose(photo.url)}
                  aria-pressed={selected}
                  className={cn(
                    'focus-ring relative block w-full overflow-hidden rounded-control border',
                    selected ? 'border-ink' : 'border-transparent',
                  )}
                >
                  <img
                    src={photo.thumb}
                    alt={photo.title}
                    width={480}
                    height={270}
                    loading="lazy"
                    decoding="async"
                    className="aspect-video w-full object-cover"
                  />
                  {selected && (
                    <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-ink text-page">
                      <Check aria-hidden className="size-4" />
                      <span className="sr-only">Chosen</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
