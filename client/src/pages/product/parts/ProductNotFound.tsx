import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Search } from 'lucide-react';
import { Button, EmptyState, Field, Input } from '@/components/ui';

const schema = z.object({
  q: z.string().trim().min(2, { error: 'Type at least two letters' }).max(80, { error: 'Keep it under 80 letters' }),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** A slug that leads nowhere: say so, and offer a search already filled with the words from the address. */
export function ProductNotFound({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const guess = slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: { q: guess } });

  const onSubmit = handleSubmit(({ q }) => navigate(`/search?q=${encodeURIComponent(q)}`));

  return (
    <div className="container-page section-y">
      <EmptyState
        title="We could not find that part"
        description="The link may be old, or the part is no longer sold. Search for it, or browse the shop."
        actions={
          <div className="grid w-full max-w-md gap-4">
            <form onSubmit={onSubmit} noValidate role="search" className="flex items-start gap-2">
              <Field label="Search the shop" labelHidden error={errors.q?.message} className="min-w-0 flex-1">
                <Input {...register('q')} type="search" inputMode="search" enterKeyHint="search" leading={<Search aria-hidden className="size-4" />} />
              </Field>
              <Button type="submit">Search</Button>
            </form>
            <Button to="/shop" variant="link" className="justify-self-start">
              Browse every category
            </Button>
          </div>
        }
      />
    </div>
  );
}
