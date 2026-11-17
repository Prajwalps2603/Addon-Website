import type { ReactNode } from 'react';
import { Button, Modal } from '@/components/ui';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  /** What will happen, in one or two plain sentences. */
  children?: ReactNode;
  confirmLabel: string;
  /** `danger` for anything that removes data. */
  tone?: 'danger' | 'dark';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** A yes / no question before a destructive or far-reaching action. */
export function ConfirmModal({ open, title, children, confirmLabel, tone = 'danger', busy = false, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children && <div className="type-body grid gap-2">{children}</div>}
    </Modal>
  );
}
