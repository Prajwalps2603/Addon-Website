import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/commerce';
import { Button, Callout, Field, Input, Skeleton, toast } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { MeResponse, User } from '@/types/api';
import { PasswordInput, StrengthHint } from './parts/PasswordInput';
import {
  passwordChangeSchema,
  profileSchema,
  type PasswordChangeInput,
  type ProfileInput,
  type ProfileOutput,
} from './parts/schemas';

function DetailsForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileInput, unknown, ProfileOutput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone },
  });

  const save = useMutation({ mutationFn: api.account.updateProfile });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    save.mutate(values, {
      onSuccess: ({ user: saved }) => {
        queryClient.setQueryData<MeResponse>(queryKeys.me(), { user: saved });
        reset({ name: saved.name, phone: saved.phone });
        toast.success('Details saved');
      },
      onError: (error) => setFormError(applyApiError(error, setError)),
    });
  });

  return (
    <section aria-labelledby="details-heading" className="grid gap-5 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
      <div className="grid content-start gap-1">
        <h2 id="details-heading" className="type-h3">
          Your details
        </h2>
        <p className="type-small text-muted">Checkout and delivery updates use these.</p>
      </div>
      <form noValidate onSubmit={onSubmit} className="grid max-w-lg gap-5">
        {formError && (
          <Callout tone="danger" live>
            {formError}
          </Callout>
        )}
        <div className="grid gap-1.5">
          <span className="type-small font-bold">Email</span>
          <p className="type-body break-all">
            {user.email}
          </p>
          <p className="type-small text-muted">You sign in with this, so it cannot be changed here.</p>
        </div>
        <Field label="Full name" error={errors.name?.message}>
          <Input autoComplete="name" autoCapitalize="words" {...register('name')} />
        </Field>
        <Field label="Mobile number" hint="10 digits." error={errors.phone?.message}>
          <Input type="tel" inputMode="numeric" autoComplete="tel-national" leading="+91" maxLength={14} {...register('phone')} />
        </Field>
        <Button type="submit" variant="dark" loading={save.isPending} disabled={!isDirty} className="justify-self-start">
          Save details
        </Button>
      </form>
    </section>
  );
}

function PasswordForm({ email }: { email: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const newPassword = useWatch({ control, name: 'newPassword' }) ?? '';

  const change = useMutation({ mutationFn: api.account.changePassword });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    change.mutate(values, {
      onSuccess: () => {
        reset();
        toast.success('Password changed', { description: 'Use the new one next time you sign in.' });
      },
      onError: (error) => setFormError(applyApiError(error, setError)),
    });
  });

  return (
    <section aria-labelledby="password-heading" className="grid gap-5 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
      <div className="grid content-start gap-1">
        <h2 id="password-heading" className="type-h3">
          Password
        </h2>
        <p className="type-small text-muted">Any reset link already sent stops working once you change it.</p>
      </div>
      <form noValidate onSubmit={onSubmit} className="grid max-w-lg gap-5">
        {formError && !errors.currentPassword && (
          <Callout tone="danger" live>
            {formError}
          </Callout>
        )}
        {/* Lets password managers pair the new password with this account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field label="Current password" error={errors.currentPassword?.message}>
          <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
        </Field>
        <Field label="New password" hint={<StrengthHint password={newPassword} />} error={errors.newPassword?.message}>
          <PasswordInput autoComplete="new-password" maxLength={72} {...register('newPassword')} />
        </Field>
        <Button type="submit" variant="dark" loading={change.isPending} className="justify-self-start">
          Change password
        </Button>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  useDocumentMeta({ title: 'Profile', noindex: true });
  const { user } = useMe();

  return (
    <div className="grid gap-8">
      <PageHeader title="Profile" meta={user ? `Account opened ${formatDate(user.createdAt)}` : undefined} />
      {user ? (
        <div className="grid gap-10 border-t border-ink pt-8">
          <DetailsForm key={user.id} user={user} />
          <div className="border-t border-line pt-10">
            <PasswordForm email={user.email} />
          </div>
        </div>
      ) : (
        <div className="grid max-w-lg gap-5" aria-hidden>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      )}
    </div>
  );
}
