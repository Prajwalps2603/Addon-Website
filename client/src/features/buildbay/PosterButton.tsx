import { useEffect, useRef, useState } from 'react';
import { ImageDown } from 'lucide-react';
import { Button, toast } from '@/components/ui';
import type { ButtonSize, ButtonVariant } from '@/components/ui';
import { saveFile } from '@/lib/api';
import type { BuildState } from '@/types/api';
import CarStage from '@/features/buildbay/stage/CarStage';
import { posterFileName, renderPoster } from './poster';
import type { PosterData } from './poster';

export interface PosterButtonProps {
  state: BuildState;
  /** Read when the button is pressed, so it always has the latest title and parts. */
  getData: () => PosterData;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

/**
 * "Download poster". Draws a still copy of the stage out of sight, turns it into a PNG with the
 * build's name, parts and total, and saves it.
 */
export function PosterButton({ state, getData, variant = 'outline', size = 'md', block, className }: PosterButtonProps) {
  const [busy, setBusy] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) return;
    let cancelled = false;
    const run = async () => {
      // Wait a frame so the still stage is in the document.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const svg = holder.current?.querySelector('svg');
      if (!svg) throw new Error('The stage was not ready. Try again.');
      const data = getData();
      const blob = await renderPoster(svg, data);
      if (!cancelled) {
        saveFile({ blob, filename: posterFileName(data.title) });
        toast.success('Poster saved', { description: 'Check your downloads.', id: 'poster' });
      }
    };
    run()
      .catch((error: unknown) => {
        if (!cancelled) toast.error('Could not make the poster', { description: error instanceof Error ? error.message : undefined, id: 'poster' });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once per press; getData is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        block={block}
        loading={busy}
        onClick={() => setBusy(true)}
        iconLeft={<ImageDown aria-hidden />}
        className={className}
      >
        Download poster
      </Button>
      {busy && (
        <div ref={holder} aria-hidden className="pointer-events-none fixed top-0 -left-[200vw] w-[1200px] opacity-0">
          <CarStage state={state} static />
        </div>
      )}
    </>
  );
}
