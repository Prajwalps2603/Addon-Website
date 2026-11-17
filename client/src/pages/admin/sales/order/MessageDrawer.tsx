import { useEffect, useId, useState } from 'react';
import { WhatsAppIcon } from '@/components/brand';
import { Button, Drawer, Field, Textarea } from '@/components/ui';
import { formatPhone } from '@/lib/india';

export interface MessageDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Who it goes to, for the heading. */
  name: string;
  phone: string;
  /** The message as written for the current step. */
  draft: string;
  /** Builds the wa.me link for the edited text; '' hides the send button. */
  linkFor: (text: string) => string;
  /** What the draft is about, e.g. "Written for: Shipped". */
  context?: string;
}

/** The ready message, editable before WhatsApp opens. */
export function MessageDrawer({ open, onClose, name, phone, draft, linkFor, context }: MessageDrawerProps) {
  const [text, setText] = useState(draft);
  const id = useId();

  useEffect(() => {
    if (open) setText(draft);
  }, [open, draft]);

  const href = linkFor(text);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`WhatsApp ${name || 'the customer'}`}
      description={formatPhone(phone)}
      footer={
        <div className="grid gap-2 sm:flex sm:justify-between">
          <Button variant="ghost" onClick={() => setText(draft)} disabled={text === draft}>
            Undo my changes
          </Button>
          {href && (
            <Button href={href} target="_blank" rel="noopener noreferrer" size="lg" iconLeft={<WhatsAppIcon />} onClick={onClose}>
              Open WhatsApp
            </Button>
          )}
        </div>
      }
    >
      <Field label="Message" hint={context} htmlFor={id}>
        <Textarea id={id} rows={12} value={text} onChange={(event) => setText(event.target.value)} />
      </Field>
    </Drawer>
  );
}
