import { Router } from 'express';
import { normalizePhone } from '../../lib/india.js';
import { jsonArray } from '../../lib/mappers.js';
import { formatINR } from '../../lib/money.js';

// GET /followups (mounted at /api/admin, admin only): everyone worth a WhatsApp message today,
// computed live from the queues, most urgent first, each with the message already written.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Lower comes first. Money waiting to be checked, then promises with a clock on them, then nice-to-haves. */
export const FOLLOW_UP_PRIORITY = {
  upi_verify: 1,
  cod_confirm: 2,
  new_enquiry: 3,
  quote_expiring: 4,
  abandoned_checkout: 5,
  back_in_stock: 6,
  fitment_answered: 7,
  saved_kit: 8,
  review_request: 9,
};

const FIT_ANSWERS = {
  direct: 'Yes, it fits your car directly.',
  with_work: 'Yes, it fits your car with some work.',
  no: 'No, it does not fit your car.',
};

function isoAt(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function shift(iso, ms) {
  return isoAt(Date.parse(iso) + ms);
}

/** 91XXXXXXXXXX for a usable Indian mobile number, else ''. */
export function waNumber(phone) {
  const digits = normalizePhone(phone ?? '');
  return digits ? `91${digits}` : '';
}

export function waLink(phone, message) {
  const number = waNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : '';
}

export function firstName(name) {
  return String(name ?? '').trim().split(/\s+/)[0] ?? '';
}

function greeting(name) {
  const first = firstName(name);
  return first ? `Hi ${first},` : 'Hi,';
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** '5 December 2026' for an ISO date or timestamp (India time), or '' when it does not parse. */
function longDate(value) {
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+05:30` : value);
  return Number.isNaN(ms) ? '' : dateFormat.format(ms);
}

function shortDateTime(iso) {
  return dateTimeFormat.format(Date.parse(iso)).replace(/\b(am|pm)\b/i, (m) => m.toLowerCase());
}

/** '3 hours ago', '2 days ago' from ISO timestamps. */
function ago(iso, nowIso) {
  const ms = Math.max(0, Date.parse(nowIso) - Date.parse(iso));
  if (ms < HOUR) {
    const minutes = Math.max(1, Math.floor(ms / MINUTE));
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(ms / DAY);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function itemLabel(item) {
  return `${item.qty} x ${item.name}${item.variantName ? ` (${item.variantName})` : ''}`;
}

/** The storefront's shared-cart link: /cart?c=<productId>[v<variantId>]x<qty>[-<custom as base64url JSON>] joined by dots. */
export function cartLink(publicUrl, lines) {
  const chunks = [];
  for (const line of lines) {
    const productId = Number(line?.productId);
    const qty = Number(line?.qty);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(qty) || qty <= 0) continue;
    const variantId = Number(line.variantId);
    let chunk = `${productId}${Number.isInteger(variantId) && variantId > 0 ? `v${variantId}` : ''}x${qty}`;
    const custom = line.custom && typeof line.custom === 'object' && !Array.isArray(line.custom) ? line.custom : null;
    if (custom && Object.keys(custom).length > 0) chunk += `-${Buffer.from(JSON.stringify(custom)).toString('base64url')}`;
    chunks.push(chunk);
  }
  return chunks.length > 0 ? `${publicUrl}/cart?c=${chunks.join('.')}` : `${publicUrl}/cart`;
}

function makeFollowUp({ type, sourceId, name, phone, title, detail, message, href, createdAt, sortKey }) {
  return {
    item: {
      id: `${type}:${sourceId}`,
      type,
      title,
      detail,
      name: name ?? '',
      phone: phone ?? '',
      message,
      waLink: waLink(phone, message),
      href,
      createdAt,
    },
    sortKey,
  };
}

/** Every follow-up worth doing now, most urgent first. */
export function computeFollowUps(ctx) {
  const { db } = ctx;
  const now = ctx.now();
  const nowMs = Date.parse(now);
  const today = new Date(nowMs + 330 * MINUTE).toISOString().slice(0, 10);
  const settings = ctx.settings.get();
  const store = settings.storeName;
  const site = ctx.config.publicUrl;
  // Fitting studio and EMI lines appear only while the owner has them switched on in settings.
  const studioOpen = Boolean(settings.studio?.enabled);
  const emi = settings.emi?.enabled && String(settings.emi.partner ?? '').trim() ? settings.emi : null;
  const out = [];

  // Abandoned checkouts: an open lead last touched 30 minutes to 7 days ago, with no order from that phone since.
  const leads = db.all(
    `SELECT l.* FROM checkout_leads l
     WHERE l.status = 'open' AND l.updated_at <= :recent AND l.updated_at >= :stale
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.phone = l.phone AND o.created_at >= l.created_at)`,
    { recent: shift(now, -30 * MINUTE), stale: shift(now, -7 * DAY) },
  );
  for (const lead of leads) {
    const lines = jsonArray(lead.cart).filter((line) => line && typeof line === 'object' && line.name);
    const link = cartLink(site, lines);
    const summary = lines.map(itemLabel);
    const count = lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
    const message = [
      greeting(lead.name),
      summary.length > 0
        ? `This is ${store}. You left ${count === 1 ? 'a part' : 'some parts'} in your cart:`
        : `This is ${store}. You stopped at checkout before placing the order.`,
      ...summary,
      lead.cart_total > 0 ? `Cart total at the time: ${formatINR(lead.cart_total)}` : null,
      '',
      `Your cart is here when you are ready: ${link}`,
      'If something stopped you, reply here and we will help.',
    ]
      .filter((line) => line !== null)
      .join('\n');
    out.push(
      makeFollowUp({
        type: 'abandoned_checkout',
        sourceId: lead.id,
        name: lead.name,
        phone: lead.phone,
        title: `Abandoned checkout${lead.cart_total > 0 ? `, ${formatINR(lead.cart_total)}` : ''}`,
        detail: `${summary.join(', ') || 'Cart details not saved'}. Left ${ago(lead.updated_at, now)}.`,
        message,
        href: '/admin/leads',
        createdAt: lead.created_at,
        // Fresh leads convert best: newest first.
        sortKey: -Date.parse(lead.updated_at),
      }),
    );
  }

  // COD orders placed but not yet confirmed, and UPI payments waiting for a check against the bank.
  const orders = db.all(
    `SELECT o.id, o.order_number, o.customer_name, o.phone, o.total, o.payment_method, o.upi_reference, o.created_at, o.fulfilment,
            (o.payment_method = 'cod' AND o.status = 'placed') AS needs_cod_confirm,
            (o.upi_reference <> '' AND o.payment_status = 'pending' AND o.status NOT IN ('cancelled', 'returned')) AS needs_upi_check
     FROM orders o
     WHERE (o.payment_method = 'cod' AND o.status = 'placed')
        OR (o.upi_reference <> '' AND o.payment_status = 'pending' AND o.status NOT IN ('cancelled', 'returned'))
     ORDER BY o.created_at`,
  );
  const itemsByOrder = new Map();
  if (orders.length > 0) {
    const items = db.all(
      `SELECT order_id, name, variant_name, qty FROM order_items
       WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY order_id, id`,
      [orders.map((order) => order.id)],
    );
    for (const item of items) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(itemLabel({ qty: item.qty, name: item.name, variantName: item.variant_name }));
      itemsByOrder.set(item.order_id, list);
    }
  }
  for (const order of orders) {
    const items = itemsByOrder.get(order.id) ?? [];
    const href = `/admin/orders/${order.order_number}`;
    if (order.needs_upi_check) {
      out.push(
        makeFollowUp({
          type: 'upi_verify',
          sourceId: order.id,
          name: order.customer_name,
          phone: order.phone,
          title: `Check UPI payment of ${formatINR(order.total)}`,
          detail: `Order ${order.order_number}, UTR ${order.upi_reference}. Match it in the bank app, then mark it paid.`,
          message: [
            greeting(order.customer_name),
            `This is ${store}. Thank you for paying for order ${order.order_number} by UPI (reference ${order.upi_reference}).`,
            'We are matching it with our bank statement and will confirm here once it shows.',
          ].join('\n'),
          href,
          createdAt: order.created_at,
          sortKey: Date.parse(order.created_at),
        }),
      );
    }
    if (order.needs_cod_confirm) {
      out.push(
        makeFollowUp({
          type: 'cod_confirm',
          sourceId: order.id,
          name: order.customer_name,
          phone: order.phone,
          title: `Confirm COD order of ${formatINR(order.total)}`,
          detail: `Order ${order.order_number}: ${items.join(', ')}. Placed ${ago(order.created_at, now)}.`,
          message: [
            greeting(order.customer_name),
            `This is ${store}. Thank you for your order ${order.order_number}:`,
            ...items,
            order.fulfilment === 'delivery' || !order.fulfilment
              ? `Total ${formatINR(order.total)}, cash on delivery.`
              : `Total ${formatINR(order.total)}, to pay at the studio.`,
            '',
            order.fulfilment === 'studio'
              ? 'Please reply YES to confirm it and we will keep the parts ready for your fitting slot.'
              : order.fulfilment === 'pickup'
                ? 'Please reply YES to confirm it and we will keep it ready for you to collect.'
                : 'Please reply YES to confirm it and we will pack it.',
          ].join('\n'),
          href,
          createdAt: order.created_at,
          sortKey: Date.parse(order.created_at),
        }),
      );
    }
  }

  // Questions answered in the last 3 days whose asker left a phone.
  const answered = db.all(
    `SELECT q.id, q.kind, q.author_name, q.phone, q.vehicle_label, q.answer, q.answer_fit_type, q.answered_at, q.created_at,
            p.name AS product_name, p.slug AS product_slug
     FROM product_questions q
     JOIN products p ON p.id = q.product_id
     WHERE q.answered_at IS NOT NULL AND q.answered_at >= :since AND q.answered_at <= :now
       AND q.status <> 'rejected' AND TRIM(q.phone) <> ''`,
    { since: shift(now, -3 * DAY), now },
  );
  for (const question of answered) {
    const isFit = question.kind === 'fitment';
    const car = question.vehicle_label.trim();
    const verdict = isFit ? FIT_ANSWERS[question.answer_fit_type] : null;
    const answer = (question.answer ?? '').trim();
    const message = [
      greeting(question.author_name),
      isFit
        ? `This is ${store}. You asked whether the ${question.product_name} fits your ${car || 'car'}.`
        : `This is ${store}. You asked us about the ${question.product_name}.`,
      verdict,
      answer ? (verdict ? `Note: ${answer}` : answer) : null,
      '',
      `${site}/p/${question.product_slug}`,
    ]
      .filter((line) => line !== null)
      .join('\n');
    out.push(
      makeFollowUp({
        type: 'fitment_answered',
        sourceId: question.id,
        name: question.author_name,
        phone: question.phone,
        title: isFit ? `Send the fit answer${car ? ` for ${car}` : ''}` : 'Send the answer to a question',
        detail: `${question.product_name}. Answered ${ago(question.answered_at, now)}.`,
        message,
        href: '/admin/fitment-desk',
        createdAt: question.created_at,
        sortKey: Date.parse(question.answered_at),
      }),
    );
  }

  // Stock alerts that can be answered now: the product (or the named variant) is back in stock.
  const alerts = db.all(
    `SELECT a.id, a.phone, a.email, a.created_at, p.name AS product_name, p.slug AS product_slug,
            v.name AS variant_name, COALESCE(v.stock, p.stock) AS stock
     FROM stock_alerts a
     JOIN products p ON p.id = a.product_id
     LEFT JOIN product_variants v ON v.id = a.variant_id AND v.product_id = a.product_id
     WHERE a.status = 'waiting' AND p.is_active = 1
       AND (a.variant_id IS NULL OR (v.id IS NOT NULL AND v.is_active = 1))
       AND COALESCE(v.stock, p.stock) > 0`,
  );
  for (const alert of alerts) {
    const product = `${alert.product_name}${alert.variant_name ? ` (${alert.variant_name})` : ''}`;
    out.push(
      makeFollowUp({
        type: 'back_in_stock',
        sourceId: alert.id,
        name: '',
        phone: alert.phone,
        title: 'Back in stock',
        detail: `${product}: ${alert.stock} in stock. Asked ${ago(alert.created_at, now)}${alert.phone ? '' : `, email only (${alert.email})`}.`,
        message: [
          'Hi,',
          `This is ${store}. You asked us to tell you when the ${product} was back. It is in stock again:`,
          `${site}/p/${alert.product_slug}`,
        ].join('\n'),
        href: '/admin/stock-alerts',
        createdAt: alert.created_at,
        sortKey: Date.parse(alert.created_at),
      }),
    );
  }

  // Delivered 3 to 14 days ago and no fitted report filed against the order yet.
  const delivered = db.all(
    `SELECT * FROM (
       SELECT o.id, o.order_number, o.customer_name, o.phone, o.created_at, o.fulfilment,
              COALESCE((SELECT MAX(e.created_at) FROM order_events e WHERE e.order_id = o.id AND e.status = 'delivered'), o.updated_at) AS delivered_at,
              (SELECT p.slug FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id ORDER BY oi.id LIMIT 1) AS slug,
              (SELECT p.name FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id ORDER BY oi.id LIMIT 1) AS product_name
       FROM orders o
       WHERE o.status = 'delivered'
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_number = o.order_number)
     ) d
     WHERE d.delivered_at <= :newest AND d.delivered_at >= :oldest AND d.slug IS NOT NULL`,
    { newest: shift(now, -3 * DAY), oldest: shift(now, -14 * DAY) },
  );
  for (const order of delivered) {
    const link = `${site}/p/${order.slug}?report=${encodeURIComponent(order.order_number)}#fitted-reports`;
    const atStudio = order.fulfilment === 'studio';
    out.push(
      makeFollowUp({
        type: 'review_request',
        sourceId: order.id,
        name: order.customer_name,
        phone: order.phone,
        title: 'Ask for a fitted report',
        detail: `Order ${order.order_number}, ${order.product_name}. ${atStudio ? 'Fitted at the studio' : 'Delivered'} ${ago(order.delivered_at, now)}.`,
        message: [
          greeting(order.customer_name),
          atStudio
            ? `This is ${store}. Thank you for having the ${order.product_name} fitted at our studio (order ${order.order_number}).`
            : `This is ${store}. Your order ${order.order_number} was delivered a few days ago.`,
          atStudio
            ? 'Now that you have driven with it for a few days, could you tell other buyers how it went? It takes about a minute:'
            : `Once the ${order.product_name} is fitted, could you tell other buyers how it went? It takes about a minute:`,
          link,
          'If anything is not right with the part, reply here and we will sort it out.',
        ].join('\n'),
        href: `/admin/orders/${order.order_number}`,
        createdAt: order.delivered_at,
        sortKey: Date.parse(order.delivered_at),
      }),
    );
  }

  // Saved kits still open. A delivery date close at hand comes first.
  const kits = db.all("SELECT * FROM saved_kits WHERE status = 'open'");
  for (const kit of kits) {
    const parts = jsonArray(kit.product_ids).length;
    const delivery = kit.delivery_date ? longDate(kit.delivery_date) : '';
    const deliveryPassed = delivery !== '' && kit.delivery_date.slice(0, 10) < today;
    const car = kit.vehicle_label.trim();
    let deliveryLine = 'Would you like us to keep these parts ready for you?';
    if (delivery && deliveryPassed) deliveryLine = `You mentioned the car was due on ${delivery}. Would you like us to send the parts now?`;
    else if (delivery) deliveryLine = `You mentioned the car arrives on ${delivery}. Would you like us to have the parts ready for then?`;
    const message = [
      greeting(kit.name),
      `This is ${store}. You saved a kit of ${parts} part${parts === 1 ? '' : 's'}${car ? ` for your ${car}` : ''}${kit.total > 0 ? `, ${formatINR(kit.total)}` : ''}.`,
      deliveryLine,
      studioOpen ? 'We can also fit them at our studio in a slot you book.' : null,
      emi && kit.total >= emi.minAmount ? `EMI is available through ${emi.partner}.` : null,
      'Reply here with any questions about fit or fitting.',
    ]
      .filter((line) => line !== null)
      .join('\n');
    const deliveryMs = kit.delivery_date ? Date.parse(kit.delivery_date) : Number.NaN;
    out.push(
      makeFollowUp({
        type: 'saved_kit',
        sourceId: kit.id,
        name: kit.name,
        phone: kit.phone,
        title: `Saved kit${car ? ` for ${car}` : ''}`,
        detail: `${parts} part${parts === 1 ? '' : 's'}${kit.total > 0 ? `, ${formatINR(kit.total)}` : ''}${delivery ? `. Car due ${delivery}` : ''}. Saved ${ago(kit.created_at, now)}.`,
        message,
        href: '/admin/leads',
        createdAt: kit.created_at,
        sortKey: Number.isNaN(deliveryMs) ? Number.MAX_SAFE_INTEGER - (nowMs - Date.parse(kit.created_at)) : deliveryMs,
      }),
    );
  }

  // Open quotes that run out within 48 hours.
  const quotes = db.all(
    "SELECT * FROM quotes WHERE status = 'open' AND valid_until > :now AND valid_until <= :soon ORDER BY valid_until",
    { now, soon: shift(now, 48 * HOUR) },
  );
  for (const quote of quotes) {
    const total = jsonArray(quote.items).reduce(
      (sum, item) => sum + (Number(item?.unitPrice) || 0) * (Number(item?.qty) || 0),
      0,
    );
    const until = shortDateTime(quote.valid_until);
    out.push(
      makeFollowUp({
        type: 'quote_expiring',
        sourceId: quote.id,
        name: quote.customer_name,
        phone: quote.phone,
        title: `Quote ends ${until}`,
        detail: `${total > 0 ? `Items ${formatINR(total)}. ` : ''}Sent ${ago(quote.created_at, now)}.`,
        message: [
          greeting(quote.customer_name),
          `This is ${store}. A reminder that the price we quoted you holds until ${until}.`,
          `You can check it and pay here: ${site}/quote/${quote.token}`,
        ].join('\n'),
        href: `/admin/quotes/${quote.id}`,
        createdAt: quote.created_at,
        sortKey: Date.parse(quote.valid_until),
      }),
    );
  }

  // New enquiries older than 2 hours: every message gets an acknowledgement within 48 hours.
  const enquiries = db.all("SELECT * FROM enquiries WHERE status = 'new' AND created_at <= :cutoff ORDER BY created_at", {
    cutoff: shift(now, -2 * HOUR),
  });
  for (const enquiry of enquiries) {
    const dueMs = Date.parse(enquiry.created_at) + 48 * HOUR;
    const left = dueMs - nowMs;
    const due = left <= 0 ? 'Past the 48-hour acknowledgement' : `Acknowledge within ${Math.max(1, Math.ceil(left / HOUR))} hours`;
    const about = enquiry.subject.trim();
    out.push(
      makeFollowUp({
        type: 'new_enquiry',
        sourceId: enquiry.id,
        name: enquiry.name,
        phone: enquiry.phone,
        title: `Reply to ${enquiry.ticket_number}`,
        detail: `${about || enquiry.kind}. Received ${ago(enquiry.created_at, now)}. ${due}.`,
        message: [
          greeting(enquiry.name),
          `This is ${store}. We have your message${about ? ` about "${about}"` : ''}, ticket ${enquiry.ticket_number}.`,
          'We are looking into it and will come back to you here.',
        ].join('\n'),
        href: '/admin/enquiries',
        createdAt: enquiry.created_at,
        sortKey: Date.parse(enquiry.created_at),
      }),
    );
  }

  out.sort(
    (a, b) =>
      FOLLOW_UP_PRIORITY[a.item.type] - FOLLOW_UP_PRIORITY[b.item.type] ||
      a.sortKey - b.sortKey ||
      a.item.id.localeCompare(b.item.id),
  );
  return out.map((entry) => entry.item);
}

export function countFollowUps(ctx) {
  return computeFollowUps(ctx).length;
}

export default function adminFollowupsRoutes(ctx) {
  const router = Router();
  router.get('/followups', (req, res) => {
    res.json(computeFollowUps(ctx));
  });
  return router;
}
