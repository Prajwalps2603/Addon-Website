import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { Button, Callout, Field, Input } from '@/components/ui';
import { useLogin, useMe } from '@/hooks/useMe';
import { applyApiError } from '@/lib/forms';
import { useDocumentMeta } from '@/lib/seo';
import { AuthFormSkeleton, AuthShell, DeviceSummary, useNextTarget, withNext } from './parts/AuthShell';
import { PasswordInput } from './parts/PasswordInput';
import { loginSchema, type LoginInput, type LoginOutput } from './parts/schemas';

export default function LoginPage() {
  useDocumentMeta({ title: 'Sign in', noindex: true });
  const { next, kept: keptNext } = useNextTarget();
  const forCheckout = next === '/checkout' || next.startsWith('/checkout?') || next.startsWith('/checkout/');
  const { isSignedIn, isPending } = useMe();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput, unknown, LoginOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Signed in already, or just now: the session query flips and this sends the visitor on.
  if (isSignedIn) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, { onError: (error) => setFormError(applyApiError(error, setError)) });
  });

  return (
    <AuthShell
      title="Sign in"
      description={forCheckout ? 'Sign in to fill checkout from your saved addresses. Or skip it: an account is not needed to order.' : undefined}
      aside={<DeviceSummary action="sign in" />}
    >
      {forCheckout && (
        <Callout
          tone="info"
          title="Check out as a guest"
          actions={
            <Button to={next} variant="outline" size="sm" iconRight={<ArrowRight />}>
              Continue as guest
            </Button>
          }
        >
          No account needed. You can follow the order later with its number and your phone.
        </Callout>
      )}

      {isPending ? (
        <AuthFormSkeleton fields={2} />
      ) : (
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {formError && (
            <Callout tone="danger" live>
              {formError}
            </Callout>
          )}
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...register('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" {...register('password')} />
          </Field>
          <div className="-mt-2 flex justify-end">
            <Link to="/forgot-password" className="link type-small">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" size="lg" block loading={login.isPending}>
            Sign in
          </Button>
        </form>
      )}

      <p className="type-body border-t border-line pt-6">
        New here?{' '}
        <Link to={withNext('/register', keptNext)} className="link font-bold">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
