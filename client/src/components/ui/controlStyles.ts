/**
 * The box shared by Input, Textarea and Select: soft grey fill, no border or focus ring, 12 px corners,
 * 16 px text (anything smaller makes iOS zoom the page on focus).
 */
export const controlBox =
  'w-full min-w-0 rounded-[12px] border border-transparent bg-surface text-base text-ink ' +
  'transition-colors duration-200 placeholder:text-muted hover:bg-surface-2 ' +
  'focus:bg-surface-2 focus:outline-none focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted ' +
  'aria-invalid:bg-stop-soft aria-invalid:border-stop/50';
