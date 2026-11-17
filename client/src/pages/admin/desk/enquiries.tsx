/**
 * Enquiry pieces: the 48-hour acknowledgement clock, labels, and the drawer that opens one ticket.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Mail, Phone, TriangleAlert } from 'lucide-react';
import { Badge, Button, Drawer, Field, Textarea, toast, type BadgeToneName } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { formatDateTime } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import type { Enquiry, EnquiryKind } from '@/types/api';
import { Ago, CustomerWhatsApp, durationLabel, useDeskRefresh, useStoreName, whenLabel } from './common';
import { enquiryMailto, enquiryReply } from './messages';

export const ACK_HOURS = 48;
const ACK_MS = ACK_HOURS * 60 * 60 * 1000;

export const KIND_LABELS: Record<EnquiryKind, string> = {
  contact: 'General',
  complaint: 'Complaint',
  bulk: 'Bulk order',
  install: 'Fitting help',
  return: 'Return',
};

export const STATUS_WORDS: Record<Enquiry['status'], { label: string; tone: BadgeToneName }> = {
  new: { label: 'New', tone: 'brand' },
  acknowledged: { label: 'Acknowledged', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'fit' },
};

/** When the 48-hour acknowledgement is due, and how it stands now. */
export function ackDue(enquiry: Pick<Enquiry, 'createdAt' | 'status'>, now = Date.now()) {
  const due = new Date(enquiry.createdAt).getTime() + ACK_MS;
  const left = due - now;
  return {
    dueIso: new Date(due).toISOString(),
    overdue: enquiry.status === 'new' && left < 0,
    soon: enquiry.status === 'new' && left >= 0 && left < 12 * 60 * 60 * 1000,
    left,
  };
}

/** The "acknowledge by" cell: a due time, or how long overdue. Only new tickets have one. */
export function DueCell({ enquiry }: { enquiry: Enquiry }) {
  if (enquiry.status !== 'new') return <span className="text-muted">Done</span>;
  const due = ackDue(enquiry);
  if (due.overdue) {
    return (
      <Badge tone="stop" variant="solid" icon={<TriangleAlert />}>
        Overdue {durationLabel(due.left)}
      </Badge>
    );
  }
  return (
    <span className={due.soon ? 'font-bold text-warn' : undefined}>
      <time dateTime={due.dueIso} className="tnum">
        By {whenLabel(due.dueIso)}
      </time>
    </span>
  );
}

const noteSchema = z.object({ adminNote: z.string().trim().max(2000, { error: 'Keep the note under 2,000 characters.' }) });
type NoteInput = z.input<typeof noteSchema>;
type NoteOutput = z.output<typeof noteSchema>;

export interface EnquiryDrawerProps {
  enquiry: Enquiry | null;
  onClose: () => void;
  onChange: (enquiry: Enquiry) => void;
}

export function EnquiryDrawer({ enquiry, onClose, onChange }: EnquiryDrawerProps) {
  const refresh = useDeskRefresh();
  const storeName = useStoreName();
  // Keep the last ticket while the drawer animates out.
  const [shown, setShown] = useState<Enquiry | null>(enquiry);
  useEffect(() => {
    if (enquiry) setShown(enquiry);
  }, [enquiry]);

  const setStatus = useMutation<Enquiry, ApiError, { id: number; status: Enquiry['status'] }>({
    mutationFn: ({ id, status }) => api.admin.enquiries.update(id, { status }),
    onSuccess: async (saved) => {
      onChange(saved);
      toast.success(`${saved.ticketNumber} marked ${STATUS_WORDS[saved.status].label.toLowerCase()}`);
      await refresh(queryKeys.admin.enquiries.all());
    },
    onError: (error) => toast.error('Could not update the ticket', { description: error.message }),
  });

  const item = enquiry ?? shown;
  const mailto = item ? enquiryMailto(item, storeName) : '';
  const due = item ? ackDue(item) : null;

  const footer = item && (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {item.status === 'new' && (
          <Button
            className="flex-1"
            onClick={() => setStatus.mutate({ id: item.id, status: 'acknowledged' })}
            loading={setStatus.isPending && setStatus.variables?.status === 'acknowledged'}
            disabled={setStatus.isPending}
          >
            Mark acknowledged
          </Button>
        )}
        {item.status !== 'resolved' ? (
          <Button
            variant={item.status === 'new' ? 'outline' : 'primary'}
            className="flex-1"
            onClick={() => setStatus.mutate({ id: item.id, status: 'resolved' })}
            loading={setStatus.isPending && setStatus.variables?.status === 'resolved'}
            disabled={setStatus.isPending}
          >
            Mark resolved
          </Button>
        ) : (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setStatus.mutate({ id: item.id, status: 'acknowledged' })}
            loading={setStatus.isPending}
          >
            Reopen
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <CustomerWhatsApp phone={item.phone} text={enquiryReply(item, storeName)} className="flex-1">
          Reply on WhatsApp
        </CustomerWhatsApp>
        {mailto && (
          <Button href={mailto} variant="outline" className="flex-1" iconLeft={<Mail />}>
            Reply by email
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Drawer
      open={enquiry !== null}
      onClose={onClose}
      size="lg"
      title={item ? `Ticket ${item.ticketNumber}` : 'Ticket'}
      description={item ? `${KIND_LABELS[item.kind]} from ${item.name}` : undefined}
      footer={footer}
    >
      {item && (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_WORDS[item.status].tone} variant="solid">
              {STATUS_WORDS[item.status].label}
            </Badge>
            {due && item.status === 'new' && <DueCell enquiry={item} />}
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="Received">
              <time dateTime={item.createdAt} className="tnum">
                {formatDateTime(item.createdAt)}
              </time>{' '}
              <span className="text-muted">
                (<Ago iso={item.createdAt} />)
              </span>
            </Detail>
            {item.phone && (
              <Detail label="Phone">
                <a href={`tel:${item.phone}`} className="focus-ring inline-flex items-center gap-1.5 rounded-control underline underline-offset-4">
                  <Phone aria-hidden className="size-4" />
                  <span className="tnum">{formatPhone(item.phone)}</span>
                </a>
              </Detail>
            )}
            {item.email && (
              <Detail label="Email">
                <span className="break-all">{item.email}</span>
              </Detail>
            )}
            {item.orderNumber && (
              <Detail label="Order">
                <Link to={`/admin/orders/${encodeURIComponent(item.orderNumber)}`} className="focus-ring type-code rounded-control underline underline-offset-4">
                  {item.orderNumber}
                </Link>
              </Detail>
            )}
            {item.productName && (
              <Detail label="Product">
                {item.productName}
              </Detail>
            )}
            {item.vehicle && <Detail label="Car">{item.vehicle}</Detail>}
          </dl>

          <section aria-labelledby={`msg-${item.id}`} className="grid gap-2">
            <h3 id={`msg-${item.id}`} className="type-h3 break-words">
              {item.subject || 'Message'}
            </h3>
            <p className="max-w-prose break-words whitespace-pre-line">{item.message}</p>
          </section>

          <NoteForm key={item.id} enquiry={item} onSaved={onChange} />
        </div>
      )}
    </Drawer>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="type-label text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function NoteForm({ enquiry, onSaved }: { enquiry: Enquiry; onSaved: (enquiry: Enquiry) => void }) {
  const refresh = useDeskRefresh();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<NoteInput, unknown, NoteOutput>({ resolver: zodResolver(noteSchema), defaultValues: { adminNote: enquiry.adminNote } });

  const onSubmit: SubmitHandler<NoteOutput> = async (values) => {
    setFormError('');
    try {
      const saved = await api.admin.enquiries.update(enquiry.id, { adminNote: values.adminNote });
      reset({ adminNote: saved.adminNote });
      onSaved(saved);
      toast.success('Note saved');
      await refresh(queryKeys.admin.enquiries.all());
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-3 border-t border-line pt-5">
      <Field label="Internal note" hint="Only staff see this. What was said, what happens next." error={errors.adminNote?.message} optional>
        <Textarea rows={3} {...register('adminNote')} />
      </Field>
      {formError && !errors.adminNote && (
        <p role="alert" className="type-small font-bold text-stop">
          {formError}
        </p>
      )}
      <Button type="submit" variant="dark" loading={isSubmitting} disabled={!isDirty} className="justify-self-start">
        Save note
      </Button>
    </form>
  );
}
