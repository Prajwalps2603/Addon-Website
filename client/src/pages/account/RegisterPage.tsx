import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Callout, Field, Input } from '@/components/ui';
import { useMe, useRegister } from '@/hooks/useMe';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { useDocumentMeta } from '@/lib/seo';
import { AuthFormSkeleton, AuthShell, DeviceSummary, useNextTarget, withNext } from './parts/AuthShell';
import { PasswordInput, StrengthHint } from './parts/PasswordInput';
import { registerSchema, type RegisterInput, type RegisterOutput } from './parts/schemas';

export default function RegisterPage() {
  useDocumentMeta({ title: 'Create an account', noindex: true });
  const { next, kept: keptNext } = useNextTarget();
  const { isSignedIn, isPending } = useMe();
  const registerAccount = useRegister();
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterOutput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  });
  const password = useWatch({ control, name: 'password' }) ?? '';

  if (isSignedIn) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setEmailTaken(false);
    registerAccount.mutate(values, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          setEmailTaken(true);
          setError('email', { type: 'server', message: 'An account already uses this email.' }, { shouldFocus: true });
          return;
        }
        setFormError(applyApiError(error, setError));
      },
    });
  });

  return (
    <AuthShell
      title="Create an account"
      description="Four details. Your orders, addresses, saved parts and cars then follow you to any phone."
      aside={<DeviceSummary action="register" />}
    >
      {isPending ? (
        <AuthFormSkeleton fields={4} />
      ) : (
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {formError && (
            <Callout tone="danger" live>
              {formError}
            </Callout>
          )}
          <Field label="Full name" error={errors.name?.message}>
            <Input autoComplete="name" autoCapitalize="words" {...register('name')} />
          </Field>
          <Field
            label="Email"
            hint="You sign in with this. Order receipts go here too."
            error={
              emailTaken ? (
                <>
                  An account already uses this email.{' '}
                  <Link to={withNext('/login', keptNext)} className="link">
                    Sign in
                  </Link>{' '}
                  or{' '}
                  <Link to="/forgot-password" className="link">
                    reset the password
                  </Link>
                  .
                </>
              ) : (
                errors.email?.message
              )
            }
          >
            <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...register('email')} />
          </Field>
          <Field label="Mobile number" hint="10 digits. Delivery updates and the courier use it." error={errors.phone?.message}>
            <Input type="tel" inputMode="numeric" autoComplete="tel-national" leading="+91" maxLength={14} {...register('phone')} />
          </Field>
          <Field label="Password" hint={<StrengthHint password={password} />} error={errors.password?.message}>
            <PasswordInput autoComplete="new-password" maxLength={72} {...register('password')} />
          </Field>
          <Button type="submit" size="lg" block loading={registerAccount.isPending}>
            Create account
          </Button>
          <p className="type-small text-muted">
            By creating an account you agree to the{' '}
            <Link to="/policies/terms" className="link">
              terms
            </Link>{' '}
            and the{' '}
            <Link to="/policies/privacy" className="link">
              privacy policy
            </Link>
            .
          </p>
        </form>
      )}

      <p className="type-body border-t border-line pt-6">
        Already have an account?{' '}
        <Link to={withNext('/login', keptNext)} className="link font-bold">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
