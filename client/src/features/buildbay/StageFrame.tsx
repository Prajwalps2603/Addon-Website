import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { BuildState } from '@/types/api';
import CarStage from '@/features/buildbay/stage/CarStage';

export interface StageFrameProps {
  state: BuildState;
  /** Controls laid over the top right corner of the stage, on a small board. */
  tools?: ReactNode;
  /** A line over the bottom left corner (the "Sample" mark, the status). */
  corner?: ReactNode;
  static?: boolean;
  className?: string;
}

/** The car stage in its frame, with room for a few controls over the garage ceiling. */
export function StageFrame({ state, tools, corner, static: isStatic, className }: StageFrameProps) {
  return (
    <div className={cn('relative overflow-hidden bg-ink', className)}>
      <CarStage state={state} static={isStatic} />
      {tools && <div className="plane-board absolute top-2 right-2 flex items-center gap-0.5 p-0.5 sm:top-3 sm:right-3">{tools}</div>}
      {corner && <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 sm:bottom-3 sm:left-3">{corner}</div>}
    </div>
  );
}
