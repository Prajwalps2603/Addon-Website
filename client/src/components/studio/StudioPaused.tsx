import { Button } from '@/components/ui';
import { WhatsAppButton } from '@/components/commerce';
import type { PublicSettings } from '@/types/api';
import { StudioContact } from './StudioContact';

/** Shown in place of the booking form while settings.studio.enabled is false. */
export function StudioPaused({ settings }: { settings: PublicSettings }) {
  return (
    <section aria-labelledby="studio-paused" className="grid max-w-2xl gap-5 border-t border-ink pt-5">
      <h2 id="studio-paused" className="type-h2">
        Fitting bookings are paused
      </h2>
      <p className="type-lead max-w-prose">
        The studio is not taking online bookings for now. Message us on WhatsApp or call, and we will tell you when we can fit your part.
      </p>
      <div className="flex flex-wrap gap-2">
        <WhatsAppButton variant="dark" text="Hi, I would like to book a fitting at your studio. When is the next free slot?">
          Ask on WhatsApp
        </WhatsAppButton>
        <Button variant="outline" to="/shop">
          Browse parts
        </Button>
      </div>
      <StudioContact settings={settings} showAddress={false} />
    </section>
  );
}
