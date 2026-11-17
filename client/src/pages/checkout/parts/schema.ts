import * as z from 'zod';
import { isValidGstin, isValidPhone, isValidPincode, isValidState } from '@/lib/india';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** As the server checks it: letters, digits, spaces and hyphens, up to 16. */
const REGISTRATION = /^[A-Za-z0-9 -]{4,16}$/;

const phone = z
  .string()
  .trim()
  .refine((value) => isValidPhone(value), { error: 'Enter a 10-digit mobile number, like 98765 43210' });

/** The delivery address, checked only when the order is delivered. */
const addressSchema = z.object({
  name: z.string().trim().min(2, { error: 'Who should the courier ask for?' }).max(80),
  phone,
  line1: z.string().trim().min(3, { error: 'Enter the flat, house number or building' }).max(120),
  line2: z.string().trim().min(3, { error: 'Enter the area or street' }).max(120),
  landmark: z.string().trim().max(120, { error: 'Keep the landmark short' }),
  pincode: z
    .string()
    .trim()
    .refine((value) => isValidPincode(value), { error: 'Enter the 6-digit PIN code' }),
  city: z.string().trim().min(2, { error: 'Enter the town or city' }).max(80),
  state: z.string().refine((value) => isValidState(value), { error: 'Choose the state' }),
});

/**
 * Field names follow the server's request paths (contact.phone, shippingAddress.pincode,
 * registrationNumber), so a validation error from POST /orders lands on the right input with no renaming.
 * `fulfilment` is set by the "How do you want it?" step: the address is only checked for delivery and
 * the registration number only for studio fitting.
 */
export const checkoutSchema = z
  .object({
    fulfilment: z.enum(['delivery', 'pickup', 'studio']),
    contact: z.object({
      name: z.string().trim().min(2, { error: 'Enter your name' }).max(80, { error: 'Keep the name under 80 characters' }),
      phone,
      email: z
        .string()
        .trim()
        .max(120)
        .refine((value) => value === '' || EMAIL.test(value), { error: 'Check the email address, or leave it empty' }),
    }),
    shippingAddress: z.object({
      name: z.string(),
      phone: z.string(),
      line1: z.string(),
      line2: z.string(),
      landmark: z.string(),
      pincode: z.string(),
      city: z.string(),
      state: z.string(),
    }),
    registrationNumber: z.string(),
    wantsGstInvoice: z.boolean(),
    gstin: z.string().trim(),
    notes: z.string().trim().max(500, { error: 'Keep the note under 500 characters' }),
    saveAddress: z.boolean(),
  })
  .superRefine(
    (values, context) => {
      if (values.fulfilment === 'delivery') {
        const address = addressSchema.safeParse(values.shippingAddress);
        if (!address.success) {
          for (const issue of address.error.issues) {
            context.addIssue({ code: 'custom', path: ['shippingAddress', ...issue.path.map(String)], message: issue.message });
          }
        }
      }
      if (values.fulfilment === 'studio') {
        const registration = String(values.registrationNumber ?? '').trim();
        if (!registration) {
          context.addIssue({ code: 'custom', path: ['registrationNumber'], message: 'Enter the registration number, so we know your car when it arrives' });
        } else if (!REGISTRATION.test(registration)) {
          context.addIssue({ code: 'custom', path: ['registrationNumber'], message: 'Use letters, numbers and spaces, like KA 01 AB 1234' });
        }
      }
      if (values.wantsGstInvoice && !isValidGstin(String(values.gstin ?? '').trim())) {
        context.addIssue({
          code: 'custom',
          path: ['gstin'],
          message: values.gstin ? 'That GSTIN does not check out. It has 15 characters, like 27ABCDE1234F1Z5' : 'Enter the GSTIN for the invoice',
        });
      }
    },
    // Run even while another field (the name, say) is wrong, so every problem shows on the first try.
    { when: () => true },
  );

export type CheckoutValues = z.input<typeof checkoutSchema>;
