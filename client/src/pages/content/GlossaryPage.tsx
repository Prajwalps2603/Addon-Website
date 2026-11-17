import { useDeferredValue, useMemo } from 'react';
import { Link2, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useGlossary } from '@/components/commerce';
import { Button, EmptyState, Field, IconButton, Input } from '@/components/ui';
import { pluralize } from '@/lib/format';
import { useDocumentMeta } from '@/lib/seo';
import type { GlossaryEntry } from '@/data/glossary';
import { ReadingPage, type TocItem } from './parts/Reading';

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matches(entry: GlossaryEntry, query: string): boolean {
  if (!query) return true;
  return [entry.term, ...entry.aliases, entry.short, entry.long].some((text) => normalise(text).includes(query));
}

/** Term or alias matches first, then matches in the explanation. */
function rank(entry: GlossaryEntry, query: string): number {
  if (!query) return 0;
  if (normalise(entry.term).startsWith(query)) return 0;
  if ([entry.term, ...entry.aliases].some((text) => normalise(text).includes(query))) return 1;
  return 2;
}

function Entry({ entry }: { entry: GlossaryEntry }) {
  return (
    <article
      id={entry.id}
      aria-labelledby={`${entry.id}-term`}
      className="grid scroll-mt-24 gap-2 border-b border-line py-5 target:-mx-3 target:bg-brand-soft target:px-3"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={`${entry.id}-term`} className="type-h3">
          {entry.term}
        </h3>
        <a
          href={`#${entry.id}`}
          className="focus-ring tap-44 -mr-1 grid size-8 shrink-0 place-items-center rounded-control text-muted hover:bg-surface-2 hover:text-ink"
        >
          <Link2 aria-hidden className="size-4" />
          <span className="sr-only">Link to {entry.term}</span>
        </a>
      </div>
      {entry.aliases.length > 0 && (
        <p className="type-small text-muted">
          Also written as <span className="text-ink">{entry.aliases.join(', ')}</span>
        </p>
      )}
      <p className="font-bold">{entry.short}</p>
      <p className="type-body max-w-prose">{entry.long}</p>
    </article>
  );
}

export default function GlossaryPage() {
  useDocumentMeta({
    title: 'Plain Talk glossary',
    description: 'The words the car accessory trade uses, explained plainly: PCD, offset, CANbus, lumens, IP67 and more.',
  });
  const { entries, categories } = useGlossary();
  const [params, setParams] = useSearchParams();
  const raw = params.get('q') ?? '';
  const query = normalise(useDeferredValue(raw));

  const groups = useMemo(() => {
    return categories
      .map((category) => ({
        ...category,
        items: entries
          .filter((entry) => entry.category === category.id && matches(entry, query))
          .sort((a, b) => rank(a, query) - rank(b, query) || a.term.localeCompare(b.term)),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, entries, query]);

  const found = groups.reduce((sum, group) => sum + group.items.length, 0);
  const toc: TocItem[] = groups.map((group) => ({ id: `group-${group.id}`, label: group.label, count: group.items.length }));

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const searchBox = (
    <div className="grid gap-2" role="search">
      <Field label="Search the glossary" labelHidden>
        <Input
          type="search"
          inputSize="lg"
          value={raw}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a word, such as offset or lumens"
          autoComplete="off"
          enterKeyHint="search"
          leading={<Search aria-hidden className="size-5" />}
          trailing={
            raw ? (
              <IconButton label="Clear search" size="sm" onClick={() => setQuery('')}>
                <X />
              </IconButton>
            ) : undefined
          }
        />
      </Field>
      <p className="type-small tnum text-muted" aria-live="polite">
        {query ? `${pluralize(found, 'word')} found for “${raw.trim()}”` : `${pluralize(entries.length, 'word')} in ${pluralize(categories.length, 'group')}`}
      </p>
    </div>
  );

  return (
    <ReadingPage
      title="Plain Talk"
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Glossary' }]}
      description="The words the trade uses, explained the way a good mechanic would. Tap any underlined word on a product page to see its line from here."
      toc={toc}
      top={searchBox}
    >
      {groups.length === 0 ? (
        <EmptyState
          title={entries.length === 0 ? 'The glossary is empty' : 'No word matches that'}
          description={
            entries.length === 0
              ? 'No words have been added yet.'
              : 'Try a shorter word or another spelling. If a word on our site is not here, ask us and we will add it.'
          }
          actions={
            entries.length === 0 ? null : (
              <>
                <Button variant="dark" onClick={() => setQuery('')}>
                  Show every word
                </Button>
                <Button variant="ghost" to="/contact">
                  Ask us
                </Button>
              </>
            )
          }
          art={null}
        />
      ) : (
        groups.map((group) => (
          <section key={group.id} id={`group-${group.id}`} aria-labelledby={`group-${group.id}-title`} className="scroll-mt-24">
            <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
              <h2 id={`group-${group.id}-title`} className="type-h2">
                {group.label}
              </h2>
              <span className="type-small tnum shrink-0 text-muted">{pluralize(group.items.length, 'word')}</span>
            </div>
            {group.items.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </section>
        ))
      )}
    </ReadingPage>
  );
}
