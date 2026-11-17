import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ExternalLink } from 'lucide-react';
import { ShareButton, WhatsAppButton } from '@/components/commerce';
import { Button, Callout, Checkbox, CopyButton, Field, Input, Modal } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { queryKeys } from '@/lib/queryKeys';
import { siteUrl } from '@/lib/urls';
import type { Build, BuildState } from '@/types/api';
import { productIdsOf, sanitizeState } from './codec';

const saveSchema = z.object({
  title: z.string().trim().min(2, { error: 'Give the build a name of at least two letters.' }).max(60, { error: 'Keep the name under 60 characters.' }),
  authorName: z.string().trim().max(60, { error: 'Keep your name under 60 characters.' }),
  submitToGallery: z.boolean(),
});
type SaveInput = z.input<typeof saveSchema>;
type SaveOutput = z.output<typeof saveSchema>;

/** The message that goes with a shared build. */
export function shareBuildText(build: Pick<Build, 'title' | 'slug' | 'total' | 'vehicleLabel'>): string {
  return [
    `My build: ${build.title}${build.vehicleLabel ? ` (${build.vehicleLabel})` : ''}`,
    build.total > 0 ? `Parts total ${formatINR(build.total)}` : null,
    siteUrl(`/builds/${build.slug}`),
  ]
    .filter(Boolean)
    .join('\n');
}

export interface SaveBuildModalProps {
  open: boolean;
  onClose: () => void;
  state: BuildState;
  /** Called with the saved build, e.g. to put its link on the poster. */
  onSaved?: (build: Build) => void;
}

/** "Save build": a name and the builder's name, then a link to share and the option to show it in the gallery. */
export function SaveBuildModal({ open, onClose, state, onSaved }: SaveBuildModalProps) {
  const vehicle = useActiveVehicle();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<Build | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<SaveInput, unknown, SaveOutput>({
    resolver: zodResolver(saveSchema),
    defaultValues: { title: '', authorName: '', submitToGallery: false },
  });

  // A new save each time the dialog opens; the name typed last time stays as a starting point.
  useEffect(() => {
    if (open) {
      setSaved(null);
      setFormError(null);
    }
  }, [open]);

  const save = useMutation({
    mutationFn: (values: SaveOutput) => {
      const clean = sanitizeState(state).state;
      return api.builds.create({
        title: values.title,
        authorName: values.authorName || undefined,
        vehicleLabel: vehicle?.label,
        state: clean,
        productIds: productIdsOf(clean),
        submitToGallery: values.submitToGallery,
      });
    },
    onSuccess: (build) => {
      setSaved(build);
      onSaved?.(build);
      void queryClient.invalidateQueries({ queryKey: queryKeys.builds.all() });
      queryClient.setQueryData(queryKeys.builds.detail(build.slug), build);
    },
    onError: (error) => setFormError(applyApiError(error, setError)),
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    save.mutate(values);
  });

  const close = () => {
    if (saved) reset({ title: '', authorName: saved.authorName, submitToGallery: false });
    onClose();
  };

  if (saved) {
    const link = siteUrl(`/builds/${saved.slug}`);
    return (
      <Modal
        open={open}
        onClose={close}
        title="Build saved"
        description={
          saved.status === 'pending'
            ? 'The shop will look at it before it shows in the gallery. Until then it opens for anyone with the link.'
            : 'It is private: only people with the link can see it.'
        }
        footer={
          <Button variant="dark" onClick={close}>
            Back to the build
          </Button>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <span className="type-label text-muted">Link to this build</span>
            <p className="border border-line-strong bg-surface px-3 py-2.5 break-all type-small">{link}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={link} label="Copy link" />
              <ShareButton url={`/builds/${saved.slug}`} title={saved.title} text={`My build: ${saved.title}`} size="sm" />
              <WhatsAppButton to="share" text={shareBuildText(saved)} size="sm">
                Share on WhatsApp
              </WhatsAppButton>
              <Button size="sm" variant="ghost" to={`/builds/${saved.slug}`} iconRight={<ExternalLink aria-hidden />}>
                Open the build page
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Save this build"
      description="You get a link to share. Nothing else is needed: no account, no phone number."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="save-build-form" loading={save.isPending}>
            Save build
          </Button>
        </>
      }
    >
      <form id="save-build-form" noValidate onSubmit={onSubmit} className="grid gap-4">
        {formError && (
          <Callout tone="danger" live>
            {formError}
          </Callout>
        )}
        <Field label="Name the build" hint="For example: Sunday Swift" error={errors.title?.message} required>
          <Input {...register('title')} maxLength={60} autoComplete="off" />
        </Field>
        <Field label="Your name" hint="Shown with the build." error={errors.authorName?.message} optional>
          <Input {...register('authorName')} maxLength={60} autoComplete="given-name" />
        </Field>
        <Checkbox
          {...register('submitToGallery')}
          label="Show it in the gallery"
          description="The shop checks every build before it goes up on the builds page."
        />
        {vehicle && <p className="type-small text-muted">Saved with your car: {vehicle.label}.</p>}
      </form>
    </Modal>
  );
}
