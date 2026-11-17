import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/** A part arriving on the car: a short drop into place. Plain group when not animating. */
export default function Appear({ animate, children, dy = -10 }: { animate: boolean; children: ReactNode; dy?: number }) {
  if (!animate) return <g>{children}</g>;
  return (
    <motion.g initial={{ opacity: 0, y: dy }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.g>
  );
}
