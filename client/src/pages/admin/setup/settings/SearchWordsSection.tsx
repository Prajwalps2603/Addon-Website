import { useState, type KeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { ArrowRight, Plus, Search, X } from 'lucide-react';
import { Button, Field, IconButton, Input } from '@/components/ui';
import type { AdminSettings } from '@/types/api';
import { SettingsForm, useSectionForm } from './shared';

const MAX_WORDS = 500;
const PREVIEW_COUNT = 24;

const schema = z.object({
  searchSynonyms: z
    .array(z.object({ says: z.string().trim().toLowerCase().min(1).max(60), means: z.string().trim().toLowerCase().min(1).max(80) }))
    .max(MAX_WORDS, { error: `Keep it to ${MAX_WORDS} pairs.` }),
});

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

const clean = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export function SearchWordsSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm: (s) => ({ searchSynonyms: s.searchSynonyms.map((pair) => ({ ...pair })) }),
    toPatch: (values) => values,
    name: 'Search words',
  });
  const words = useFieldArray({ control: section.form.control, name: 'searchSynonyms' });

  const [says, setSays] = useState('');
  const [means, setMeans] = useState('');
  const [addError, setAddError] = useState<{ says?: string; means?: string }>({});
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  const add = () => {
    const s = clean(says);
    const m = clean(means);
    const problems: { says?: string; means?: string } = {};
    if (!s) problems.says = 'Type what shoppers search for.';
    else if (s.length > 60) problems.says = 'Keep it to 60 characters.';
    if (!m) problems.means = 'Type the word the catalogue uses.';
    else if (m.length > 80) problems.means = 'Keep it to 80 characters.';
    const existing = words.fields.find((pair) => pair.says === s);
    if (s && !problems.says && existing) problems.says = `Already in the list: "${existing.says}" is read as "${existing.means}".`;
    if (s && m && s === m) problems.means = 'This is the same word. Nothing to translate.';
    setAddError(problems);
    if (problems.says || problems.means) return;
    words.prepend({ says: s, means: m });
    setSays('');
    setMeans('');
  };

  // Enter in the add row adds the pair instead of submitting the whole section.
  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  };

  const term = clean(filter);
  const indexed = words.fields.map((pair, index) => ({ pair, index }));
  const matches = term ? indexed.filter(({ pair }) => pair.says.includes(term) || pair.means.includes(term)) : indexed;
  const shown = term || showAll ? matches : matches.slice(0, PREVIEW_COUNT);

  return (
    <SettingsForm
      id="search-words"
      title="Search words"
      description="How shoppers say it, and what the catalogue calls it. A search for “dikki light” finds boot lights, and the results say what the search was read as."
      section={section}
      saveLabel="Save search words"
    >
      <div className="grid gap-3 bg-surface p-4">
        <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <Field label="Shoppers say" error={addError.says}>
            <Input value={says} autoCapitalize="none" placeholder="dikki" onChange={(event) => setSays(event.target.value)} onKeyDown={onEnter} />
          </Field>
          <ArrowRight aria-hidden className="mt-10 hidden size-5 text-muted sm:block" />
          <Field label="We call it" error={addError.means}>
            <Input value={means} autoCapitalize="none" placeholder="boot" onChange={(event) => setMeans(event.target.value)} onKeyDown={onEnter} />
          </Field>
          <Button type="button" variant="dark" className="sm:mt-7" iconLeft={<Plus aria-hidden />} onClick={add} disabled={words.fields.length >= MAX_WORDS}>
            Add
          </Button>
        </div>
        <p className="type-small text-muted">Added pairs go to the top of the list. Save to make them work in search.</p>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="type-small tnum text-muted">
            {words.fields.length} {words.fields.length === 1 ? 'pair' : 'pairs'}
            {term ? `, ${matches.length} matching` : ''}
          </p>
          <Field label="Find a word" labelHidden className="w-full sm:w-64">
            <Input type="search" value={filter} placeholder="Find a word" leading={<Search aria-hidden className="size-5" />} onChange={(event) => setFilter(event.target.value)} />
          </Field>
        </div>

        {words.fields.length === 0 ? (
          <p className="type-small border-y border-line py-4 text-muted">No search words. Search matches only the words in the catalogue.</p>
        ) : matches.length === 0 ? (
          <p className="type-small border-y border-line py-4 text-muted" role="status">
            No pair has “{term}”.
          </p>
        ) : (
          <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
            {shown.map(({ pair, index }) => (
              <li key={pair.id} className="flex min-h-12 items-center gap-2 border-b border-line">
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  <span className="font-bold break-words">{pair.says}</span>
                  <ArrowRight aria-label="is read as" className="size-4 shrink-0 self-center text-muted" />
                  <span className="break-words text-muted">{pair.means}</span>
                </span>
                <IconButton label={`Remove ${pair.says}`} size="sm" onClick={() => words.remove(index)}>
                  <X aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {!term && !showAll && matches.length > PREVIEW_COUNT && (
          <div>
            <Button variant="link" onClick={() => setShowAll(true)}>
              Show all {matches.length}
            </Button>
          </div>
        )}
      </div>
    </SettingsForm>
  );
}
