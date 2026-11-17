import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button, Field, Input, Modal, toast } from '@/components/ui';
import { api, errorMessage, saveFile } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { addDaysIst, monthStartIst, todayIst } from './dates';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Pick a date' });
const schema = z
  .object({ from: day, to: day })
  .refine((value) => value.from <= value.to, { path: ['to'], error: 'The end date is before the start date' });
type Values = z.infer<typeof schema>;

/** "Export for accountant": a CSV of every order line with the GST split, for a date range. */
export function ExportOrdersButton({ from, to }: { from?: string; to?: string }) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const exportCsv = useMutation({
    mutationFn: (values: Values) => api.admin.orders.exportCsv(values),
    onSuccess: (file, values) => {
      saveFile(file);
      toast.success('CSV downloaded', { description: `Orders from ${formatDate(values.from)} to ${formatDate(values.to)}` });
      setOpen(false);
    },
    onError: (error) => {
      const message = applyApiError(error, setError);
      toast.error('Could not export the orders', { description: errorMessage(error, message) });
    },
  });

  const show = () => {
    reset({ from: from ?? monthStartIst(), to: to ?? todayIst() });
    setOpen(true);
  };

  const quick = (nextFrom: string, nextTo: string) => {
    setValue('from', nextFrom, { shouldValidate: true });
    setValue('to', nextTo, { shouldValidate: true });
  };

  const lastMonthEnd = addDaysIst(-Number(todayIst().slice(8, 10)));
  const lastMonthStart = `${lastMonthEnd.slice(0, 8)}01`;

  return (
    <>
      <Button variant="outline" iconLeft={<Download aria-hidden />} onClick={show}>
        Export for accountant
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Export for accountant"
        description="A CSV with one row per order line and the GST split (CGST, SGST or IGST)."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="submit" form={formId} variant="dark" iconLeft={<Download aria-hidden />} loading={exportCsv.isPending}>
              Download CSV
            </Button>
          </>
        }
      >
        <form id={formId} noValidate onSubmit={handleSubmit((values) => exportCsv.mutate(values))} className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => quick(monthStartIst(), todayIst())}>
              This month
            </Button>
            <Button size="sm" variant="outline" onClick={() => quick(lastMonthStart, lastMonthEnd)}>
              Last month
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" error={errors.from?.message}>
              <Input type="date" className="tnum" {...register('from')} />
            </Field>
            <Field label="To" error={errors.to?.message}>
              <Input type="date" className="tnum" {...register('to')} />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
