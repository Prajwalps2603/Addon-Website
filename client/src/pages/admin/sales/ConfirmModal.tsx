import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button, Field, Modal, Textarea, type ButtonVariant } from '@/components/ui';

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** The button that does it, as a verb: "Cancel order", "Delete coupon". */
  confirmLabel: string;
  /** "Keep order". Defaults to "Go back". */
  cancelLabel?: string;
  tone?: Extract<ButtonVariant, 'danger' | 'primary' | 'dark'>;
  /** Asks for a reason before the action runs. */
  reason?: { label: string; hint?: string; placeholder?: string; required?: boolean };
  loading?: boolean;
  onConfirm: (reason: string) => void;
}

const schema = z.object({ reason: z.string().trim().max(500, { error: 'Keep it under 500 characters' }) });
type Values = z.infer<typeof schema>;

/** A yes-or-no question before a destructive or one-way action, with an optional reason. */
export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Go back',
  tone = 'danger',
  reason,
  loading = false,
  onConfirm,
}: ConfirmModalProps) {
  const formId = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '' } });

  useEffect(() => {
    if (open) reset({ reason: '' });
  }, [open, reset]);

  const submit = handleSubmit((values) => {
    if (reason?.required && values.reason.length < 3) {
      setError('reason', { message: 'Write a short reason. It goes in the order log.' });
      return;
    }
    onConfirm(values.reason);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="submit" form={formId} variant={tone} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-4">
        {children}
        {reason && (
          <Field label={reason.label} hint={reason.hint} error={errors.reason?.message} optional={!reason.required} required={reason.required}>
            <Textarea rows={3} placeholder={reason.placeholder} {...register('reason')} />
          </Field>
        )}
      </form>
    </Modal>
  );
}
