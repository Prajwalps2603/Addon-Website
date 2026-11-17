import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PaymentMarks } from '@/components/brand';
import { Button, Callout, CopyButton } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api, errorMessage } from '@/lib/api';
import { formatINR } from '@/lib/format';
import {
  isInAppBrowser,
  loadRazorpay,
  openRazorpay,
  PaymentDismissedError,
  PaymentUnavailableError,
  type RazorpayInstruction,
  type RazorpayProof,
} from '@/lib/razorpay';
import { SITE_NAME } from '@/lib/seo';
import { siteUrl } from '@/lib/urls';
import type { Order } from '@/types/api';

type Phase = 'ready' | 'opening' | 'verifying' | 'dismissed' | 'unavailable' | 'unverified';

export interface RazorpayPaymentProps {
  order: Order;
  instruction: RazorpayInstruction;
  onPaid(order: Order): void;
  autoOpen: boolean;
  onDismiss?: () => void;
}

function orderLink(order: Order): string {
  const query = order.accessToken ? `?token=${encodeURIComponent(order.accessToken)}` : '';
  return siteUrl(`/order/${encodeURIComponent(order.orderNumber)}${query}`);
}

export function RazorpayPayment({ order, instruction, onPaid, autoOpen, onDismiss }: RazorpayPaymentProps) {
  const settings = useSettings().data;
  const storeName = settings?.storeName || SITE_NAME;
  const [current, setCurrent] = useState(instruction);
  const [phase, setPhase] = useState<Phase>('ready');
  const [problem, setProblem] = useState('');
  const proof = useRef<RazorpayProof | null>(null);
  const [inApp] = useState(() => (typeof navigator === 'undefined' ? false : isInAppBrowser()));
  const amount = Math.round(current.amountPaise / 100);

  // Fetch checkout.js as soon as the panel shows, so the window opens without a wait.
  useEffect(() => {
    loadRazorpay().catch(() => undefined);
  }, []);

  const verify = async (paid: RazorpayProof) => {
    setPhase('verifying');
    try {
      const updated = await api.payments.razorpayVerify({ orderNumber: order.orderNumber, ...paid });
      onPaid(updated);
    } catch (error) {
      setProblem(errorMessage(error));
      setPhase('unverified');
    }
  };

  const pay = async (retry: boolean) => {
    setPhase('opening');
    setProblem('');
    let next = current;
    if (retry) {
      try {
        const fresh = await api.payments.razorpayRetry({ orderNumber: order.orderNumber, token: order.accessToken });
        if (fresh?.provider === 'razorpay') {
          next = fresh;
          setCurrent(fresh);
        }
      } catch (error) {
        setProblem(errorMessage(error));
        setPhase('dismissed');
        return;
      }
    }
    try {
      const paid = await openRazorpay(next, { storeName, description: `Order ${order.orderNumber}` });
      proof.current = paid;
      await verify(paid);
    } catch (error) {
      if (error instanceof PaymentUnavailableError) {
        setPhase('unavailable');
        return;
      }
      setProblem(error instanceof PaymentDismissedError ? error.failureReason : errorMessage(error));
      setPhase('dismissed');
      if (error instanceof PaymentDismissedError) onDismiss?.();
    }
  };

  const started = useRef(false);
  useEffect(() => {
    if (!autoOpen || started.current) return;
    started.current = true;
    void pay(false);
    // Opens once, when the panel first appears after the order is placed.
  }, [autoOpen]);

  const busy = phase === 'opening' || phase === 'verifying';

  return (
    <div className="grid gap-5">
      {inApp && (
        <Callout
          tone="warn"
          title="You are inside the Instagram or Facebook app"
          actions={<CopyButton value={orderLink(order)} label="Copy order link" />}
        >
          The payment window often does not open here. If nothing appears, tap the menu at the top right and choose
          Open in browser, or copy the order link into Chrome. Your order is saved either way.
        </Callout>
      )}

      {phase === 'dismissed' && (
        <Callout tone="info" live title="Payment not completed">
          Nothing was charged and your order is saved. {problem && <>The bank said: {problem}. </>}You can try again, or use another card or UPI app in
          the same window.
        </Callout>
      )}
      {phase === 'unavailable' && (
        <Callout tone="danger" live title="The payment window did not load">
          Check your connection and try again. If you use an ad blocker, allow checkout.razorpay.com for this page.
        </Callout>
      )}
      {phase === 'unverified' && (
        <Callout tone="warn" live title="We could not confirm the payment yet">
          {problem} If money left your account, do not pay again. Razorpay also reports each payment to us directly, and your order
          updates when it does. Press Check again, or open the order page later.
        </Callout>
      )}

      {phase === 'unverified' && proof.current ? (
        <Button size="lg" block onClick={() => proof.current && void verify(proof.current)}>
          Check again
        </Button>
      ) : (
        <Button size="lg" block loading={busy} onClick={() => void pay(phase === 'dismissed')}>
          {phase === 'verifying' ? 'Confirming payment' : phase === 'dismissed' || phase === 'unavailable' ? `Try again: pay ${formatINR(amount)}` : `Pay ${formatINR(amount)}`}
        </Button>
      )}

      <div className="grid gap-2">
        <PaymentMarks methods={['upi', 'card', 'netbanking']} compact />
        <p className="type-small flex items-start gap-2 text-muted">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>The payment window is run by Razorpay. Your card details go to them, never to us.</span>
        </p>
      </div>
    </div>
  );
}
