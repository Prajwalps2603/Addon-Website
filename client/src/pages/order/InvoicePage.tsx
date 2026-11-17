import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Logo } from '@/components/brand';
import { ErrorState } from '@/components/commerce';
import { Badge, Button, Skeleton, SkeletonText } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';
import { STATES, formatPhone } from '@/lib/india';
import { isShowPlate, SHOW_PLATE_NOTE } from '@/components/cart/lineNotes';
import { ORDER_STATUS_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { Order, PublicSettings } from '@/types/api';
import { invoiceLines, rupeesInWords, taxByRate } from './invoice/invoiceMath';
import { isHiddenOrderError, orderPath, useOrderWithAccess } from './parts/orderAccess';
import { atStudio, fulfilmentTitle, methodLabel, slotWords } from './parts/fulfilment';
import { describePayment } from './parts/paymentWords';

const paise = (value: number) => formatINR(value, { paise: true });

function stateCode(name: string): string {
  const wanted = name.trim().toLowerCase();
  return STATES.find((state) => state.name.toLowerCase() === wanted)?.code ?? '';
}

/**
 * The footer note lives in the admin settings (invoice.footerNote). The public settings do not carry it
 * yet, so it is read from there when present, or from the admin settings when an admin is looking.
 */
function useFooterNote(settings: PublicSettings | undefined): string {
  const { isAdmin } = useMe();
  const publicNote = (settings as (PublicSettings & { invoice?: { footerNote?: string } }) | undefined)?.invoice?.footerNote ?? '';
  const admin = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: ({ signal }) => api.admin.settings.get({ signal }),
    enabled: isAdmin && !publicNote,
    staleTime: 5 * 60_000,
  });
  return (publicNote || admin.data?.invoice.footerNote || '').trim();
}

/** /order/:orderNumber/invoice: a GST tax invoice laid out for A4, with no site chrome. */
export default function InvoicePage() {
  const { orderNumber = '' } = useParams();
  const { query, token } = useOrderWithAccess(orderNumber);
  const settingsQuery = useSettings();
  const settings = settingsQuery.data;
  const footerNote = useFooterNote(settings);
  const { data: order, error, isPending, refetch } = query;

  useDocumentMeta({ title: order ? `Invoice ${order.invoiceNumber || order.orderNumber}` : 'Invoice', noindex: true });

  let body: ReactNode;
  if (isPending || (settingsQuery.isPending && !settingsQuery.error)) {
    body = <InvoiceSkeleton />;
  } else if (error) {
    body = isHiddenOrderError(error) ? (
      <div role="alert" className="grid gap-3 py-10">
        <h1 className="type-title">We cannot show this invoice</h1>
        <p className="type-body max-w-prose text-muted">
          Open it from your order page, or sign in to the account that placed the order.
        </p>
        <div>
          <Button variant="dark" to={`/track?orderNumber=${encodeURIComponent(orderNumber)}`}>
            Find the order with your phone
          </Button>
        </div>
      </div>
    ) : (
      <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the invoice" />
    );
  } else {
    body = <Invoice order={order} settings={settings} footerNote={footerNote} />;
  }

  return (
    <div className="min-h-dvh bg-surface print:bg-page">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3 print:hidden">
        <Button variant="link" to={orderPath(orderNumber, token)} iconLeft={<ArrowLeft aria-hidden />}>
          Back to the order
        </Button>
        {order && (
          <Button onClick={() => window.print()} iconLeft={<Printer aria-hidden />}>
            Print or save as PDF
          </Button>
        )}
      </div>
      <main id="main" className="pb-10 sm:px-4 print:p-0">
        <article className="plane-frame relative isolate mx-auto w-full max-w-[60rem] overflow-hidden rounded-[20px] p-4 sm:p-10 print:max-w-none print:overflow-visible print:rounded-none print:p-0">
          {order && (
            <img
              src="/brand/addon-logo.svg"
              alt=""
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[min(85%,48rem)] -translate-x-1/2 -translate-y-1/2 -rotate-[20deg] opacity-[0.07] select-none [print-color-adjust:exact] print:fixed"
            />
          )}
          {body}
        </article>
      </main>
    </div>
  );
}

function InvoiceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the invoice" className="grid gap-8">
      <div className="flex flex-wrap justify-between gap-6">
        <div className="grid gap-3">
          <Skeleton className="h-8 w-32" />
          <SkeletonText lines={4} className="w-56" />
        </div>
        <div className="grid gap-3">
          <Skeleton className="h-8 w-40" />
          <SkeletonText lines={4} className="w-48" />
        </div>
      </div>
      <Skeleton className="h-40 w-full" />
      <SkeletonText lines={5} className="ml-auto w-64" />
    </div>
  );
}

// ---------------------------------------------------------------------------

interface InvoiceProps {
  order: Order;
  settings: PublicSettings | undefined;
  footerNote: string;
}

function Lines({ lines }: { lines: (string | false | null | undefined)[] }) {
  const shown = lines.filter((line): line is string => typeof line === 'string' && line.trim() !== '');
  return (
    <>
      {shown.map((line, index) => (
        <span key={index} className="block">
          {line}
        </span>
      ))}
    </>
  );
}

function Invoice({ order, settings, footerNote }: InvoiceProps) {
  const gstin = settings?.gstin.trim() ?? '';
  const title = gstin ? 'Tax invoice' : 'Invoice';
  const seller = settings?.legalName.trim() || settings?.storeName.trim() || 'Addon Automotive';
  const sa = settings?.address;
  const ship = order.shippingAddress;
  const hasAddress = ship.line1.trim() !== '';
  // Collected or fitted at the studio: supplied where the studio is (the server taxes it intra-State).
  const supplyState = ship.state.trim() || (atStudio(order) ? (sa?.state.trim() ?? '') : '');
  const supplyCode = stateCode(supplyState);
  const interState = order.tax.isInterState;
  const lines = invoiceLines(order);
  const hasDiscount = lines.some((line) => line.discount > 0);
  const rates = taxByRate(lines, interState);
  const payment = describePayment(order);
  const closed = order.status === 'cancelled' || order.status === 'returned';
  const cityLine = (city?: string, state?: string, pincode?: string) =>
    [[city, state].filter((part) => part && part.trim()).join(', '), pincode].filter((part) => part && part.trim()).join(' ');

  return (
    <div className="grid gap-8 text-ink print:gap-6">
      {/* Seller and invoice details */}
      <header className="grid gap-6 border-b border-ink pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-10">
        <div className="grid content-start gap-3">
          <Logo height={32} tagline={false} label={settings?.storeName || 'Addon Automotive'} />
          <p className="type-small">
            <span className="block font-bold">{seller}</span>
            <Lines lines={[sa?.line1, sa?.line2, cityLine(sa?.city, sa?.state, sa?.pincode)]} />
            {gstin && (
              <span className="block">
                GSTIN <span className="type-code">{gstin}</span>
              </span>
            )}
            <Lines lines={[settings?.phone && `Phone ${settings.phone}`, settings?.email && `Email ${settings.email}`]} />
          </p>
        </div>
        <div className="grid content-start gap-3 sm:justify-items-end sm:text-right">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <h1 className="type-title">{title}</h1>
            {closed && (
              <Badge tone="neutral" variant="outline">
                Order {ORDER_STATUS_LABELS[order.status].toLowerCase()}
              </Badge>
            )}
          </div>
          <dl className="type-small grid grid-cols-[auto_auto] gap-x-4 gap-y-1 sm:justify-end">
            <Meta label="Invoice number" value={<span className="type-code">{order.invoiceNumber || 'Not issued'}</span>} />
            <Meta label="Invoice date" value={<span className="tnum">{formatDate(order.createdAt)}</span>} />
            <Meta label="Order number" value={<span className="type-code">{order.orderNumber}</span>} />
            {supplyState && <Meta label="Place of supply" value={supplyCode ? `${supplyState} (${supplyCode})` : supplyState} />}
            {gstin && <Meta label="Reverse charge" value="No" />}
          </dl>
        </div>
      </header>

      {/* Buyer */}
      <section aria-labelledby="invoice-buyer" className="grid gap-6 sm:grid-cols-2">
        <div className="grid content-start gap-1">
          <h2 id="invoice-buyer" className="type-label text-muted">
            Billed to
          </h2>
          <p className="type-small">
            <span className="block font-bold">{order.customerName || ship.name}</span>
            {hasAddress && <Lines lines={[ship.line1, ship.line2, ship.landmark && `Near ${ship.landmark}`, cityLine(ship.city, ship.state, ship.pincode)]} />}
            <Lines lines={[order.phone && `Phone ${formatPhone(order.phone)}`, order.email && `Email ${order.email}`]} />
            {order.gstin && (
              <span className="block">
                GSTIN <span className="type-code">{order.gstin}</span>
              </span>
            )}
          </p>
        </div>
        {atStudio(order) ? (
          <div className="grid content-start gap-1">
            <h2 className="type-label text-muted">{fulfilmentTitle(order)}</h2>
            <p className="type-small">
              <Lines
                lines={[
                  order.fulfilment === 'studio' && order.studioSlot && `Slot ${slotWords(order.studioSlot)}`,
                  order.bookingNumber && `Booking ${order.bookingNumber}`,
                  order.fulfilment === 'studio' && order.vehicle && `Car ${order.vehicle}`,
                ]}
              />
              {settings?.studio.address.trim() && <span className="block whitespace-pre-line">{settings.studio.address.trim()}</span>}
              {supplyCode && <span className="block">State code {supplyCode}</span>}
            </p>
          </div>
        ) : (
          <div className="grid content-start gap-1">
            <h2 className="type-label text-muted">Shipped to</h2>
            <p className="type-small">
              <span className="block font-bold">{ship.name}</span>
              <Lines lines={[ship.line1, ship.line2, ship.landmark && `Near ${ship.landmark}`, cityLine(ship.city, ship.state, ship.pincode)]} />
              <Lines lines={[ship.phone && `Phone ${formatPhone(ship.phone)}`, supplyCode && `State code ${supplyCode}`]} />
            </p>
          </div>
        )}
      </section>

      {/* Items */}
      <section aria-label="Items" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0 print:overflow-visible">
        <table className="type-small w-full min-w-[36rem] border-collapse md:min-w-0 print:min-w-0">
          <caption className="sr-only">Items, fees and the GST on each</caption>
          <thead>
            <tr className="border-y border-ink text-left">
              <Th>#</Th>
              <Th className="w-full min-w-44">Item</Th>
              <Th>HSN</Th>
              <Th numeric>Qty</Th>
              <Th numeric>Unit price</Th>
              {hasDiscount && <Th numeric>Discount</Th>}
              <Th numeric>Taxable</Th>
              <Th numeric>GST</Th>
              <Th numeric>Total</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.key} className="border-b border-line align-top">
                <Td className="tnum">{index + 1}</Td>
                <Td>
                  <span className="block font-bold">{line.description}</span>
                  {line.detail && <span className="block">{line.detail}</span>}
                  {line.kind === 'item' && isShowPlate(line.custom) && <span className="block text-muted">{SHOW_PLATE_NOTE}</span>}
                  {line.sku && <span className="type-code block text-muted">{line.sku}</span>}
                </Td>
                <Td className="tnum">{line.hsn || ''}</Td>
                <Td numeric>{line.qty}</Td>
                <Td numeric>{paise(line.unitPrice)}</Td>
                {hasDiscount && <Td numeric>{line.discount > 0 ? `-${paise(line.discount)}` : ''}</Td>}
                <Td numeric>{paise(line.taxable)}</Td>
                <Td numeric>
                  <span className="block">{paise(line.gst)}</span>
                  <span className="block text-muted">{line.gstRate}%</span>
                </Td>
                <Td numeric className="font-bold">
                  {paise(line.amount)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="type-small mt-2 text-muted">
          Unit prices include GST. Discounts are shared across the items in proportion to their value.
          {order.fittingTotal > 0 && ' Studio fitting is a service at 18% GST and is not discounted.'}
        </p>
      </section>

      {/* GST by rate and the totals */}
      <section aria-label="Totals" className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:gap-10 print:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid content-start gap-4">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0 print:overflow-visible">
            <table className="type-small w-full min-w-[22rem] border-collapse md:min-w-0 print:min-w-0">
              <caption className="type-label mb-1 text-left text-muted">GST by rate</caption>
              <thead>
                <tr className="border-y border-ink text-left">
                  <Th>Rate</Th>
                  <Th numeric>Taxable value</Th>
                  {interState ? (
                    <Th numeric>IGST</Th>
                  ) : (
                    <>
                      <Th numeric>CGST</Th>
                      <Th numeric>SGST</Th>
                    </>
                  )}
                  <Th numeric>Total GST</Th>
                </tr>
              </thead>
              <tbody>
                {rates.map((row) => (
                  <tr key={row.gstRate} className="border-b border-line">
                    <Td className="tnum">{row.gstRate}%</Td>
                    <Td numeric>{paise(row.taxable)}</Td>
                    {interState ? (
                      <Td numeric>{paise(row.igst)}</Td>
                    ) : (
                      <>
                        <Td numeric>
                          <span className="block">{paise(row.cgst)}</span>
                          <span className="block text-muted">{row.gstRate / 2}%</span>
                        </Td>
                        <Td numeric>
                          <span className="block">{paise(row.sgst)}</span>
                          <span className="block text-muted">{row.gstRate / 2}%</span>
                        </Td>
                      </>
                    )}
                    <Td numeric>{paise(row.gst)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-1">
            <p className="type-label text-muted">Amount in words</p>
            <p className="type-body font-bold">{rupeesInWords(order.total)}</p>
          </div>
          <div className="grid gap-1">
            <p className="type-label text-muted">Payment</p>
            <p className="type-small">
              {methodLabel(order)}
              {payment.short !== methodLabel(order) && ` · ${payment.short}`}
            </p>
            <p className="type-small">{payment.detail}</p>
            {order.upiReference && (
              <p className="type-small">
                UPI reference <span className="type-code">{order.upiReference}</span>
              </p>
            )}
          </div>
        </div>

        <dl className="grid content-start gap-1.5">
          <Total label="Items" value={paise(order.subtotal)} />
          {order.discount > 0 && <Total label={order.couponCode ? `Coupon ${order.couponCode}` : 'Discount'} value={`-${paise(order.discount)}`} />}
          {order.prepaidDiscount > 0 && <Total label="Paying online discount" value={`-${paise(order.prepaidDiscount)}`} />}
          {order.fittingTotal > 0 && <Total label="Studio fitting" value={paise(order.fittingTotal)} />}
          {order.shippingFee > 0 && <Total label="Delivery charge" value={paise(order.shippingFee)} />}
          {order.codFee > 0 && <Total label="Cash on delivery fee" value={paise(order.codFee)} />}
          <Total label="Taxable value" value={paise(order.tax.taxableValue)} className="mt-1 border-t border-line pt-2" />
          {interState ? (
            <Total label="IGST" value={paise(order.tax.igst)} />
          ) : (
            <>
              <Total label="CGST" value={paise(order.tax.cgst)} />
              <Total label="SGST" value={paise(order.tax.sgst)} />
            </>
          )}
          <Total label="Total" value={paise(order.total)} strong className="mt-1 border-t border-ink pt-2" />
          {order.amountPaid > 0 && <Total label="Paid" value={paise(order.amountPaid)} />}
          {order.amountDue > 0 && !closed && (
            <Total label={order.paymentMethod === 'cod' ? (atStudio(order) ? 'Due at the studio' : 'Due on delivery') : 'Balance due'} value={paise(order.amountDue)} />
          )}
        </dl>
      </section>

      <footer className="grid gap-2 border-t border-ink pt-4">
        {footerNote && <p className="type-small max-w-prose whitespace-pre-line">{footerNote}</p>}
        <p className="type-small text-muted">This is a computer-generated invoice.</p>
        <p className="type-small text-muted tnum">
          {seller}
          {settings?.phone && ` · ${settings.phone}`}
          {settings?.email && ` · ${settings.email}`}
          {` · Printed ${formatDateTime(new Date())}`}
        </p>
      </footer>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-muted sm:text-right">{label}</dt>
      <dd className="font-medium sm:text-right">{value}</dd>
    </>
  );
}

function Th({ children, numeric = false, className }: { children?: ReactNode; numeric?: boolean; className?: string }) {
  return <th scope="col" className={cn('type-label px-2 py-2 first:pl-0 last:pr-0 whitespace-nowrap', numeric && 'text-right', className)}>{children}</th>;
}

function Td({ children, numeric = false, className }: { children?: ReactNode; numeric?: boolean; className?: string }) {
  return <td className={cn('px-2 py-2 first:pl-0 last:pr-0', numeric && 'text-right whitespace-nowrap tnum', className)}>{children}</td>;
}

function Total({ label, value, strong = false, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <dt className={strong ? 'type-body font-bold' : 'type-small'}>{label}</dt>
      <dd className={cn('tnum text-right', strong ? 'type-price-xl' : 'type-small')}>{value}</dd>
    </div>
  );
}
