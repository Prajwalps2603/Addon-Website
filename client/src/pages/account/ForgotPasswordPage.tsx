import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { Button, Callout, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { useDocumentMeta } from '@/lib/seo';
import { AuthShell } from './parts/AuthShell';
import { forgotSchema, type ForgotInput } from './parts/schemas';

export default function ForgotPasswordPage() {
  useDocumentMeta({ title: 'Reset your password', noindex: true });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotInput>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const request = useMutation({ mutationFn: api.auth.forgotPassword });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    request.mutate(values, {
      onSuccess: () => setSentTo(values.email),
      // The server answers ok for any address, known or not, so the confirmation never reveals who
      // has an account. Only a problem with the request itself lands here: offline, too many tries.
      onError: (error) => setFormError(applyApiError(error, setError)),
    });
  });

  if (sentTo) {
    return (
      <AuthShell title="Check your email">
        <div className="grid gap-6">
          <div className="flex items-start gap-4 border-y border-line py-5">
            <MailCheck aria-hidden className="mt-0.5 size-6 shrink-0" />
            <div className="grid gap-2" role="status">
              <p className="type-body">
                If an account uses <strong className="break-all">{sentTo}</strong>, a link to set a new password is on its way.
              </p>
              <p className="type-small text-muted">The link works once, for 60 minutes. Not there in a few minutes? Look in spam or promotions.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button to="/login" variant="dark">
              Back to sign in
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setSentTo(null);
                request.reset();
              }}
            >
              Use a different email
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password" description="Enter the email you sign in with. We will send a link to set a new password.">
      <form noValidate onSubmit={onSubmit} className="grid gap-5">
        {formError && (
          <Callout tone="danger" live>
            {formError}
          </Callout>
        )}
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...register('email')} />
        </Field>
        <Button type="submit" size="lg" block loading={request.isPending}>
          Send reset link
        </Button>
      </form>
      <p className="type-body border-t border-line pt-6">
        Remembered it?{' '}
        <Link to="/login" className="link font-bold">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
