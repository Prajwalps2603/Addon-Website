import * as z from 'zod';
import { isValidPhone, isValidPincode, isValidState, normalizePhone } from '@/lib/india';

/**
 * Client-side rules for the account forms. They mirror the server (server/src/lib/validate.js,
 * routes/auth.js, routes/account.js) so a form that passes here is accepted there; anything the
 * server still refuses comes back as ApiError.fields and lands on the same field names.
 */

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: 'Enter your email address' })
  .pipe(z.email({ error: 'Enter a valid email address, like name@example.com' }));

export const nameField = z
  .string()
  .trim()
  .min(2, { error: 'Enter your name' })
  .max(80, { error: 'Keep the name to 80 characters or fewer' });

export const phoneField = z
  .string()
  .trim()
  .refine((value) => isValidPhone(value), { error: 'Enter a 10-digit mobile number, like 98765 43210' })
  .transform((value) => normalizePhone(value) ?? value);

/** A new password: the server's rule (8 to 72 characters, bcrypt reads only 72 bytes). */
export const newPasswordField = z
  .string()
  .min(8, { error: 'Use at least 8 characters' })
  .max(72, { error: 'Use 72 characters or fewer' });

export const loginSchema = z.object({
  email: emailField,
  // Any length: an old password that is now "too short" must still reach the server.
  password: z.string().min(1, { error: 'Enter your password' }).max(200),
});

export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  password: newPasswordField,
});

export const forgotSchema = z.object({ email: emailField });

export const resetSchema = z.object({ password: newPasswordField });

export const profileSchema = z.object({ name: nameField, phone: phoneField });

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, { error: 'Enter your current password' }).max(200),
  newPassword: newPasswordField,
});

export const addressSchema = z.object({
  label: z.string().trim().max(30, { error: 'Keep the label to 30 characters or fewer' }),
  name: z.string().trim().min(2, { error: 'Who should the courier ask for?' }).max(80),
  phone: phoneField,
  pincode: z
    .string()
    .trim()
    .refine((value) => isValidPincode(value), { error: 'Enter the 6-digit PIN code' }),
  line1: z.string().trim().min(3, { error: 'Enter the flat, house number or building' }).max(120),
  line2: z.string().trim().max(120, { error: 'Keep this line to 120 characters or fewer' }),
  landmark: z.string().trim().max(120, { error: 'Keep the landmark short' }),
  city: z.string().trim().min(2, { error: 'Enter the town or city' }).max(60),
  state: z.string().refine((value) => isValidState(value), { error: 'Choose the state' }),
  isDefault: z.boolean(),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginOutput = z.output<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterOutput = z.output<typeof registerSchema>;
export type ForgotInput = z.input<typeof forgotSchema>;
export type ResetInput = z.input<typeof resetSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileOutput = z.output<typeof profileSchema>;
export type PasswordChangeInput = z.input<typeof passwordChangeSchema>;
export type AddressFormInput = z.input<typeof addressSchema>;
export type AddressFormOutput = z.output<typeof addressSchema>;
