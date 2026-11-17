import { useId, useState } from 'react';
import { ChevronDown, CircleX, PencilLine } from 'lucide-react';
import { Link } from 'react-router';
import { WhatsAppIcon } from '@/components/brand';
import { Badge, Button, CopyButton, Table, Textarea, type TableColumn } from '@/components/ui';
import { formatNumber, pluralize } from '@/lib/format';
import { waShareLink } from '@/lib/whatsapp';
import type { DemandReport } from '@/types/api';

type Supplier = DemandReport['reorder'][number];
type Line = Supplier['items'][number];

const COLUMNS: TableColumn<Line>[] = [
  {
    key: 'name',
    header: 'Product',
    primary: true,
    cell: (row) => (
      <Link to={`/admin/products/${row.productId}`} className="font-bold underline-offset-4 hover:underline focus-ring">
        {row.name}
      </Link>
    ),
  },
  { key: 'sku', header: 'SKU', cell: (row) => <span className="rounded-full bg-surface px-2.5 py-0.5 font-mono text-xs font-bold text-muted whitespace-nowrap">{row.sku}</span> },
  {
    key: 'stock',
    header: 'In stock',
    numeric: true,
    cell: (row) =>
      row.stock <= 0 ? (
        <Badge tone="stop" variant="soft" icon={<CircleX aria-hidden />}>
          Sold out
        </Badge>
      ) : (
        <span className="font-bold text-warn">{formatNumber(row.stock)}</span>
      ),
  },
  { key: 'qty', header: 'Order', numeric: true, cell: (row) => <span className="inline-grid h-8 min-w-10 place-items-center rounded-full bg-ink px-3 font-extrabold text-page tnum">{formatNumber(row.suggestedQty)}</span> },
];

/**
 * One supplier's reorder: what is low, how many to order, and the purchase order ready to send.
 * The supplier's number is not stored, so WhatsApp opens with the message and the owner picks the contact.
 */
export function PurchaseOrder({ supplier }: { supplier: Supplier }) {
  const [message, setMessage] = useState(supplier.message);
  const [editing, setEditing] = useState(false);
  const fieldId = useId();
  const name = supplier.supplier.trim() || 'No supplier set';
  const units = supplier.items.reduce((sum, item) => sum + item.suggestedQty, 0);

  return (
    <section aria-label={`Reorder from ${name}`} className="grid gap-4 rounded-[20px] bg-raised p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-lg font-bold">{name}</h3>
        <p className="type-small tnum text-muted">
          {pluralize(supplier.items.length, 'product')}, {formatNumber(units)} units suggested
        </p>
      </div>

      <Table caption={`Products to reorder from ${name}`} columns={COLUMNS} rows={supplier.items} rowKey={(row) => row.productId} dense />

      {message && (
        <div className="grid gap-3">
          {editing ? (
            <div className="grid gap-1.5">
              <label htmlFor={fieldId} className="type-label text-muted">
                Purchase order message
              </label>
              <Textarea id={fieldId} rows={8} value={message} onChange={(event) => setMessage(event.target.value)} />
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Close editor
                </Button>
                {message !== supplier.message && (
                  <Button variant="ghost" size="sm" onClick={() => setMessage(supplier.message)}>
                    Undo my changes
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="focus-ring group grid gap-2 rounded-[18px] rounded-tl-[6px] bg-fit/10 p-4 text-left transition-colors hover:bg-fit/15"
            >
              <span className="line-clamp-3 whitespace-pre-line">{message}</span>
              <span className="type-small inline-flex items-center gap-1 font-bold text-muted group-hover:text-ink">
                <PencilLine aria-hidden className="size-4" />
                Read in full or edit
                <ChevronDown aria-hidden className="size-4" />
              </span>
            </button>
          )}
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button
              href={waShareLink(message)}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              iconLeft={<WhatsAppIcon aria-hidden />}
              className="rounded-full !bg-[#1fa855] !text-white hover:!bg-[#178a45] max-sm:w-full"
            >
              Send purchase order on WhatsApp
            </Button>
            <CopyButton value={message} label="Copy purchase order" buttonVariant="ghost" />
          </div>
        </div>
      )}
    </section>
  );
}
