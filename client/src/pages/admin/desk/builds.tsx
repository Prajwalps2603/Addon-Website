/**
 * Build moderation pieces: the build card (the car drawn static, its parts and total) and the rename dialog.
 */
import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router';
import { DemoBadge, ProductFrame } from '@/components/commerce';
import { Badge, Button, Field, Input, Modal, Switch, toast } from '@/components/ui';
import CarStage from '@/features/buildbay/stage/CarStage';
import { api } from '@/lib/api';
import { formatDate, formatINR, pluralize } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { queryKeys } from '@/lib/queryKeys';
import type { Build } from '@/types/api';
import { useDeskRefresh } from './common';

export interface BuildCardProps {
  build: Build;
  busy: boolean;
  onStatus: (status: Build['status']) => void;
  onHouse: (isHouse: boolean) => void;
  onRename: () => void;
  onDelete: () => void;
}

const BODY_LABELS: Record<Build['state']['bodyType'], string> = { hatchback: 'Hatchback', sedan: 'Sedan', suv: 'SUV' };

export function BuildCard({ build, busy, onStatus, onHouse, onRename, onDelete }: BuildCardProps) {
  const shown = build.products.slice(0, 5);
  const more = build.products.length - shown.length;
  return (
    <article aria-labelledby={`build-${build.slug}`} className="grid content-start overflow-hidden rounded-[22px] bg-surface">
      <div className="overflow-hidden border-b border-line">
        <CarStage static state={build.state} className="block h-auto w-full" />
      </div>
      <div className="grid gap-4 p-4 sm:p-5">
        <header className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {build.isHouse && (
              <Badge tone="ink" variant="solid">
                House build
              </Badge>
            )}
            {build.isDemo && <DemoBadge />}
            <Badge tone="neutral" variant="outline">
              {BODY_LABELS[build.state.bodyType] ?? build.state.bodyType}
            </Badge>
          </div>
          <h3 id={`build-${build.slug}`} className="type-h3 break-words">
            {build.title || 'Untitled build'}
          </h3>
          <p className="type-small text-muted">
            {build.authorName || 'No name given'}
            {build.vehicleLabel ? ` · ${build.vehicleLabel}` : ''} ·{' '}
            <time dateTime={build.createdAt} className="tnum">
              {formatDate(build.createdAt)}
            </time>
          </p>
        </header>

        {build.products.length > 0 ? (
          <div>
            <ul aria-label="Parts" className="grid divide-y divide-line border-t border-line">
              {shown.map((product) => (
                <li key={product.id} className="flex items-center gap-3 py-2">
                  <ProductFrame image={product.image} alt="" artKind={product.artKind} className="size-10 shrink-0 overflow-hidden rounded-[10px]" />
                  <Link
                    to={`/p/${product.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring min-w-0 flex-1 rounded-control break-words underline-offset-4 hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="shrink-0 tnum">{formatINR(product.price)}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-baseline justify-between gap-3 border-t border-ink pt-2">
              <span className="type-small text-muted">{more > 0 ? `and ${pluralize(more, 'more part')}` : pluralize(build.products.length, 'part')}</span>
              <span className="type-price">{formatINR(build.total)}</span>
            </p>
          </div>
        ) : (
          <p className="type-small text-muted">No catalogue parts picked: a style preview only.</p>
        )}

        <Switch
          checked={build.isHouse}
          disabled={busy}
          onChange={(event) => onHouse(event.currentTarget.checked)}
          label="House build"
          description="Marks it as the shop's own build in the gallery."
        />

        <div className="flex flex-wrap items-center gap-2">
          {build.status !== 'approved' && (
            <Button onClick={() => onStatus('approved')} loading={busy} className="max-sm:flex-1">
              Approve
            </Button>
          )}
          {build.status !== 'rejected' && (
            <Button variant="outline" onClick={() => onStatus('rejected')} disabled={busy}>
              {build.status === 'approved' ? 'Take down' : 'Reject'}
            </Button>
          )}
          <Button variant="ghost" onClick={onRename} disabled={busy}>
            Rename
          </Button>
          <Button variant="ghost" onClick={onDelete} disabled={busy}>
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}

const renameSchema = z.object({
  title: z.string().trim().min(2, { error: 'Give it a name of at least 2 characters.' }).max(80, { error: 'Keep it under 80 characters.' }),
});
type RenameInput = z.input<typeof renameSchema>;
type RenameOutput = z.output<typeof renameSchema>;

export function RenameDialog({ build, onClose }: { build: Build | null; onClose: () => void }) {
  const refresh = useDeskRefresh();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RenameInput, unknown, RenameOutput>({ resolver: zodResolver(renameSchema), defaultValues: { title: '' } });

  useEffect(() => {
    if (build) {
      reset({ title: build.title });
      setFormError('');
    }
  }, [build, reset]);

  const onSubmit: SubmitHandler<RenameOutput> = async (values) => {
    if (!build) return;
    setFormError('');
    try {
      await api.admin.builds.update(build.slug, { title: values.title });
      toast.success('Build renamed');
      onClose();
      await refresh(queryKeys.admin.builds.all(), queryKeys.builds.all());
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  };

  return (
    <Modal
      open={build !== null}
      onClose={onClose}
      size="sm"
      title="Rename build"
      description="The name shown in the gallery. Keep the builder's idea; fix spelling or anything rude."
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <Field label="Name" error={errors.title?.message}>
          <Input autoComplete="off" data-autofocus {...register('title')} />
        </Field>
        {formError && !errors.title && (
          <p role="alert" className="type-small font-bold text-stop">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save name
          </Button>
        </div>
      </form>
    </Modal>
  );
}
