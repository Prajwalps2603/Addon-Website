/**
 * Razorpay: the client and the two signature checks. The only place in the app that deals in paise.
 *
 *   getRazorpay(ctx)                       the SDK client, ctx.razorpayClient when a test injected one, or null
 *   verifyPaymentSignature(ctx, { orderId, paymentId, signature })   checkout handler response
 *   verifyWebhookSignature(ctx, rawBody, signature)                  X-Razorpay-Signature on a webhook
 *   toPaise(rupees), fromPaise(paise)
 *
 * Signatures are hex HMAC-SHA256, compared in constant time:
 *   payment: HMAC(key_secret, `${orderId}|${paymentId}`), where orderId is the Razorpay order id WE stored
 *   webhook: HMAC(webhook_secret, raw request bytes), never a re-serialised JSON body
 */
import crypto from 'node:crypto';
import Razorpay from 'razorpay';

const clients = new WeakMap();

/** The Razorpay client, or null when the keys are not configured (Razorpay is then simply not offered). */
export function getRazorpay(ctx) {
  if (ctx.razorpayClient) return ctx.razorpayClient;
  const { keyId, keySecret } = ctx.config.razorpay ?? {};
  if (!keyId || !keySecret) return null;
  let entry = clients.get(ctx);
  if (!entry || entry.keyId !== keyId || entry.keySecret !== keySecret) {
    entry = { keyId, keySecret, client: new Razorpay({ key_id: keyId, key_secret: keySecret }) };
    clients.set(ctx, entry);
  }
  return entry.client;
}

/** Rupees (integer) to paise (integer). */
export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

/** Paise to whole rupees, rounded down so a part-rupee never counts as paid. */
export function fromPaise(paise) {
  const value = Number(paise);
  return Number.isFinite(value) ? Math.floor(value / 100) : 0;
}

function hmacHex(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/** Constant-time comparison of two hex strings. False for anything that is not hex or differs in length. */
function safeEqualHex(expected, received) {
  if (typeof received !== 'string' || !/^[0-9a-f]+$/i.test(received)) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(received.toLowerCase(), 'hex');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Checks the signature the checkout handler returns. `orderId` must be the Razorpay order id stored
 * on our order row, not the one the browser sent back.
 */
export function verifyPaymentSignature(ctx, { orderId, paymentId, signature }) {
  const secret = ctx.config.razorpay?.keySecret;
  if (!secret || !orderId || !paymentId || !signature) return false;
  return safeEqualHex(hmacHex(secret, `${orderId}|${paymentId}`), String(signature));
}

/** Checks X-Razorpay-Signature against the raw webhook body (a Buffer or the exact string received). */
export function verifyWebhookSignature(ctx, rawBody, signature) {
  const secret = ctx.config.razorpay?.webhookSecret;
  if (!secret || !signature) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  if (body.length === 0) return false;
  return safeEqualHex(hmacHex(secret, body), String(signature));
}

/** Test helper and documentation: the signature Razorpay would send for a payment. */
export function signPayment(secret, orderId, paymentId) {
  return hmacHex(secret, `${orderId}|${paymentId}`);
}

/** Test helper and documentation: the signature Razorpay would put on a webhook body. */
export function signWebhook(secret, rawBody) {
  return hmacHex(secret, rawBody);
}
