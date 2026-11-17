/**
 * Razorpay Standard Checkout. The script is loaded from Razorpay at runtime (it must not be
 * bundled or self-hosted) the first time a payment needs it.
 *
 *   const proof = await openRazorpay(instruction, { storeName, description: `Order ${order.orderNumber}` });
 *   const paid = await api.payments.razorpayVerify({ orderNumber: order.orderNumber, ...proof });
 *
 * The order is paid only when the server has verified the signature.
 */
import type { PaymentInstruction, RazorpayVerifyRequest } from '@/types/api';

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
/** The checkout sheet's accent. Razorpay takes a hex value, not a CSS token. */
const DEFAULT_THEME_COLOR = '#0C0D0F';

export type RazorpayInstruction = Extract<PaymentInstruction, { provider: 'razorpay' }>;

/** What Razorpay hands back after a successful payment: send it to api.payments.razorpayVerify. */
export type RazorpayProof = Pick<RazorpayVerifyRequest, 'razorpay_order_id' | 'razorpay_payment_id' | 'razorpay_signature'>;

interface RazorpayFailure {
  error?: { code?: string; description?: string; reason?: string };
}

interface RazorpayCheckout {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void;
}

interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayProof) => void;
  modal: { ondismiss: () => void; confirm_close: boolean };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckout;
  }
}

/** The payment window could not be loaded (offline, or blocked by the browser). */
export class PaymentUnavailableError extends Error {
  constructor() {
    super('Could not open the payment window. Check your connection and try again.');
    this.name = 'PaymentUnavailableError';
  }
}

/** The shopper closed the payment window without paying. The order stays unpaid and can be retried. */
export class PaymentDismissedError extends Error {
  /** Razorpay's description of the last failed attempt inside the window, when there was one. */
  readonly failureReason: string;

  constructor(failureReason = '') {
    super('Payment was not completed.');
    this.name = 'PaymentDismissedError';
    this.failureReason = failureReason;
  }
}

let loading: Promise<void> | null = null;

/** Loads checkout.js once. Safe to call early (when the payment step appears) so the window opens without a wait. */
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    const fail = () => {
      script.remove();
      loading = null;
      reject(new PaymentUnavailableError());
    };
    script.onload = () => (window.Razorpay ? resolve() : fail());
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Razorpay's window does not work inside the Instagram and Facebook in-app browsers.
 * Offer UPI or cash on delivery there, or ask the shopper to open the page in Chrome.
 */
export function isInAppBrowser(): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent);
}

export interface OpenRazorpayOptions {
  /** Shown as the merchant name: pass settings.storeName. */
  storeName: string;
  /** For example 'Order ADN-261117-4F7K'. */
  description?: string;
  /** Square logo URL. */
  image?: string;
  themeColor?: string;
}

/**
 * Opens the payment window for a Razorpay instruction. Resolves with the three signature
 * fields once the shopper has paid. Rejects with PaymentDismissedError when they close the
 * window, or PaymentUnavailableError when it could not be loaded. A failed attempt inside the
 * window does not reject: Razorpay lets the shopper try again there.
 */
export async function openRazorpay(instruction: RazorpayInstruction, options: OpenRazorpayOptions): Promise<RazorpayProof> {
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new PaymentUnavailableError();

  return new Promise<RazorpayProof>((resolve, reject) => {
    let lastFailure = '';
    const checkout = new Razorpay({
      key: instruction.keyId,
      order_id: instruction.razorpayOrderId,
      amount: instruction.amountPaise,
      currency: instruction.currency,
      name: options.storeName,
      description: options.description,
      image: options.image,
      prefill: instruction.prefill,
      theme: { color: options.themeColor ?? DEFAULT_THEME_COLOR },
      handler: (response) =>
        resolve({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      modal: {
        confirm_close: true,
        ondismiss: () => reject(new PaymentDismissedError(lastFailure)),
      },
    });
    checkout.on('payment.failed', (response) => {
      lastFailure = response.error?.description ?? response.error?.reason ?? '';
    });
    checkout.open();
  });
}
