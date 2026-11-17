import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CircleCheck, Link2Off } from 'lucide-react';
import { Button, Callout, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { useDocumentMeta } from '@/lib/seo';
import { AuthShell } from './parts/AuthShell';
import { PasswordInput, StrengthHint } from './parts/PasswordInput';
import { resetSchema, type ResetInput } from './parts/schemas';

/** The link is spent, expired or mangled: say so plainly and offer a new one. */
function DeadLink({ reason }: { reason: 'missing' | 'expired' }) {
  return (
    <AuthShell title="Link not valid">
      <div className="grid gap-6">
        <div className="flex items-start gap-4 border-y border-line py-5" role="alert">
          <Link2Off aria-hidden className="mt-0.5 size-6 shrink-0 text-stop" />
          <div className="grid gap-2">
            <p className="type-body font-bold">
              {reason === 'expired' ? 'This reset link has expired or was already used.' : 'This reset link is incomplete.'}
            </p>
            <p className="type-small text-muted">
              {reason === 'expired'
                ? 'Each link works once, for 60 minutes. Ask for a new one and use the newest email.'
                : 'Open the link straight from the email. If your mail app cut it short, ask for a new one.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button to="/forgot-password">Send a new link</Button>
          <Button to="/login" variant="link">
            Back to sign in
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  useDocumentMeta({ title: 'Set a new password', noindex: true });
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ResetInput>({ resolver: zodResolver(resetSchema), defaultValues: { password: '' } });
  const password = useWatch({ control, name: 'password' }) ?? '';

  const reset = useMutation({ mutationFn: api.auth.resetPassword });

  if (!token) return <DeadLink reason="missing" />;
  if (expired) return <DeadLink reason="expired" />;

  if (done) {
    return (
      <AuthShell title="Password changed">
        <div className="grid gap-6">
          <div className="flex items-start gap-4 border-y border-line py-5" role="status">
            <CircleCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-fit" />
            <p className="type-body">Your new password is set. Sign in with it now.</p>
          </div>
          <Button to="/login" size="lg" className="justify-self-start">
            Sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    reset.mutate(
      { token, password: values.password },
      {
        onSuccess: () => setDone(true),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 400 && 'token' in error.fields) {
            setExpired(true);
            return;
          }
          setFormError(applyApiError(error, setError));
        },
      },
    );
  });

  return (
    <AuthShell title="Set a new password" description="Choose a new password for your account. Signing in on other phones will need it.">
      <form noValidate onSubmit={onSubmit} className="grid gap-5">
        {formError && (
          <Callout tone="danger" live>
            {formError}
          </Callout>
        )}
        <Field label="New password" hint={<StrengthHint password={password} />} error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" maxLength={72} autoFocus {...register('password')} />
        </Field>
        <Button type="submit" size="lg" block loading={reset.isPending}>
          Save new password
        </Button>
      </form>
      <p className="type-body border-t border-line pt-6">
        <Link to="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
