import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ErrorState, WhatsAppButton } from '@/components/commerce';
import { Accordion, AccordionItem, Button } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { useDocumentMeta } from '@/lib/seo';
import type { PublicSettings } from '@/types/api';
import { emiLabel, serviceCharge, slotSentences, storePhones, studioAddress, studioOpen } from '@/components/layout/storeContact';
import { formatINR, minutesLabel } from '@/lib/format';
import { Facts, ReadingPage, ReadingSkeleton, type TocItem } from './parts/Reading';
import { codSentence, deliveryFeeSentence, listJoin, paymentMethods, surchargeSentence, workingDays } from './parts/storeFacts';

interface Question {
  id: string;
  q: string;
  a: ReactNode;
}

interface Group {
  id: string;
  title: string;
  questions: Question[];
}

function A({ children }: { children: ReactNode }) {
  return <div className="type-body grid max-w-prose gap-3">{children}</div>;
}

/** Studio fitting, slots and collection. Left out while the studio is paused. */
function buildStudioGroup(s: PublicSettings): Group | null {
  if (!studioOpen(s)) return null;
  const rules = slotSentences(s.studio);
  const address = studioAddress(s);
  const phones = storePhones(s);
  const parts = s.services.filter((service) => service.id !== 'consult');
  const consult = s.services.find((service) => service.id === 'consult');

  return {
    id: 'studio',
    title: 'Studio fitting and slots',
    questions: [
      {
        id: 'studio-fit',
        q: 'Can you fit the parts I buy?',
        a: (
          <A>
            <p>
              Yes. Our own team fits parts at our studio. On a part we can fit, choose to have it fitted at the studio, and the checkout asks
              you for a slot. These are the fitting charges, including GST, per part fitted:
            </p>
            <Facts
              rows={parts.map((service) => ({
                term: service.name,
                value: (
                  <span className="tnum">
                    {serviceCharge(service)}
                    {service.minutes > 0 ? `, about ${minutesLabel(service.minutes)}` : ''}
                  </span>
                ),
              }))}
            />
          </A>
        ),
      },
      {
        id: 'slots',
        q: 'How do studio slots work?',
        a: (
          <A>
            {rules.length > 0 && <p>{rules.join(' ')}</p>}
            <p>
              Pick a free slot at checkout, or{' '}
              <Link to="/book-fitting" className="link font-bold">
                book a fitting
              </Link>{' '}
              on its own. Every booking gets a number, and you can look it up later with that number and your phone.
            </p>
          </A>
        ),
      },
      {
        id: 'own-part',
        q: 'Can I book a fitting for a part I already have?',
        a: (
          <A>
            <p>
              Yes.{' '}
              <Link to="/book-fitting" className="link font-bold">
                Book a fitting
              </Link>
              , choose the service and a slot, and bring the car and the part.
            </p>
            {consult && (
              <p>
                Not sure what to fit? {consult.name}
                {consult.minutes > 0 ? ` takes about ${minutesLabel(consult.minutes)}` : ''}
                {consult.charge > 0 ? ` and costs ${formatINR(consult.charge)}` : ' and costs nothing'}.
              </p>
            )}
          </A>
        ),
      },
      {
        id: 'pickup',
        q: 'Can I collect my order from the studio?',
        a: (
          <A>
            <p>
              Yes. Choose collection at the studio at checkout. There is no delivery fee for orders collected or fitted at the studio
              {s.cod.enabled ? ', and you can pay at the studio when you come in' : ''}. Made-to-order parts are still paid online.
            </p>
          </A>
        ),
      },
      {
        id: 'change-slot',
        q: 'Can I move or cancel my slot?',
        a: (
          <A>
            <p>
              Yes. {phones.length > 0 ? `Call us on ${listJoin(phones, 'or')}` : 'Write to us'}
              {s.whatsapp ? ' or message us on WhatsApp' : ''} with your booking number, and we move or cancel it. We confirm the change by email
              when you gave us one.
            </p>
          </A>
        ),
      },
      {
        id: 'where',
        q: 'Where is the studio, and when is it open?',
        a: (
          <A>
            {address ? <p className="whitespace-pre-line">{address}</p> : <p>Call us and we will give you directions to the studio.</p>}
            {s.studio.mapUrl.trim() && (
              <p>
                <a href={s.studio.mapUrl} target="_blank" rel="noopener noreferrer" className="link font-bold">
                  Open the studio in Maps<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            )}
            {s.businessHours.trim() && <p>We are open {s.businessHours.trim()}.</p>}
          </A>
        ),
      },
    ],
  };
}

function buildGroups(s: PublicSettings): Group[] {
  const methods = paymentMethods(s);
  const cod = codSentence(s);
  const surcharge = surchargeSentence(s);
  const dispatch = s.shipping.dispatchDays;
  const windowDays = s.returns.windowDays;
  const studioGroup = buildStudioGroup(s);
  const emi = emiLabel(s);

  return [
    {
      id: 'ordering',
      title: 'Ordering and payment',
      questions: [
        {
          id: 'account',
          q: 'Do I need an account to order?',
          a: (
            <A>
              <p>
                No. You can check out as a guest with a mobile number and an address. An account keeps your orders, addresses, saved parts and cars
                in one place across devices.
              </p>
            </A>
          ),
        },
        {
          id: 'pay',
          q: 'How can I pay?',
          a: (
            <A>
              {methods.length > 0 ? (
                <p>You can pay by {listJoin(methods, 'or')}. The checkout shows every method side by side with its total in rupees.</p>
              ) : (
                <p>The checkout lists the payment methods open for your order, each with its total in rupees.</p>
              )}
              {s.prepaidDiscountPercent > 0 && (
                <p>Paying online in full takes {s.prepaidDiscountPercent}% off the price of the parts.</p>
              )}
            </A>
          ),
        },
        ...(emi
          ? [
              {
                id: 'emi',
                q: 'Can I pay in EMI?',
                a: (
                  <A>
                    <p>
                      Yes{s.emi.partner.trim() ? `, through ${s.emi.partner.trim()}` : ''}
                      {s.emi.minAmount > 0 ? ` on orders of ${formatINR(s.emi.minAmount)} or more` : ''}.
                      {s.emi.note.trim() ? ` ${s.emi.note.trim()}` : ''}
                    </p>
                  </A>
                ),
              },
            ]
          : []),
        {
          id: 'cod',
          q: 'Is cash on delivery available, and what does it cost?',
          a: (
            <A>
              {cod ? (
                <>
                  <p>{cod}</p>
                  {s.cod.advancePercent > 0 && (
                    <p>
                      With cash on delivery, {s.cod.advancePercent}% of the total is paid online when you order and the rest when the parcel arrives.
                    </p>
                  )}
                  <p>
                    Made-to-order items such as show plates, and parts that travel by freight, have to be paid for online. Cash on delivery also does
                    not reach some remote PIN codes: the product page tells you when you enter yours.
                  </p>
                </>
              ) : (
                <p>Cash on delivery is switched off for now. Every order is paid online.</p>
              )}
            </A>
          ),
        },
        {
          id: 'invoice',
          q: 'Will I get a GST invoice?',
          a: (
            <A>
              <p>
                Yes. Every order has a tax invoice you can open and print from the order page. If you are buying for a business, enter your GSTIN at
                checkout and it is printed on the invoice.
              </p>
            </A>
          ),
        },
        {
          id: 'cancel',
          q: 'Can I cancel an order?',
          a: (
            <A>
              <p>
                Yes, until it is packed: cancel it from the order page. There is no charge, and anything paid online is refunded to the
                way you paid. After packing, wait for delivery and return it instead.
              </p>
            </A>
          ),
        },
      ],
    },
    {
      id: 'delivery',
      title: 'Delivery',
      questions: [
        {
          id: 'delivery-fee',
          q: 'How much is delivery?',
          a: (
            <A>
              <p>{deliveryFeeSentence(s)}</p>
              {surcharge && <p>{surcharge}</p>}
            </A>
          ),
        },
        {
          id: 'delivery-time',
          q: 'How long will it take?',
          a: (
            <A>
              <p>
                Orders leave us within {workingDays(dispatch)} of being confirmed. Most places in India then take 1 to 7 working days, depending on how
                far you are from us. The North-East, Jammu and Kashmir, Ladakh and the islands take longer.
              </p>
              <p>Enter your PIN code on any product page or in the cart for the dates for your address.</p>
            </A>
          ),
        },
        {
          id: 'track',
          q: 'How do I track my order?',
          a: (
            <A>
              <p>
                Use the link in your order email, or open{' '}
                <Link to="/track" className="link font-bold">
                  Track an order
                </Link>{' '}
                and enter the order number with the mobile number you ordered with. Once the parcel ships, the page shows the courier and its tracking
                number.
              </p>
            </A>
          ),
        },
      ],
    },
    ...(studioGroup ? [studioGroup] : []),
    {
      id: 'fitting',
      title: 'Will it fit',
      questions: [
        {
          id: 'fits',
          q: 'How do I know a part fits my car?',
          a: (
            <A>
              <p>
                Add your car once with My car. Every part then says Fits your car, Fits with work (and what work), Universal fit, Does not fit, or Not
                checked on your car yet. A part we have not checked has a button to ask us; we answer for your car, and the answer stays for everyone
                with the same car.
              </p>
            </A>
          ),
        },
        {
          id: 'fit-work',
          q: 'What does “Fits with work” mean?',
          a: (
            <A>
              <p>
                It goes on, but not straight out of the box: a bracket to adjust, a hole to drill, a trim to cut or a wire to join. The product page
                says what the work is, so you or your fitter can decide before buying.
              </p>
            </A>
          ),
        },
        {
          id: 'mechanic',
          q: 'Can my local mechanic fit it?',
          a: (
            <A>
              <p>
                Usually, yes. Each product has a Straight Label with the fitting difficulty, the time it takes and a fair labour charge, and a fitting
                card in English and Hindi with the tools and steps that you can print or send to your mechanic on WhatsApp.
              </p>
              {studioOpen(s) && (
                <p>
                  Or have our own team fit it at the studio: see{' '}
                  <a href="#studio" className="link font-bold">
                    Studio fitting and slots
                  </a>
                  .
                </p>
              )}
            </A>
          ),
        },
        {
          id: 'not-fit',
          q: 'What if it does not fit?',
          a: (
            <A>
              {s.fitPromise.enabled ? (
                <>
                  <p>{s.fitPromise.summary || 'When we mark a part as a verified fit for your car and it does not fit, we take it back.'}</p>
                  <p>For parts we have not verified on your car, the normal return rules apply.</p>
                </>
              ) : (
                <p>
                  Tell us within {windowDays} days of delivery with photos of the part against the car. The normal return rules apply.
                </p>
              )}
            </A>
          ),
        },
      ],
    },
    {
      id: 'returns',
      title: 'Returns and refunds',
      questions: [
        {
          id: 'return',
          q: 'How do I return something?',
          a: (
            <A>
              {windowDays > 0 ? (
                <p>You have {windowDays} days from delivery to ask for a return.</p>
              ) : (
                <p>Returns are taken for parts that arrive damaged, faulty or different from what you ordered.</p>
              )}
              {s.returns.summary && <p>{s.returns.summary}</p>}
              <p>
                Raise it through the{' '}
                <Link to="/contact?kind=return" className="link font-bold">
                  return request form
                </Link>{' '}
                with your order number. You get a ticket number, and we reply with how to send the part back.
              </p>
            </A>
          ),
        },
        {
          id: 'refund',
          q: 'When do I get my money back?',
          a: (
            <A>
              <p>
                Once the part reaches us and is checked, we refund it to the way you paid: the same UPI account, card or bank. For cash on delivery
                orders we ask for a bank account or UPI ID. Banks usually take 5 to 7 working days to show a card refund.
              </p>
            </A>
          ),
        },
      ],
    },
    {
      id: 'legal',
      title: 'Rules and the law',
      questions: [
        {
          id: 'road-legal',
          q: 'Are your parts legal on the road?',
          a: (
            <A>
              <p>
                Every product says so on its Straight Label: Road legal, Check the rules first, or Off-road only. Off-road only parts are
                for private land, tracks and shows, and using them on a public road can bring a fine.{' '}
                <Link to="/straight-label" className="link font-bold">
                  How to read the label
                </Link>
              </p>
            </A>
          ),
        },
        {
          id: 'show-plate',
          q: 'Can I fit a show plate in place of my number plate?',
          a: (
            <A>
              <p>
                No. Show plates are decorative, for a garage, a room or a car show on private ground. A car on a public road must carry its High
                Security Registration Plate (HSRP), booked through your dealer or your State’s official HSRP service.
              </p>
            </A>
          ),
        },
        {
          id: 'warranty-car',
          q: 'Will an accessory void my car’s warranty?',
          a: (
            <A>
              <p>
                Fitting an accessory does not cancel the whole warranty, but a dealer can refuse to pay for a fault the accessory caused. Cut wiring is
                the usual reason. Each product’s label says whether it may affect the warranty.
              </p>
            </A>
          ),
        },
        {
          id: 'data',
          q: 'What do you do with my details?',
          a: (
            <A>
              <p>
                We use them to deliver your order, send updates and keep the tax records the law asks for. We do not sell them. The{' '}
                <Link to="/policies/privacy" className="link font-bold">
                  privacy policy
                </Link>{' '}
                lists what we keep, why, and how to ask for it to be deleted.
              </p>
            </A>
          ),
        },
      ],
    },
  ];
}

export default function FaqPage() {
  useDocumentMeta({
    title: 'Questions and answers',
    description: 'Payment, cash on delivery, delivery fees and times, fitting, returns and road rules, answered plainly.',
  });
  const { data: settings, isPending, error, refetch } = useSettings();

  if (isPending) return <ReadingSkeleton sections={4} />;
  if (error || !settings) {
    return (
      <div className="container-page">
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the answers" />
      </div>
    );
  }

  const groups = buildGroups(settings);
  const toc: TocItem[] = groups.map((group) => ({ id: group.id, label: group.title, count: group.questions.length }));
  const total = groups.reduce((sum, group) => sum + group.questions.length, 0);

  return (
    <ReadingPage
      title="Questions and answers"
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Questions and answers' }]}
      description="The questions people ask us most, answered with the store’s current rules and fees."
      meta={`${total} answers`}
      toc={toc}
    >
      {groups.map((group) => (
        <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="grid scroll-mt-24 gap-3">
          <h2 id={`${group.id}-title`} className="type-h2">
            {group.title}
          </h2>
          <Accordion type="multiple" headingLevel={3}>
            {group.questions.map((question) => (
              <AccordionItem key={question.id} value={question.id} title={question.q}>
                {question.a}
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}

      <section aria-labelledby="faq-more" className="grid gap-4 border-t border-ink pt-5">
        <h2 id="faq-more" className="type-h3">
          Not answered here?
        </h2>
        <p className="type-body max-w-prose">Send us your question. You get a ticket number, and the shop replies.</p>
        <div className="flex flex-wrap gap-3">
          <Button to="/contact">Ask a question</Button>
          <WhatsAppButton text="Hello, I have a question about an order." />
        </div>
      </section>
    </ReadingPage>
  );
}
