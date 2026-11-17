import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { iconForArtKind } from '@/components/commerce';
import { Button, EmptyState } from '@/components/ui';
import { capitalize, pluralize } from '@/lib/format';
import { imageVariant } from '@/lib/images';
import { useDocumentMeta } from '@/lib/seo';
import rawCredits from '@/data/photoCredits.json';
import { Facts, ReadingPage, type TocItem } from './parts/Reading';

interface Credit {
  url: string;
  thumb: string;
  subject: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  provider: string;
}

const PROVIDERS: Record<string, string> = {
  wikimedia: 'Wikimedia Commons',
  flickr: 'Flickr',
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  openverse: 'Openverse',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The JSON may be missing fields while photos are still being sourced: keep only rows with a photo. */
function readCredits(input: unknown): Credit[] {
  if (!Array.isArray(input)) return [];
  const out: Credit[] = [];
  for (const row of input as Record<string, unknown>[]) {
    if (!row || typeof row !== 'object') continue;
    const url = text(row.url);
    if (!url) continue;
    out.push({
      url,
      thumb: text(row.thumb),
      subject: text(row.subject) || 'other',
      title: text(row.title) || 'Untitled photograph',
      creator: text(row.creator),
      license: text(row.license),
      licenseUrl: text(row.licenseUrl),
      sourceUrl: text(row.sourceUrl),
      provider: text(row.provider),
    });
  }
  return out;
}

const CREDITS = readCredits(rawCredits);

function subjectLabel(subject: string): string {
  if (subject === 'editorial') return 'Banners and editorial';
  if (subject === 'other') return 'Other';
  return capitalize(subject.replace(/-/g, ' '));
}

function providerLabel(provider: string): string {
  return PROVIDERS[provider] ?? (provider ? capitalize(provider) : 'the source');
}

function external(href: string): boolean {
  return /^https?:\/\//.test(href);
}

function Thumb({ credit }: { credit: Credit }) {
  const [failed, setFailed] = useState(false);
  const src = credit.thumb || imageVariant(credit.url, 480);
  const Icon = iconForArtKind(credit.subject === 'editorial' ? null : credit.subject);
  return (
    <div className="plane-frame grid aspect-square w-18 shrink-0 place-items-center overflow-hidden sm:w-20">
      {failed || !src ? (
        <Icon aria-hidden strokeWidth={1.5} className="size-7 text-line-strong" />
      ) : (
        <img src={src} alt={credit.title} width={80} height={80} loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-full object-cover" />
      )}
    </div>
  );
}

function CreditRow({ credit }: { credit: Credit }) {
  return (
    <li className="flex gap-3 border-b border-line py-3 sm:gap-4">
      <Thumb credit={credit} />
      <div className="grid min-w-0 content-start gap-1">
        <p className="line-clamp-2 leading-snug font-bold break-words">{credit.title}</p>
        <p className="type-small text-muted">
          {credit.creator ? <>By {credit.creator}</> : 'Author not recorded'}
          {credit.license && (
            <>
              {' · '}
              {external(credit.licenseUrl) ? (
                <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="link text-ink">
                  {credit.license}
                  <span className="sr-only"> licence (opens in a new tab)</span>
                </a>
              ) : (
                <span className="text-ink">{credit.license}</span>
              )}
            </>
          )}
        </p>
        {external(credit.sourceUrl) && (
          <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="link type-small inline-flex items-center gap-1 self-start">
            Original on {providerLabel(credit.provider)}
            <ExternalLink aria-hidden className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
    </li>
  );
}

function countBy(credits: readonly Credit[], key: (credit: Credit) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const credit of credits) counts.set(key(credit), (counts.get(key(credit)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export default function CreditsPage() {
  useDocumentMeta({
    title: 'Photo credits',
    description: 'Every photograph on the site, with its author, licence and source.',
  });

  const groups = useMemo(() => {
    const bySubject = new Map<string, Credit[]>();
    for (const credit of CREDITS) {
      const list = bySubject.get(credit.subject) ?? [];
      list.push(credit);
      bySubject.set(credit.subject, list);
    }
    return [...bySubject.entries()]
      .map(([subject, items]) => ({ subject, label: subjectLabel(subject), items }))
      .sort((a, b) => {
        const last = (s: string) => (s === 'editorial' || s === 'other' ? 1 : 0);
        return last(a.subject) - last(b.subject) || a.label.localeCompare(b.label);
      });
  }, []);

  const licences = useMemo(() => countBy(CREDITS, (credit) => credit.license || 'Not recorded'), []);
  const sources = useMemo(() => countBy(CREDITS, (credit) => providerLabel(credit.provider)), []);

  const toc: TocItem[] = [
    { id: 'about-photos', label: 'About these photographs' },
    ...groups.map((group) => ({ id: `photos-${group.subject}`, label: group.label, count: group.items.length })),
  ];

  return (
    <ReadingPage
      title="Photo credits"
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Photo credits' }]}
      description="The photographs on this site are placeholders under open licences, used until the shop has its own pictures. Each one is listed here with its author, licence and source."
      meta={CREDITS.length > 0 ? pluralize(CREDITS.length, 'photograph') : undefined}
      toc={CREDITS.length > 0 ? toc : undefined}
      width="wide"
    >
      {CREDITS.length === 0 ? (
        <EmptyState
          title="No photographs listed yet"
          description="The photographs are still being sourced. Each one will be listed here with its author and licence as it is added."
          actions={
            <Button variant="dark" to="/shop">
              Browse the shop
            </Button>
          }
        />
      ) : (
        <>
          <section id="about-photos" aria-labelledby="about-photos-title" className="grid max-w-[44rem] scroll-mt-24 gap-4 border-t border-ink pt-5">
            <h2 id="about-photos-title" className="type-h2">
              About these photographs
            </h2>
            <div className="type-body grid gap-4">
              <p>
                A product photo shows the kind of part, not always the exact item you will receive. Check the name, the specifications and the box
                contents on the product page. As the shop photographs its own stock, these are replaced.
              </p>
              <p>
                Some licences let anyone reuse a photo only if they share their version under the same terms, or only with credit to the author. If
                you are the author of one of these and want it credited differently or taken down, write to us through the contact page.
              </p>
            </div>
            <Facts
              rows={[
                {
                  term: 'Licences',
                  value: (
                    <ul className="grid gap-1">
                      {licences.map(([licence, count]) => (
                        <li key={licence} className="flex justify-between gap-4">
                          <span>{licence}</span>
                          <span className="tnum text-muted">{count}</span>
                        </li>
                      ))}
                    </ul>
                  ),
                },
                {
                  term: 'Sources',
                  value: (
                    <ul className="grid gap-1">
                      {sources.map(([source, count]) => (
                        <li key={source} className="flex justify-between gap-4">
                          <span>{source}</span>
                          <span className="tnum text-muted">{count}</span>
                        </li>
                      ))}
                    </ul>
                  ),
                },
              ]}
            />
          </section>

          {groups.map((group) => (
            <section key={group.subject} id={`photos-${group.subject}`} aria-labelledby={`photos-${group.subject}-title`} className="scroll-mt-24">
              <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
                <h2 id={`photos-${group.subject}-title`} className="type-h3">
                  {group.label}
                </h2>
                <span className="type-small tnum shrink-0 text-muted">{pluralize(group.items.length, 'photo')}</span>
              </div>
              <ul className="grid md:grid-cols-2 md:gap-x-8">
                {group.items.map((credit) => (
                  <CreditRow key={credit.url} credit={credit} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </ReadingPage>
  );
}
