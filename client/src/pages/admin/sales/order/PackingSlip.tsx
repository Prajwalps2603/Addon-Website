import { useEffect } from 'react';
import { CustomSummary } from '@/components/commerce';
import { Logo } from '@/components/brand';
import { Portal } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { PAYMENT_METHOD_LABELS } from '@/lib/labels';
import type { Order } from '@/types/api';

/** While the slip is printing, everything else on the page is left off the paper. */
const PRINT_ONLY_SLIP = `@media print { body > *:not([data-packing-slip]) { display: none !important; } }`;

export interface PackingSlipProps {
  order: Order;
  storeName: string;
  /** Called once the print dialog closes. */
  onDone: () => void;
}

/**
 * A plain packing slip for the box: who it goes to and what is inside. No prices, so it can
 * travel with a gift. Mounted only while printing.
 */
export function PackingSlip({ order, storeName, onDone }: PackingSlipProps) {
  useEffect(() => {
    const finish = () => onDone();
    window.addEventListener('afterprint', finish);
    // Let the slip reach the page before the dialog opens.
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [onDone]);

  const address = order.shippingAddress;
  const units = order.items.reduce((sum, item) => sum + item.qty, 0);
  const cod = order.paymentMethod === 'cod' && order.amountDue > 0;

  return (
    <Portal>
      <style>{PRINT_ONLY_SLIP}</style>
      <div data-packing-slip className="hidden bg-page text-ink print:block">
        <header className="flex items-start justify-between gap-6 border-b border-ink pb-4">
          <div className="grid gap-1">
            <Logo height={36} tagline={false} label={storeName} />
            <p className="type-small">Packing slip</p>
          </div>
          <div className="grid justify-items-end gap-1 text-right">
            <p className="type-code">{order.orderNumber}</p>
            <p className="type-small tnum">Ordered {formatDate(order.createdAt)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 border-b border-line py-4">
          <div>
            <h2 className="type-label">Deliver to</h2>
            <p className="type-h3 mt-1">{address.name}</p>
            <p className="mt-1 leading-snug">
              {address.line1}
              {address.line2 && (
                <>
                  <br />
                  {address.line2}
                </>
              )}
              {address.landmark && (
                <>
                  <br />
                  Near {address.landmark}
                </>
              )}
              <br />
              {address.city}, {address.state} <span className="tnum">{address.pincode}</span>
            </p>
            <p className="mt-1 tnum">Phone {formatPhone(address.phone)}</p>
          </div>
          <div>
            <h2 className="type-label">Payment</h2>
            <p className="mt-1">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
            {cod && <p className="type-h3 mt-1">Collect cash on delivery</p>}
            {order.vehicle && (
              <>
                <h2 className="type-label mt-3">For the car</h2>
                <p className="mt-1">{order.vehicle}</p>
              </>
            )}
          </div>
        </section>

        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="type-label w-10 border-b border-ink py-2">Done</th>
              <th className="type-label border-b border-ink py-2">Item</th>
              <th className="type-label border-b border-ink py-2">SKU</th>
              <th className="type-label border-b border-ink py-2 text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-line align-top">
                <td className="py-2">
                  <span aria-hidden className="inline-block size-4 border border-ink" />
                </td>
                <td className="py-2 pr-3">
                  <span className="font-bold">{item.name}</span>
                  {item.variantName && <span> ({item.variantName})</span>}
                  {item.custom && <CustomSummary custom={item.custom} heading={false} className="mt-1" />}
                </td>
                <td className="type-code py-2 pr-3">{item.sku}</td>
                <td className="type-h3 py-2 text-right tnum">{formatNumber(item.qty)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td colSpan={2} className="py-2 font-bold">
                Units in the box
              </td>
              <td className="type-h3 py-2 text-right tnum">{formatNumber(units)}</td>
            </tr>
          </tfoot>
        </table>

        {order.notes && (
          <section className="mt-4 border-t border-line pt-3">
            <h2 className="type-label">Customer note</h2>
            <p className="mt-1">{order.notes}</p>
          </section>
        )}
      </div>
    </Portal>
  );
}
