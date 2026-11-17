import { Link } from 'react-router';
import { PackageCheck, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { PincodeCheck } from '@/components/commerce';
import { useSettings } from '@/hooks/useSettings';
import { formatINR, pluralize } from '@/lib/format';
import type { ProductDetail } from '@/types/api';

/** When it arrives and on what terms: PIN code check, dispatch, cash on delivery, returns and warranty. */
export function DeliveryBlock({ product }: { product: ProductDetail }) {
  const settings = useSettings().data;
  const dispatchDays = settings?.shipping.dispatchDays ?? 0;
  const cod = settings?.cod;
  const returns = settings?.returns;

  const rows: { icon: typeof Truck; title: string; text: string; link?: { to: string; label: string } }[] = [];

  if (settings) {
    rows.push({
      icon: PackageCheck,
      title: dispatchDays > 0 ? `Leaves us in ${pluralize(dispatchDays, 'working day')}` : 'Dispatched once it is packed',
      text:
        settings.shipping.freeShippingThreshold > 0
          ? `Free delivery on orders of ${formatINR(settings.shipping.freeShippingThreshold)} or more.`
          : 'Delivery charge is shown in the cart before you pay.',
      link: { to: '/policies/shipping', label: 'Shipping' },
    });
    if (cod?.enabled && product.codEligible) {
      rows.push({
        icon: Truck,
        title: 'Cash on delivery available',
        text: [
          cod.fee > 0 ? `COD fee ${formatINR(cod.fee)}, shown before you place the order.` : 'No COD fee.',
          cod.advancePercent > 0 ? `${cod.advancePercent}% is paid online up front.` : '',
        ]
          .filter(Boolean)
          .join(' '),
      });
    } else {
      rows.push({
        icon: Truck,
        title: 'Prepaid only',
        text: product.codEligible ? 'Cash on delivery is not offered at the moment.' : 'This part is not sent cash on delivery. Pay by UPI or card.',
      });
    }
  }

  rows.push({
    icon: RotateCcw,
    title: !product.returnable
      ? 'Not returnable'
      : returns && returns.windowDays > 0
        ? `${pluralize(returns.windowDays, 'day')} to return it`
        : 'Returnable',
    text: !product.returnable ? 'This part cannot be sent back for a change of mind. The returns policy covers anything that arrives damaged or wrong.' : returns?.summary || '',
    link: { to: '/policies/returns', label: 'Returns' },
  });

  rows.push({
    icon: ShieldCheck,
    title: product.warrantyMonths > 0 ? `${pluralize(product.warrantyMonths, 'month')} warranty` : 'No warranty on this part',
    text: product.warrantyMonths > 0 ? 'Against manufacturing faults. Keep your invoice.' : '',
    link: product.warrantyMonths > 0 ? { to: '/policies/warranty', label: 'Warranty' } : undefined,
  });

  return (
    <section aria-labelledby="delivery-title" className="grid gap-4">
      <h2 id="delivery-title" className="type-h3">
        Delivery and returns
      </h2>
      <PincodeCheck codEligible={product.codEligible} label="Check delivery to your PIN code" />
      <ul className="divide-y divide-line border-y border-line">
        {rows.map(({ icon: Icon, title, text, link }) => (
          <li key={title} className="flex items-start gap-3 py-3">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="font-bold">{title}</p>
              {text && <p className="type-small text-muted">{text}</p>}
            </div>
            {link && (
              <Link to={link.to} className="link type-small shrink-0 font-bold">
                {link.label}
                <span className="sr-only"> policy</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
