import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { IconButton, Input, type InputProps } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * A password input with a show / hide control. Spread react-hook-form's register() onto it,
 * inside a Field, exactly like Input.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'trailing'>>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      ref={ref}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <IconButton
          type="button"
          size="sm"
          label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </IconButton>
      }
    />
  );
});

export interface Strength {
  /** 0 = nothing typed, 1 = too short or easy to guess, 2 = acceptable, 3 = strong. */
  level: 0 | 1 | 2 | 3;
  words: string;
}

const COMMON = ['password', '12345678', '123456789', 'qwertyui', 'abcdefgh', 'iloveyou', '11111111', '00000000'];

/** A plain estimate, not a promise: length matters most, then a mix of kinds of character. */
export function passwordStrength(password: string): Strength {
  if (!password) return { level: 0, words: 'At least 8 characters. A short sentence is easy to remember and hard to guess.' };
  if (password.length < 8) {
    const missing = 8 - password.length;
    return { level: 1, words: `Too short. ${missing} more ${missing === 1 ? 'character' : 'characters'} to go.` };
  }
  const lower = password.toLowerCase();
  if (COMMON.some((word) => lower.includes(word)) || /^(.)\1+$/.test(password) || /^\d+$/.test(password)) {
    return { level: 1, words: 'Easy to guess. Avoid common words and plain number runs.' };
  }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (password.length >= 14 || (password.length >= 10 && kinds >= 3)) return { level: 3, words: 'Strong.' };
  return { level: 2, words: 'Fine. A few more characters would make it stronger.' };
}

const FILL: Record<Strength['level'], string> = { 0: 'bg-line', 1: 'bg-stop', 2: 'bg-warn', 3: 'bg-fit' };

/**
 * The strength hint under a new-password field: a three-step track plus the words, so colour
 * is never the only signal. Pass it as the Field's `hint`.
 */
export function StrengthHint({ password }: { password: string }) {
  const strength = passwordStrength(password);
  return (
    <span className="grid gap-1.5">
      <span aria-hidden className="grid max-w-56 grid-cols-3 gap-1">
        {[1, 2, 3].map((step) => (
          <span key={step} className={cn('h-1 transition-colors dur-base', strength.level >= step ? FILL[strength.level] : 'bg-line')} />
        ))}
      </span>
      <span aria-live="polite">{strength.words}</span>
    </span>
  );
}
