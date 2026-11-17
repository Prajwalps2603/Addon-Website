/**
 * Emails about orders and enquiries. Every function here resolves, never rejects and never throws:
 * a mail failure must not fail the request that triggered it.
 *
 *   orderPlaced(ctx, order)          customer confirmation (when the order has an email) + store notification
 *   orderStatusChanged(ctx, order)   customer update for the order's current status
 *   enquiryReceived(ctx, enquiry)    customer copy (when an email was given) + store notification
 *
 * `order` is the Order shape of api.ts (loadOrder()), `enquiry` the Enquiry shape (toEnquiry()).
 * The sending work starts synchronously, so with no SMTP the message is already in ctx.mailer.outbox
 * when the call returns, even when the caller does not await it.
 */
import { formatINR } from './money.js';

const STATUS_TEXT = {
  pending_payment: 'Waiting for payment',
  placed: 'Order placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

const PAYMENT_TEXT = {
  cod: 'Cash on delivery',
  razorpay: 'Card, netbanking or wallet',
  upi: 'UPI',
};

const PAYMENT_STATUS_TEXT = {
  pending: 'Not paid yet',
  advance_paid: 'Advance paid',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

const ENQUIRY_KIND_TEXT = {
  contact: 'Message',
  complaint: 'Complaint',
  bulk: 'Bulk order enquiry',
  install: 'Fitting enquiry',
  return: 'Return request',
};

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function formatDay(ymd) {
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isFinite(ms) ? longDate.format(new Date(ms)) : String(ymd ?? '');
}

/** Escapes text for HTML bodies and attributes. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
const esc = escapeHtml;
const rs = (amount) => formatINR(Number(amount) || 0);

function storeInfo(ctx) {
  const settings = ctx.settings.get();
  return {
    name: settings.storeName || 'Addon Automotive',
    phone: settings.phone || '',
    whatsapp: settings.whatsapp || '',
    email: settings.email || '',
    orderEmail: settings.notifications?.orderEmail || settings.email || '',
  };
}

/** The link that opens the order page for a guest: PUBLIC_URL/order/<number>?token=... */
export function orderLink(ctx, order, { token } = {}) {
  const base = `${ctx.config.publicUrl}/order/${encodeURIComponent(order.orderNumber)}`;
  let access = token ?? order.accessToken;
  if (!access) {
    access = ctx.db.get('SELECT access_token FROM orders WHERE order_number = ?', [order.orderNumber])?.access_token;
  }
  return access ? `${base}?token=${encodeURIComponent(access)}` : base;
}

function adminLink(ctx, order) {
  return `${ctx.config.publicUrl}/admin/orders/${encodeURIComponent(order.orderNumber)}`;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function page(store, { heading, intro, body }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e2e2">
<tr><td style="background:#111111;color:#ffffff;padding:16px 24px;font-weight:bold;font-size:18px;border-bottom:4px solid #C8102E">${esc(store.name)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:22px">${esc(heading)}</h1>
${intro ? `<p style="margin:0 0 16px">${intro}</p>` : ''}
${body}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e2e2e2;color:#555;font-size:13px">${footerHtml(store)}</td></tr>
</table></td></tr></table></body></html>`;
}

function footerHtml(store) {
  const bits = [];
  if (store.phone) bits.push(`Call ${esc(store.phone)}`);
  if (store.whatsapp) bits.push(`WhatsApp ${esc(store.whatsapp)}`);
  if (store.email) bits.push(`Email ${esc(store.email)}`);
  return `${esc(store.name)}${bits.length ? ` &middot; ${bits.join(' &middot; ')}` : ''}<br>Reply to this email if anything looks wrong.`;
}

function footerText(store) {
  const bits = [];
  if (store.phone) bits.push(`Call ${store.phone}`);
  if (store.whatsapp) bits.push(`WhatsApp ${store.whatsapp}`);
  if (store.email) bits.push(`Email ${store.email}`);
  return [`${store.name}${bits.length ? `: ${bits.join(', ')}` : ''}`, 'Reply to this email if anything looks wrong.'].join('\n');
}

function button(href, label) {
  return `<p style="margin:20px 0"><a href="${esc(href)}" style="display:inline-block;background:#C8102E;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border:2px solid #C8102E">${esc(label)}</a></p>`;
}

function itemName(item) {
  return item.variantName ? `${item.name} (${item.variantName})` : item.name;
}

function customText(item) {
  if (!item.custom || typeof item.custom !== 'object') return '';
  const text = typeof item.custom.text === 'string' ? item.custom.text : '';
  return text ? `Design: ${text}` : '';
}

function totalsRows(order) {
  const rows = [['Items', rs(order.subtotal)]];
  if (order.discount > 0) rows.push([`Coupon ${order.couponCode}`.trim(), `-${rs(order.discount)}`]);
  if (order.prepaidDiscount > 0) rows.push(['Paid online discount', `-${rs(order.prepaidDiscount)}`]);
  rows.push(['Delivery', order.shippingFee > 0 ? rs(order.shippingFee) : 'Free']);
  if (order.codFee > 0) rows.push(['Cash on delivery fee', rs(order.codFee)]);
  rows.push(['Total (inclusive of GST)', rs(order.total)]);
  if (order.amountPaid > 0) rows.push(['Paid', rs(order.amountPaid)]);
  if (order.amountPaid > 0 || order.paymentMethod === 'cod') rows.push(['To pay', rs(order.amountDue)]);
  return rows;
}

function itemsTableHtml(order) {
  const cell = 'padding:8px 6px;border-bottom:1px solid #e2e2e2;vertical-align:top';
  const items = order.items
    .map((item) => {
      const extra = [item.sku ? `SKU ${esc(item.sku)}` : '', esc(customText(item))].filter(Boolean).join(' &middot; ');
      return `<tr><td style="${cell}">${esc(itemName(item))}${extra ? `<br><span style="color:#555;font-size:13px">${extra}</span>` : ''}</td>
<td style="${cell};text-align:center;white-space:nowrap">${item.qty}</td>
<td style="${cell};text-align:right;white-space:nowrap">${rs(item.lineTotal)}</td></tr>`;
    })
    .join('\n');
  const totals = totalsRows(order)
    .map(([label, value], index, all) => {
      const strong = index === all.findIndex(([l]) => l.startsWith('Total'));
      const style = `padding:4px 6px;text-align:right;${strong ? 'font-weight:bold;' : ''}`;
      return `<tr><td colspan="2" style="${style}">${esc(label)}</td><td style="${style};white-space:nowrap">${esc(value)}</td></tr>`;
    })
    .join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
<tr><th align="left" style="padding:8px 6px;border-bottom:2px solid #111">Part</th><th style="padding:8px 6px;border-bottom:2px solid #111">Qty</th><th align="right" style="padding:8px 6px;border-bottom:2px solid #111">Amount</th></tr>
${items}
${totals}
</table>`;
}

function itemsText(order) {
  const lines = order.items.map((item) => {
    const extra = customText(item);
    return `- ${itemName(item)} x ${item.qty}: ${rs(item.lineTotal)}${extra ? ` (${extra})` : ''}`;
  });
  const totals = totalsRows(order).map(([label, value]) => `${label}: ${value}`);
  return [...lines, '', ...totals].join('\n');
}

function addressLines(order) {
  const a = order.shippingAddress;
  return [
    a.name,
    a.line1,
    a.line2,
    a.landmark ? `Near ${a.landmark}` : '',
    `${a.city}, ${a.state} ${a.pincode}`,
    a.phone ? `Phone ${a.phone}` : '',
  ].filter(Boolean);
}

function addressHtml(order) {
  return `<p style="margin:0 0 16px"><strong>Delivering to</strong><br>${addressLines(order).map(esc).join('<br>')}</p>`;
}

function deliveryText(order) {
  const window = order.estimatedDelivery;
  if (!window) return '';
  return `Expected delivery between ${formatDay(window.earliest)} and ${formatDay(window.latest)}.`;
}

function paymentLine(order) {
  if (order.paymentMethod === 'cod') {
    if (order.amountPaid > 0) return `${rs(order.amountPaid)} paid online. Pay ${rs(order.amountDue)} to the courier on delivery.`;
    return `Pay ${rs(order.amountDue)} in cash or UPI to the courier on delivery.`;
  }
  if (order.paymentStatus === 'paid') return `Paid ${rs(order.amountPaid)} by ${PAYMENT_TEXT[order.paymentMethod] ?? order.paymentMethod}.`;
  if (order.paymentMethod === 'upi' && order.upiReference) {
    return `UPI reference ${order.upiReference} received. We confirm the order once the payment shows in our account.`;
  }
  return `${PAYMENT_TEXT[order.paymentMethod] ?? order.paymentMethod}: ${PAYMENT_STATUS_TEXT[order.paymentStatus] ?? order.paymentStatus}.`;
}

/** Runs a send and swallows anything it throws. */
function safely(fn) {
  try {
    return Promise.resolve(fn()).catch((err) => {
      console.error(`[notify] ${err?.message ?? err}`);
      return [];
    });
  } catch (err) {
    console.error(`[notify] ${err?.message ?? err}`);
    return Promise.resolve([]);
  }
}

// ---------------------------------------------------------------------------
// Order placed
// ---------------------------------------------------------------------------

function orderPlacedCustomer(ctx, store, order) {
  const link = orderLink(ctx, order);
  const delivery = deliveryText(order);
  const subject = `Order ${order.orderNumber} placed with ${store.name}`;
  const intro = `Thanks, ${esc(order.customerName)}. We have your order <strong>${esc(order.orderNumber)}</strong>. ${esc(paymentLine(order))}`;
  const html = page(store, {
    heading: 'Your order is in',
    intro,
    body: `${itemsTableHtml(order)}
${addressHtml(order)}
${order.vehicle ? `<p style="margin:0 0 16px"><strong>For</strong> ${esc(order.vehicle)}</p>` : ''}
${delivery ? `<p style="margin:0 0 16px">${esc(delivery)}</p>` : ''}
${button(link, 'Track this order')}
<p style="margin:0;color:#555;font-size:13px">Keep this email: the link above opens your order without signing in. Invoice ${esc(order.invoiceNumber)}.</p>`,
  });
  const text = [
    `Thanks, ${order.customerName}. We have your order ${order.orderNumber}.`,
    paymentLine(order),
    '',
    itemsText(order),
    '',
    'Delivering to:',
    ...addressLines(order),
    order.vehicle ? `\nFor: ${order.vehicle}` : '',
    delivery ? `\n${delivery}` : '',
    '',
    `Track this order: ${link}`,
    `Invoice ${order.invoiceNumber}`,
    '',
    footerText(store),
  ]
    .filter((line) => line !== null)
    .join('\n');
  return { to: order.email, subject, text, html, replyTo: store.email || undefined };
}

function orderPlacedStore(ctx, store, order) {
  const link = adminLink(ctx, order);
  const subject = `New order ${order.orderNumber}: ${rs(order.total)}, ${PAYMENT_TEXT[order.paymentMethod] ?? order.paymentMethod}`;
  const contact = [order.customerName, order.phone, order.email].filter(Boolean).join(', ');
  const html = page(store, {
    heading: `New order ${order.orderNumber}`,
    intro: `${esc(contact)}<br>${esc(paymentLine(order))}`,
    body: `${itemsTableHtml(order)}
${addressHtml(order)}
${order.vehicle ? `<p style="margin:0 0 16px"><strong>Car</strong> ${esc(order.vehicle)}</p>` : ''}
${order.notes ? `<p style="margin:0 0 16px"><strong>Notes</strong> ${esc(order.notes)}</p>` : ''}
${order.gstin ? `<p style="margin:0 0 16px"><strong>GSTIN</strong> ${esc(order.gstin)}</p>` : ''}
${button(link, 'Open in admin')}`,
  });
  const text = [
    `New order ${order.orderNumber}`,
    contact,
    paymentLine(order),
    '',
    itemsText(order),
    '',
    'Delivering to:',
    ...addressLines(order),
    order.vehicle ? `Car: ${order.vehicle}` : '',
    order.notes ? `Notes: ${order.notes}` : '',
    order.gstin ? `GSTIN: ${order.gstin}` : '',
    '',
    `Open in admin: ${link}`,
  ].join('\n');
  return { to: store.orderEmail, subject, text, html, replyTo: order.email || undefined };
}

/** Customer confirmation (when the order has an email) and the store's new-order email. */
export function orderPlaced(ctx, order) {
  return safely(() => {
    const store = storeInfo(ctx);
    const sends = [];
    if (order.email) sends.push(ctx.mailer.send(orderPlacedCustomer(ctx, store, order)));
    if (store.orderEmail) sends.push(ctx.mailer.send(orderPlacedStore(ctx, store, order)));
    return Promise.all(sends);
  });
}

// ---------------------------------------------------------------------------
// Status changed
// ---------------------------------------------------------------------------

function statusMessage(order, store) {
  const { carrier, number, url } = order.tracking;
  switch (order.status) {
    case 'placed':
      return `Your order is placed. ${paymentLine(order)}`;
    case 'confirmed':
      return `We have confirmed your order and are getting the parts ready. ${deliveryText(order)}`.trim();
    case 'packed':
      return order.packPhoto
        ? 'Your parts are packed. There is a photo of exactly what went into the box on your order page.'
        : 'Your parts are packed and waiting for the courier.';
    case 'shipped': {
      const tracking = [carrier, number].filter(Boolean).join(' ');
      return `Your order is on its way${tracking ? ` with ${tracking}` : ''}. ${deliveryText(order)}${url ? ` Track it at ${url}` : ''}`.trim();
    }
    case 'out_for_delivery':
      return order.paymentMethod === 'cod' && order.amountDue > 0
        ? `Your order is out for delivery today. Keep ${rs(order.amountDue)} ready for the courier.`
        : 'Your order is out for delivery today.';
    case 'delivered':
      return 'Your order has been delivered. Once it is fitted, a 60-second fitted report on the product page helps the next person with the same car.';
    case 'cancelled':
      return order.amountPaid > 0
        ? `Your order has been cancelled. We will refund the ${rs(order.amountPaid)} you paid to the way you paid it. Message us if you did not ask for this.`
        : 'Your order has been cancelled. Message us if you did not ask for this.';
    case 'returned':
      return `Your return has been received. ${order.paymentStatus === 'refunded' ? 'The refund has been issued.' : `We will be in touch about the refund. Questions: ${store.phone || store.email || 'reply to this email'}.`}`;
    default:
      return `Your order is now: ${STATUS_TEXT[order.status] ?? order.status}.`;
  }
}

/** Tells the customer (when the order has an email) about the order's current status. */
export function orderStatusChanged(ctx, order) {
  return safely(() => {
    if (!order.email) return [];
    const store = storeInfo(ctx);
    const link = orderLink(ctx, order);
    const label = STATUS_TEXT[order.status] ?? order.status;
    const message = statusMessage(order, store);
    const subject = `Order ${order.orderNumber}: ${label}`;
    const html = page(store, {
      heading: label,
      intro: `Hello ${esc(order.customerName)}, an update on order <strong>${esc(order.orderNumber)}</strong>.`,
      body: `<p style="margin:0 0 16px">${esc(message)}</p>
${itemsTableHtml(order)}
${button(link, 'Open your order')}`,
    });
    const text = [`Hello ${order.customerName}, an update on order ${order.orderNumber}.`, '', message, '', itemsText(order), '', `Open your order: ${link}`, '', footerText(store)].join('\n');
    return Promise.all([ctx.mailer.send({ to: order.email, subject, text, html, replyTo: store.email || undefined })]);
  });
}

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

/** The customer's copy (when they gave an email) and the store's notification of a new enquiry. */
export function enquiryReceived(ctx, enquiry) {
  return safely(() => {
    const store = storeInfo(ctx);
    const kind = ENQUIRY_KIND_TEXT[enquiry.kind] ?? 'Message';
    const details = [
      ['Ticket', enquiry.ticketNumber],
      ['Subject', enquiry.subject],
      ['Order', enquiry.orderNumber],
      ['Part', enquiry.productName ?? ''],
      ['Car', enquiry.vehicle],
    ].filter(([, value]) => value);
    const detailsHtml = details.map(([label, value]) => `<strong>${esc(label)}</strong> ${esc(value)}`).join('<br>');
    const detailsText = details.map(([label, value]) => `${label}: ${value}`).join('\n');
    const messageHtml = `<p style="margin:0 0 16px;padding:12px;border-left:4px solid #C8102E;background:#fafafa;white-space:pre-wrap">${esc(enquiry.message)}</p>`;
    const sends = [];

    if (enquiry.email) {
      const reply = store.whatsapp ? `We reply within working hours. For anything urgent, WhatsApp ${store.whatsapp} and quote ${enquiry.ticketNumber}.` : `We reply within working hours. Quote ${enquiry.ticketNumber} if you write again.`;
      sends.push(
        ctx.mailer.send({
          to: enquiry.email,
          subject: `We have your ${kind.toLowerCase()}: ${enquiry.ticketNumber}`,
          text: [`Hello ${enquiry.name},`, '', `We have your ${kind.toLowerCase()}. Your ticket number is ${enquiry.ticketNumber}.`, reply, '', detailsText, '', 'What you wrote:', enquiry.message, '', footerText(store)].join('\n'),
          html: page(store, {
            heading: `Ticket ${enquiry.ticketNumber}`,
            intro: `Hello ${esc(enquiry.name)}, we have your ${esc(kind.toLowerCase())}. ${esc(reply)}`,
            body: `<p style="margin:0 0 16px">${detailsHtml}</p>${messageHtml}`,
          }),
          replyTo: store.email || undefined,
        }),
      );
    }

    if (store.orderEmail) {
      const from = [enquiry.name, enquiry.phone, enquiry.email].filter(Boolean).join(', ');
      sends.push(
        ctx.mailer.send({
          to: store.orderEmail,
          subject: `${kind} ${enquiry.ticketNumber} from ${enquiry.name}`,
          text: [`${kind} from ${from}`, '', detailsText, '', enquiry.message, '', `Open in admin: ${ctx.config.publicUrl}/admin/enquiries`].join('\n'),
          html: page(store, {
            heading: `${kind} ${enquiry.ticketNumber}`,
            intro: esc(from),
            body: `<p style="margin:0 0 16px">${detailsHtml}</p>${messageHtml}${button(`${ctx.config.publicUrl}/admin/enquiries`, 'Open in admin')}`,
          }),
          replyTo: enquiry.email || undefined,
        }),
      );
    }
    return Promise.all(sends);
  });
}
