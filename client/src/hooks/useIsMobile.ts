import { useMediaQuery } from '@/hooks/useMediaQuery';

/** True below Tailwind's `md` breakpoint (48rem): the layouts with the bottom bar. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 47.9375rem)');
}
