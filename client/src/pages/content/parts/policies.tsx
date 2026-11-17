import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatINR } from '@/lib/format';
import { waLink } from '@/lib/whatsapp';
import type { PublicSettings } from '@/types/api';
import { studioAddress, studioOpen } from '@/components/layout/storeContact';
import { Bullets, Facts } from './Reading';
import {
  addressLines,
  businessName,
  clean,
  codSentence,
  deliveryFeeSentence,
  listJoin,
  paymentMethods,
  surchargeSentence,
  workingDays,
} from './storeFacts';

export type PolicySlug = 'shipping' | 'returns' | 'warranty' | 'privacy' | 'terms';

export const POLICY_LINKS: readonly { slug: PolicySlug; label: string }[] = [
  { slug: 'shipping', label: 'Shipping and delivery' },
  { slug: 'returns', label: 'Returns, refunds and cancellations' },
  { slug: 'warranty', label: 'Warranty' },
  { slug: 'privacy', label: 'Privacy' },
  { slug: 'terms', label: 'Terms of sale' },
];

export function isPolicySlug(value: string | undefined): value is PolicySlug {
  return POLICY_LINKS.some((policy) => policy.slug === value);
}

export interface PolicySection {
  id: string;
  title: string;
  body: ReactNode;
}

export interface Policy {
  title: string;
  /** One or two sentences under the title, and the page's meta description. */
  summary: string;
  sections: PolicySection[];
}

function L({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="link font-bold">
      {children}
    </Link>
  );
}

/** "the return request form" link, plus WhatsApp when the store has a number. */
function returnRoute(s: PublicSettings): ReactNode {
  const wa = waLink(s.whatsapp);
  return (
    <>
      Use the <L to="/contact?kind=return">return request form</L> with your order number
      {wa ? (
        <>
          , or{' '}
          <a href={wa} target="_blank" rel="noopener noreferrer" className="link font-bold">
            message us on WhatsApp
          </a>
        </>
      ) : null}
      .
    </>
  );
}

/* ------------------------------------------------------------------ shipping */

function shipping(s: PublicSettings): Policy {
  const dispatch = s.shipping.dispatchDays;
  const knowsOrigin = clean(s.shipping.originPincode) !== '';
  const surcharge = surchargeSentence(s);
  const cod = codSentence(s);

  const times = knowsOrigin
    ? [
        { term: 'Within our State', value: '1 to 3 working days' },
        { term: 'Same region of India', value: '3 to 5 working days' },
        { term: 'Rest of India', value: '4 to 7 working days' },
        { term: 'North-East, Jammu and Kashmir, Ladakh, the islands', value: '6 to 10 working days. Cash on delivery does not reach these areas.' },
      ]
    : [
        { term: 'Most of India', value: '3 to 7 working days' },
        { term: 'North-East, Jammu and Kashmir, Ladakh, the islands', value: '6 to 10 working days. Cash on delivery does not reach these areas.' },
      ];

  return {
    title: 'Shipping and delivery',
    summary: studioOpen(s)
      ? 'Where we deliver, when orders leave us, how long they take, what delivery costs, and collecting or fitting at our studio.'
      : 'Where we deliver, when orders leave us, how long they take and what delivery costs.',
    sections: [
      {
        id: 'where',
        title: 'Where we deliver',
        body: (
          <p>
            We deliver to PIN codes across India through courier partners. Enter your PIN code on a product page or in the cart to see the delivery
            dates for your address and whether cash on delivery reaches it.
          </p>
        ),
      },
      ...(studioOpen(s)
        ? [
            {
              id: 'studio',
              title: 'Collect or have it fitted at the studio',
              body: (
                <>
                  <p>
                    At checkout you can choose to collect your order from our studio, or to have parts fitted there in a slot you book. Orders
                    collected or fitted at the studio have no delivery charge{s.cod.enabled ? ', and you can pay at the studio' : ''}. Made-to-order
                    parts are still paid online.
                  </p>
                  {(studioAddress(s) || clean(s.businessHours)) && (
                    <p className="whitespace-pre-line">
                      {studioAddress(s) ? `The studio: ${studioAddress(s)}` : ''}
                      {studioAddress(s) && clean(s.businessHours) ? '\n' : ''}
                      {clean(s.businessHours) ? `Open ${clean(s.businessHours)}.` : ''}
                    </p>
                  )}
                  <p>
                    Fitting charges and slot rules are on <L to="/faq#studio">Questions and answers</L>.
                  </p>
                </>
              ),
            },
          ]
        : []),
      {
        id: 'dispatch',
        title: 'When your order leaves us',
        body: (
          <>
            <p>
              {dispatch > 0
                ? `Orders leave us within ${workingDays(dispatch)} of being confirmed.`
                : 'Orders leave us on the day they are confirmed, or the next working day.'}{' '}
              A prepaid order is confirmed when the payment reaches us. A cash on delivery order is confirmed when we have checked it with you.
              Working days are Monday to Saturday.
            </p>
            <p>Made-to-order items, such as show plates, are made after you order and leave later than parts we hold in stock.</p>
          </>
        ),
      },
      {
        id: 'times',
        title: 'How long delivery takes',
        body: (
          <>
            <p>After dispatch, the courier usually takes:</p>
            <Facts rows={times} />
            <p>
              The dates shown at checkout already include the time to dispatch. They are estimates, not courier promises. If a parcel arrives later
              than the latest date we gave you, you may return it for a full refund.
            </p>
          </>
        ),
      },
      {
        id: 'fees',
        title: 'Delivery charges',
        body: (
          <>
            <p>{deliveryFeeSentence(s)}</p>
            {surcharge && <p>{surcharge}</p>}
            {cod && <p>{cod}</p>}
            <p>Every charge appears in the cart as its own line, in rupees, before you pay. There is nothing added at the door.</p>
          </>
        ),
      },
      {
        id: 'large-items',
        title: 'Bulky and freight items',
        body: (
          <Bullets>
            <li>The product page says when a part is bulky or travels by freight.</li>
            <li>Freight items have to be paid for online. Cash on delivery is not offered for them.</li>
            <li>Large parcels can take longer than the estimate for small ones. Make sure someone can receive them at the address.</li>
          </Bullets>
        ),
      },
      {
        id: 'tracking',
        title: 'Tracking and damaged parcels',
        body: (
          <>
            <p>
              Once your order ships, the order page shows the courier and the tracking number. You can also look it up on <L to="/track">Track an order</L>{' '}
              with the order number and your mobile number.
            </p>
            <p>
              If the box arrives damaged or opened, photograph it before and after opening and tell us with the order number. A part damaged in
              transit is replaced or refunded in full.
            </p>
          </>
        ),
      },
    ],
  };
}

/* ------------------------------------------------------------------ returns */

function returns(s: PublicSettings): Policy {
  const windowDays = s.returns.windowDays;
  const sections: PolicySection[] = [
    {
      id: 'window',
      title: 'The return window',
      body: (
        <>
          <p>
            {windowDays > 0
              ? `You have ${windowDays} days from delivery to ask for a return.`
              : 'We take back parts that arrive faulty, damaged or different from what you ordered.'}
          </p>
          {clean(s.returns.summary) && <p>{s.returns.summary}</p>}
        </>
      ),
    },
  ];

  if (s.fitPromise.enabled) {
    sections.push({
      id: 'fit-promise',
      title: 'The Fit Promise',
      body: (
        <>
          <p>{clean(s.fitPromise.summary) || 'When we mark a part as a verified fit for your car and it does not fit, we take it back.'}</p>
          <p>
            It covers parts marked as a shop-verified fit for the car you chose on the site. Universal parts, parts marked Fits with work, and
            parts bought for a car other than the one selected are covered by the normal return rules.
          </p>
        </>
      ),
    });
  }

  sections.push(
    {
      id: 'faulty',
      title: 'Faulty, damaged or wrong items',
      body: (
        <p>
          Whatever the window, we take back and refund a part that is faulty, damaged in transit, different from its description, or delivered
          later than the latest date we gave you. We pay for sending it back.
        </p>
      ),
    },
    {
      id: 'exclusions',
      title: 'What cannot be returned',
      body: (
        <>
          <p>Unless they are faulty, damaged or not what you ordered:</p>
          <Bullets>
            <li>Made-to-order items such as show plates.</li>
            <li>Parts that have been fitted, cut, drilled or wired in, including parts fitted at our studio.</li>
            <li>Products whose page says they cannot be returned.</li>
          </Bullets>
        </>
      ),
    },
    {
      id: 'how',
      title: 'How to raise a return',
      body: (
        <ol className="grid list-decimal gap-2 pl-5 marker:font-bold">
          <li>{returnRoute(s)} You get a ticket number straight away.</li>
          <li>We reply with how to send the part back. Please wait for this before posting anything.</li>
          <li>Pack the part with everything that came in the box, in its original packing if you still have it.</li>
          <li>Once the part reaches us and is checked, we start the refund.</li>
        </ol>
      ),
    },
    {
      id: 'refunds',
      title: 'Refunds',
      body: (
        <>
          <Bullets>
            <li>Online payments are refunded to the way you paid: the same card, UPI account or bank.</li>
            <li>For cash on delivery orders we ask for a bank account or UPI ID to send the refund to.</li>
            <li>
              When the return is our fault, we refund everything you paid, including delivery
              {s.cod.enabled && s.cod.fee > 0 ? ` and the ${formatINR(s.cod.fee)} cash on delivery fee` : ''}.
            </li>
            <li>For any other return we refund the price of the part. We tell you the cost of return shipping before you send it.</li>
          </Bullets>
          <p>Card refunds usually take 5 to 7 working days to show, depending on your bank. UPI refunds are usually quicker.</p>
        </>
      ),
    },
    {
      id: 'cancel',
      title: 'Cancelling an order',
      body: (
        <p>
          You can cancel an order from its order page until it is packed. There is no cancellation charge, and anything paid online is refunded in
          full to the way you paid. Once it is packed, wait for delivery and return it instead.
        </p>
      ),
    },
  );

  return {
    title: 'Returns, refunds and cancellations',
    summary: windowDays > 0 ? `${windowDays} days from delivery to ask for a return, refunds to the way you paid, and how to cancel.` : 'When we take parts back, how refunds work, and how to cancel.',
    sections,
  };
}

/* ------------------------------------------------------------------ warranty */

function warranty(): Policy {
  return {
    title: 'Warranty',
    summary: 'What the warranty on a part covers, what it does not, and how to claim.',
    sections: [
      {
        id: 'cover',
        title: 'What it covers',
        body: (
          <>
            <p>
              When a product page lists a warranty period, the part is covered for that long from the date of delivery against faults in how it was
              made. A product that lists no warranty is still covered by the returns policy if it arrives faulty.
            </p>
            <p>Under warranty we repair or replace the part, or refund it if neither is possible.</p>
          </>
        ),
      },
      {
        id: 'not-covered',
        title: 'What it does not cover',
        body: (
          <Bullets>
            <li>Normal wear, such as faded fabric or worn rubber.</li>
            <li>Damage from an accident, misuse, or use beyond what the part is made for.</li>
            <li>Faults caused by fitting that ignored the fitting card or the advice on the Straight Label, such as spliced wiring done without a fitter.</li>
            <li>Parts that have been modified after delivery.</li>
          </Bullets>
        ),
      },
      {
        id: 'claim',
        title: 'How to claim',
        body: (
          <p>
            Write to us through the <L to="/contact?kind=complaint">contact form</L> with the order number, what has gone wrong, and photos or a short
            video of the fault. We reply with the next step under the same ticket number.
          </p>
        ),
      },
      {
        id: 'invoice',
        title: 'Keep the invoice',
        body: <p>Every order has a tax invoice you can open and print from the order page. It is your proof of purchase for a claim.</p>,
      },
      {
        id: 'car-warranty',
        title: 'Your car’s own warranty',
        body: (
          <p>
            The car maker’s warranty is separate from ours. Fitting an accessory does not cancel it, but a dealer can refuse to pay for a fault the
            accessory caused. Each product’s <L to="/straight-label">Straight Label</L> says whether it may affect the car’s warranty, and why.
          </p>
        ),
      },
    ],
  };
}

/* ------------------------------------------------------------------ privacy */

function privacy(s: PublicSettings): Policy {
  const name = businessName(s);
  const address = addressLines(s);
  const dataEmail = clean(s.grievanceOfficer.email) || clean(s.email);

  return {
    title: 'Privacy',
    summary: 'What we collect when you use this site, why, who sees it, and how to ask for it to be corrected or deleted.',
    sections: [
      {
        id: 'who',
        title: 'Who we are',
        body: (
          <p>
            This site is run by {name}
            {address.length > 0 ? `, ${address.join(', ')}` : ''}. We decide what personal data is collected here and why. This notice is separate from
            our terms of sale.
          </p>
        ),
      },
      {
        id: 'collect',
        title: 'What we collect and why',
        body: (
          <Facts
            rows={[
              { term: 'Name, mobile number, email', value: 'To take and deliver your order, send order updates and answer your messages.' },
              { term: 'Delivery and billing address', value: 'To deliver the order and print the tax invoice.' },
              { term: 'GSTIN, if you give one', value: 'To print it on a business invoice.' },
              { term: 'Orders', value: 'For invoices, returns, warranty claims and the tax records the law requires.' },
              {
                term: 'Payment references',
                value: 'To match a payment to its order. Card numbers and UPI PINs go to Razorpay or your UPI app. We never see them.',
              },
              { term: 'Your cars', value: 'To show whether parts fit. Kept on your device, and on your account if you sign in.' },
              { term: 'Account password', value: 'To sign you in. It is stored only in scrambled (hashed) form that cannot be read back.' },
              { term: 'Reports, questions and photos you post', value: 'To show them on the product page under the name you give.' },
              { term: 'Messages to us', value: 'To answer them, and to keep a record if a complaint follows.' },
              { term: 'IP address and browser', value: 'To keep the site secure and limit abuse, such as repeated failed sign-ins.' },
            ]}
          />
        ),
      },
      {
        id: 'cookies',
        title: 'Cookies and storage on your device',
        body: (
          <>
            <p>
              We set one cookie, <span className="type-code">addon_session</span>, when you sign in. It keeps you signed in and is needed for the
              account to work.
            </p>
            <p>
              Your cart, saved parts, cars, compare list, recently viewed parts, theme and the checkout details you typed are kept in your browser’s
              storage on this device. The cart is sent to us to work out prices; saved parts and cars are copied to your account only when you sign
              in.
            </p>
            <p>
              We do not use advertising or analytics cookies. The Razorpay payment window, when you use it, sets its own cookies under Razorpay’s
              policy.
            </p>
          </>
        ),
      },
      {
        id: 'sharing',
        title: 'Who we share it with',
        body: (
          <>
            <Bullets>
              <li>The courier: your name, mobile number and delivery address.</li>
              <li>Razorpay, when you pay through it: the amount and your contact details.</li>
              <li>The service that sends our emails: your email address and the message.</li>
              <li>WhatsApp, only when you choose to message us there, under WhatsApp’s own terms.</li>
              <li>Government authorities, when the law requires it.</li>
            </Bullets>
            <p>We do not sell your data or share it for advertising.</p>
          </>
        ),
      },
      {
        id: 'retention',
        title: 'How long we keep it',
        body: (
          <Bullets>
            <li>Orders and invoices: for as long as tax law requires, currently about six years.</li>
            <li>Your account: until you ask us to delete it.</li>
            <li>Messages and complaints: until resolved, and after that only as long as we may need them to answer a later dispute.</li>
            <li>Data on your device: until you clear it from your browser.</li>
          </Bullets>
        ),
      },
      {
        id: 'rights',
        title: 'Your rights',
        body: (
          <>
            <p>
              You can ask to see the personal data we hold about you, have it corrected, have it deleted, or name someone to act
              for you. Write from the mobile number or email on your account so we know it is you.
            </p>
            <p>
              You can change your profile and addresses yourself in <L to="/account">your account</L>. When you ask for deletion, we delete what we
              are not required to keep; invoices stay for the period tax law sets. We answer every request, and settle it within 90 days at most.
            </p>
          </>
        ),
      },
      {
        id: 'children',
        title: 'Children',
        body: <p>This shop is for adults. Do not create an account or place an order if you are under 18.</p>,
      },
      {
        id: 'data-contact',
        title: 'Questions about your data',
        body: (
          <p>
            {dataEmail ? (
              <>
                Write to{' '}
                <a href={`mailto:${dataEmail}`} className="link font-bold break-all">
                  {dataEmail}
                </a>{' '}
                or use the <L to="/contact?kind=complaint">contact form</L>.
              </>
            ) : (
              <>
                Use the <L to="/contact?kind=complaint">contact form</L>.
              </>
            )}{' '}
            If you are not satisfied with our answer, you can complain to the Data Protection Board of India.
          </p>
        ),
      },
    ],
  };
}

/* ------------------------------------------------------------------ terms */

function terms(s: PublicSettings): Policy {
  const name = businessName(s);
  const methods = paymentMethods(s);
  const cod = codSentence(s);
  const city = clean(s.address.city);

  return {
    title: 'Terms of sale',
    summary: 'The terms for buying from this site: prices, payment, fit verdicts, fitting, off-road parts and show plates.',
    sections: [
      {
        id: 'about',
        title: 'About these terms',
        body: (
          <p>
            These terms cover buying from {name} through this site. Placing an order means you accept them. Our <L to="/policies/shipping">shipping</L>,{' '}
            <L to="/policies/returns">returns</L>, <L to="/policies/warranty">warranty</L> and <L to="/policies/privacy">privacy</L> policies are part of
            them.
          </p>
        ),
      },
      {
        id: 'prices',
        title: 'Prices and orders',
        body: (
          <Bullets>
            <li>Prices are in rupees and include GST. The MRP shown is the printed maximum retail price.</li>
            <li>The total, with every delivery and payment charge listed, is shown before you pay.</li>
            <li>An order is confirmed when we send you the order confirmation.</li>
            <li>
              If a price was shown wrongly or a part turns out to be out of stock, we tell you and refund anything paid, in full. We never ask you to
              pay more than the price you ordered at.
            </li>
            <li>A price sent to you by a quote link holds until the expiry shown on that link.</li>
          </Bullets>
        ),
      },
      {
        id: 'payment',
        title: 'Payment',
        body: (
          <>
            {methods.length > 0 && <p>You can pay by {listJoin(methods, 'or')}.</p>}
            {s.prepaidDiscountPercent > 0 && <p>Paying online in full takes {s.prepaidDiscountPercent}% off the price of the parts.</p>}
            {cod && <p>{cod}</p>}
            <p>Card and Razorpay payments are processed by Razorpay. We do not see or store card details.</p>
          </>
        ),
      },
      {
        id: 'fit',
        title: 'Fit verdicts and product information',
        body: (
          <Bullets>
            <li>Fit verdicts come from our fitment records for the car you chose. Not checked on your car yet is not a promise either way.</li>
            {s.fitPromise.enabled && (
              <li>
                A part marked as a shop-verified fit for your car is covered by the <L to="/policies/returns#fit-promise">Fit Promise</L>.
              </li>
            )}
            <li>Fitting times and labour charges on the Straight Label are a guide to what is fair, not a quote.</li>
            <li>Product photos may show the kind of part rather than the exact item. The name, specifications and box contents describe what you get.</li>
          </Bullets>
        ),
      },
      {
        id: 'fitting',
        title: 'Fitting and use',
        body: (
          <>
            {studioOpen(s) && (
              <p>
                Parts can be fitted by our own team at our studio, in a slot you book at checkout or on the <L to="/book-fitting">Book a fitting</L>{' '}
                page. The fitting charge for each part is shown in rupees, including GST, before you pay. Please bring the car at the start of your
                slot; if you cannot come, tell us and we move or cancel the booking.
              </p>
            )}
            <p>
              {studioOpen(s) ? 'Otherwise, fitting is done by you or the fitter you choose.' : 'Fitting is done by you or the fitter you choose.'}{' '}
              Follow the fitting card, and use a trained fitter where the Straight Label advises it. We are not responsible for damage caused by
              fitting that ignored that advice, or for fines that follow from using a part against the rules where you drive.
            </p>
          </>
        ),
      },
      {
        id: 'off-road',
        title: 'Parts marked Off-road only',
        body: (
          <>
            <p>
              For off-road, track or show use only. Not approved for use on public roads. Fitting such a product to a road vehicle may breach the
              Motor Vehicles Act, 1988 and your State’s rules, and may affect insurance and warranty. Check with your RTO before fitting.
            </p>
            <p>
              Parts marked Check the rules first are legal in some forms or some States only. Check what applies where you drive before fitting them.
            </p>
          </>
        ),
      },
      {
        id: 'show-plates',
        title: 'Show plates',
        body: (
          <>
            <p className="font-bold">Show plates are decorative. They are not vehicle registration plates.</p>
            <p>
              They are made for display in a garage, a room or a showroom, and at car shows or photo shoots on private premises. They are not High
              Security Registration Plates (HSRP) and must not be fitted to any vehicle used on a public road. Under Rule 50 of the Central Motor
              Vehicles Rules, 1989, a vehicle on the road must show its registration number only on an HSRP supplied through authorised channels.
            </p>
            <p>
              Before ordering, you confirm that you will not use a show plate in place of, over or beside the registration plate of a vehicle on a
              public road, and that any fine or legal action from misuse is your responsibility. Show plates are made to order, paid for online, and
              not returnable unless they arrive damaged, defective or different from the approved design.
            </p>
          </>
        ),
      },
      {
        id: 'posts',
        title: 'Reports, questions and builds you post',
        body: (
          <Bullets>
            <li>Post only what is true and your own. Fitted Reports are accepted only from people who bought the part from us.</li>
            <li>By posting photos you allow us to show them on this site.</li>
            <li>We may remove personal details, abuse or anything misleading, and we do not publish a post in return for payment or a discount.</li>
            <li>Content we added to show how a page works is marked Sample.</li>
          </Bullets>
        ),
      },
      {
        id: 'law',
        title: 'Law and disputes',
        body: (
          <p>
            These terms are governed by the laws of India{city ? `, and the courts at ${city} have jurisdiction` : ''}. Please raise any problem with us
            first, as set out below. Nothing in these terms takes away your rights under the Consumer Protection Act, 2019.
          </p>
        ),
      },
    ],
  };
}

export function buildPolicy(slug: PolicySlug, settings: PublicSettings): Policy {
  switch (slug) {
    case 'shipping':
      return shipping(settings);
    case 'returns':
      return returns(settings);
    case 'warranty':
      return warranty();
    case 'privacy':
      return privacy(settings);
    case 'terms':
      return terms(settings);
  }
}
