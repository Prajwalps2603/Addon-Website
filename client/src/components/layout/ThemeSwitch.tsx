import { cn } from '@/lib/cn';
import { useTheme } from '@/stores/theme';
import { Moon, Sun } from 'lucide-react';

/**
 * Day / night theme as a headlamp switch: press it and the lamp lights (the tell-tale fills red,
 * the beams show) and the site goes to its night theme. A toggle button, so it reads as "Night mode, on / off".
 */
export function ThemeSwitch({ withLabel = false, className }: { withLabel?: boolean; className?: string }) {
  const theme = useTheme((state) => state.theme);
  const toggle = useTheme((state) => state.toggle);
  const night = theme === 'dark';

  return (
    <button
      type="button"
      aria-pressed={night}
      aria-label={withLabel ? undefined : 'Night mode'}
      title={night ? 'Lights on: night theme. Press for day.' : 'Lights off: day theme. Press for night.'}
      onClick={toggle}
      className={cn(
        'group inline-flex h-11 shrink-0 items-center gap-3 rounded-control text-ink transition-transform dur-quick active:scale-[0.97]',
        withLabel ? 'w-full justify-between px-0' : 'w-11 justify-center',
        className,
      )}
    >
      {withLabel && (
        <span className="grid text-left">
          <span className="font-bold">Night mode</span>
          <span className="type-small text-muted">{night ? 'On. The site is dark.' : 'Off. The site is light.'}</span>
        </span>
      )}
      <span
        className={cn(
          'grid size-11 place-items-center rounded-full transition-colors dur-base group-hover:bg-surface-2',
          night && 'text-brand',
        )}
      >
        {night ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
      </span>
    </button>
  );
}
