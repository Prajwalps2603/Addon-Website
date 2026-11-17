import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Circle, CircleCheck } from 'lucide-react';
import { TreadDivider } from '@/components/brand';
import { Button, Modal, Skeleton, toast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { readJSON, writeJSON } from '@/lib/storage';
import type { AdminSettings } from '@/types/api';

const MANUAL_KEY = 'addon-admin-setup-v1';

interface ManualTicks {
  policies?: boolean;
  products?: boolean;
}

interface Item {
  key: string;
  title: string;
  /** What is missing or what to do. */
  hint: string;
  done: boolean;
  to: string;
  action: string;
  /** Ticked by hand: the store cannot tell on its own. */
  manual?: keyof ManualTicks;
}

function filled(...values: (string | null | undefined)[]): boolean {
  return values.every((value) => typeof value === 'string' && value.trim() !== '');
}

function buildItems(s: AdminSettings, manual: ManualTicks): Item[] {
  return [
    {
      key: 'contact',
      title: 'Store phone and WhatsApp',
      hint: 'Shoppers see these on every page. WhatsApp buttons stay hidden until the number is set.',
      done: filled(s.phone, s.whatsapp),
      to: '/admin/settings#store',
      action: 'Add numbers',
    },
    {
      key: 'business',
      title: 'Address and GSTIN',
      hint: 'Printed on every invoice and the contact page.',
      done: filled(s.address.line1, s.address.city, s.address.pincode, s.gstin),
      to: '/admin/settings#store',
      action: 'Add address',
    },
    {
      key: 'studio',
      title: 'Studio address and map link',
      hint: 'Customers booked into a slot are told where to bring the car. It goes in their booking email and WhatsApp message.',
      done: !s.studio.enabled || filled(s.studio.address),
      to: '/admin/settings#studio',
      action: 'Add the studio',
    },
    {
      key: 'grievance',
      title: 'Grievance officer',
      hint: 'A name with an email or phone. Indian e-commerce rules require it.',
      done: filled(s.grievanceOfficer.name) && (filled(s.grievanceOfficer.email) || filled(s.grievanceOfficer.phone)),
      to: '/admin/settings#grievance',
      action: 'Add officer',
    },
    {
      key: 'origin',
      title: 'Origin PIN code',
      hint: 'Where parcels leave from. Delivery dates are worked out from it.',
      done: /^[1-9]\d{5}$/.test(s.shipping.originPincode ?? ''),
      to: '/admin/settings#delivery',
      action: 'Set PIN code',
    },
    {
      key: 'payments',
      title: 'UPI ID or Razorpay keys',
      hint: 'Without one of these, cash on delivery is the only way to pay.',
      done: (s.payments.upi && filled(s.payments.upiId)) || s.notifications.razorpayConfigured,
      to: '/admin/settings#payments',
      action: 'Set up payments',
    },
    {
      key: 'smtp',
      title: 'Email sending (SMTP)',
      hint: 'Order and password emails are only logged until SMTP_HOST, SMTP_USER and SMTP_PASS are set on the server.',
      done: s.notifications.smtpConfigured,
      to: '/admin/settings#invoices',
      action: 'See email settings',
    },
    {
      key: 'policies',
      title: 'Review the policies and the Fit Promise',
      hint: 'Read the returns, shipping and warranty wording and the Fit Promise summary. Mark it done once they say what you will honour.',
      done: Boolean(manual.policies),
      to: '/admin/settings#promises',
      action: 'Review',
      manual: 'policies',
    },
    {
      key: 'products',
      title: 'Replace the sample products and photos',
      hint: 'The catalogue started with sample parts and open-licence photos. Add your own stock, prices and pictures.',
      done: Boolean(manual.products),
      to: '/admin/products',
      action: 'Open products',
      manual: 'products',
    },
  ];
}

/**
 * Shown at the top of the dashboard while the store still holds seeded sample data.
 * Every tick is read from the real settings, except two the store cannot judge for itself.
 */
export function SetupChecklist() {
  const queryClient = useQueryClient();
  const [manual, setManual] = useState<ManualTicks>(() => readJSON<ManualTicks>(MANUAL_KEY, {}));
  const [confirming, setConfirming] = useState(false);

  const settings = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: ({ signal }) => api.admin.settings.get({ signal }),
  });

  const clear = useMutation({
    mutationFn: () => api.admin.demo.clear(),
    onSuccess: (result) => {
      const total = Object.values(result.removed).reduce((sum, n) => sum + n, 0);
      setConfirming(false);
      toast.success('Sample data cleared', { description: `${formatNumber(total)} sample records removed.` });
      // Products, reports, builds, settings and every count change: refresh everything.
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error('Could not clear the sample data', { description: errorMessage(error) }),
  });

  const tick = (key: keyof ManualTicks, value: boolean) => {
    const next = { ...manual, [key]: value };
    setManual(next);
    writeJSON(MANUAL_KEY, next);
  };

  let body: ReactNode;
  let progress: { done: number; total: number } | null = null;

  if (settings.isPending) {
    body = (
      <div className="grid gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  } else if (settings.error) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-line p-4">
        <p className="text-muted">Could not read the settings to check them. {settings.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => settings.refetch()}>
          Try again
        </Button>
      </div>
    );
  } else {
    const items = buildItems(settings.data, manual);
    progress = { done: items.filter((item) => item.done).length, total: items.length + 1 };
    body = (
      <ol className="grid gap-3 md:grid-cols-2">
        {items.map((item, index) => (
          <li
            key={item.key}
            className={cn('flex gap-3 rounded-[18px] p-4 transition-colors', item.done ? 'bg-fit/8' : 'bg-surface')}
          >
            {item.done ? (
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-fit text-white">
                <CircleCheck className="size-4" />
              </span>
            ) : (
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-sm font-black tnum">
                {index + 1}
              </span>
            )}
            <div className="grid min-w-0 flex-1 content-start gap-1">
              <p className={cn('pt-1 font-bold leading-snug', item.done && 'text-muted line-through decoration-1')}>
                {item.title}
                <span className="sr-only">{item.done ? ': done' : ': to do'}</span>
              </p>
              {!item.done && <p className="text-sm text-muted">{item.hint}</p>}
              {(!item.done || item.manual) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!item.done && (
                    <Button variant="dark" size="sm" to={item.to} iconRight={<ArrowRight aria-hidden />} className="rounded-full">
                      {item.action}
                    </Button>
                  )}
                  {item.manual && (
                    <button
                      type="button"
                      onClick={() => tick(item.manual as keyof ManualTicks, !item.done)}
                      className="focus-ring h-8 rounded-full bg-raised px-3.5 text-xs font-bold transition-colors hover:bg-fit hover:text-white"
                    >
                      {item.done ? 'Mark as not done' : 'Mark done'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
        <li className="flex gap-3 rounded-[18px] bg-stop-soft/60 p-4 md:col-span-2">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-stop">
            <Circle className="size-4" />
          </span>
          <div className="grid min-w-0 flex-1 gap-1">
            <p className="pt-1 font-bold">
              Clear the sample data<span className="sr-only">: to do</span>
            </p>
            <p className="max-w-prose text-sm text-muted">
              Removes the seeded sample products, fitted reports, questions and builds marked Sample. Do this last, once your own
              products are in. It cannot be undone.
            </p>
            <div className="mt-2">
              <Button variant="danger" size="sm" onClick={() => setConfirming(true)} className="rounded-full">
                Clear sample data
              </Button>
            </div>
          </div>
        </li>
      </ol>
    );
  }

  return (
    <section aria-labelledby="setup-heading" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="setup-heading" className="type-h2">
          Before you open
        </h2>
        {progress && (
          <p className="tnum font-bold">
            {progress.done} of {progress.total} done
          </p>
        )}
      </div>
      {progress && (
        <TreadDivider progress={progress.done / progress.total} label={`Setup: ${progress.done} of ${progress.total} done`} />
      )}
      {body}

      <Modal
        open={confirming}
        onClose={() => (clear.isPending ? undefined : setConfirming(false))}
        title="Clear all sample data?"
        description="Every seeded sample product, report, question and build is deleted for good. Your own products, orders and settings stay."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={clear.isPending}>
              Keep it for now
            </Button>
            <Button variant="danger" loading={clear.isPending} onClick={() => clear.mutate()}>
              Clear sample data
            </Button>
          </>
        }
      />
    </section>
  );
}
