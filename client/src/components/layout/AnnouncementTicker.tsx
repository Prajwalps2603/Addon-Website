import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

function Messages({ items }: { items: string[] }) {
  return (
    <ul className="flex shrink-0 items-center">
      {items.map((message, index) => (
        <li key={`${index}-${message}`} className="flex shrink-0 items-center">
          <span className="px-5 whitespace-nowrap">{message}</span>
          <span aria-hidden className="size-1.5 shrink-0 bg-brand" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The store's announcements as a strip of pit board along the very top. Several messages run as a
 * ticker that stops while pointed at or focused, and has its own pause button. One message, or
 * reduced motion, and the strip stands still. Nothing at all when there are no announcements.
 */
export function AnnouncementTicker() {
  const { data } = useSettings();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [paused, setPaused] = useState(false);
  const items = (data?.announcements ?? []).map((item) => item.trim()).filter(Boolean);

  if (items.length === 0) return null;

  const moving = items.length > 1 && !reduced;

  return (
    <section aria-label="Announcements" data-print="hide" className="group/ticker plane-board print:hidden">
      <div className="flex h-9 items-center type-label">
        {moving ? (
          <>
            {/* Readers get the list once, in order. The moving strip is for the eye. */}
            <ul className="sr-only">
              {items.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
            <div aria-hidden className="relative min-w-0 flex-1 overflow-hidden">
              <div
                className={cn(
                  'flex w-max animate-ticker group-hover/ticker:[animation-play-state:paused] group-focus-within/ticker:[animation-play-state:paused] motion-reduce:animate-none',
                  paused && '[animation-play-state:paused]',
                )}
              >
                <Messages items={items} />
                <Messages items={items} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPaused((now) => !now)}
              aria-pressed={paused}
              aria-label={paused ? 'Play announcements' : 'Pause announcements'}
              className="focus-ring-inset grid h-9 w-11 shrink-0 place-items-center border-l border-line"
            >
              {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
            </button>
          </>
        ) : (
          <ul className="container-page no-scrollbar flex items-center gap-6 overflow-x-auto">
            {items.map((message, index) => (
              <li key={`${index}-${message}`} className="flex shrink-0 items-center gap-6 whitespace-nowrap">
                {index > 0 && <span aria-hidden className="size-1.5 shrink-0 bg-brand" />}
                {message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
