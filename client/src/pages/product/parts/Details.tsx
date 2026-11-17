import { Check } from 'lucide-react';
import { JargonText } from '@/components/commerce';
import type { ProductDetail } from '@/types/api';

/**
 * What it is: the description, highlights, specs (technical words tappable), what is in the box,
 * and the product information the law asks for.
 */
export function Details({ product }: { product: ProductDetail }) {
  const paragraphs = product.description
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean);

  const info: { label: string; value: string; code?: boolean }[] = [
    { label: 'Net quantity', value: product.netQuantity },
    { label: 'Country of origin', value: product.countryOfOrigin },
    { label: 'Manufacturer or importer', value: product.manufacturer },
    { label: 'SKU', value: product.sku, code: true },
    { label: 'HSN code', value: product.hsnCode, code: true },
  ].filter((row) => row.value.trim() !== '');

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
      <div className="grid content-start gap-8">
        <section aria-labelledby="about-title" className="grid gap-4">
          <h2 id="about-title" className="type-h2">
            About this part
          </h2>
          {paragraphs.length > 0 ? (
            <div className="grid max-w-prose gap-3 type-body">
              {paragraphs.map((text, i) => (
                <p key={i} className="whitespace-pre-line">
                  {text}
                </p>
              ))}
            </div>
          ) : (
            product.shortDescription && <p className="max-w-prose type-body">{product.shortDescription}</p>
          )}
          {product.highlights.length > 0 && (
            <ul className="grid max-w-prose gap-2">
              {product.highlights.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-fit" />
                  <span>
                    <JargonText text={line} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {product.boxContents.length > 0 && (
          <section aria-labelledby="box-title" className="grid gap-3">
            <h3 id="box-title" className="type-h3">
              In the box
            </h3>
            <ul className="grid max-w-prose gap-1.5 type-body">
              {product.boxContents.map((item) => (
                <li key={item} className="flex gap-2.5 before:mt-2.5 before:size-1.5 before:shrink-0 before:bg-ink before:content-['']">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="grid content-start gap-8">
        {product.specs.length > 0 && (
          <section aria-labelledby="specs-title" className="grid gap-3">
            <h2 id="specs-title" className="type-h2">
              Specs
            </h2>
            <dl className="border-t border-ink">
              {product.specs.map((row) => (
                <div key={`${row.label}-${row.value}`} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-b border-line py-2.5">
                  <dt className="type-small font-bold text-muted">
                    <JargonText text={row.label} />
                  </dt>
                  <dd className="tnum">
                    <JargonText text={row.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {info.length > 0 && (
          <section aria-labelledby="info-title" className="grid gap-3">
            <h3 id="info-title" className="type-h3">
              Product information
            </h3>
            <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 type-small">
              {info.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className={row.code ? 'type-code break-all' : 'font-medium'}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
