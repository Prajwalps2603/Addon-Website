import { CalendarCheck } from 'lucide-react';
import { addDays, todayInIndia } from '@/components/studio';
import { Button } from '@/components/ui';
import { pluralize } from '@/lib/format';
import { STILL_TO_HANDLE, useBookings, useDayBookings } from './bookings';

/**
 * Studio reminders for the follow-ups page. The follow-up list from the server has no booking
 * reminders yet, so this points at the diary, where every booking has its message written.
 * Renders nothing while there is nothing to remind anyone about.
 */
export function StudioReminders() {
  const tomorrow = addDays(todayInIndia(), 1);
  const tomorrowList = useDayBookings(tomorrow);
  const waiting = useBookings({ status: 'requested', limit: 1 });
  const tomorrowCars = (tomorrowList.data?.items ?? []).filter((booking) => STILL_TO_HANDLE.has(booking.status)).length;
  const toConfirm = waiting.data?.total ?? 0;
  if (tomorrowCars === 0 && toConfirm === 0) return null;

  return (
    <section aria-labelledby="studio-reminders" className="grid gap-3 rounded-[20px] bg-surface p-5">
      <h2 id="studio-reminders" className="type-h3 flex items-center gap-2">
        <CalendarCheck aria-hidden className="size-5 shrink-0" />
        Studio bookings
      </h2>
      <ul className="grid gap-1">
        {tomorrowCars > 0 && <li>{pluralize(tomorrowCars, 'car')} booked in for tomorrow: send each a reminder with the time and the way to the studio.</li>}
        {toConfirm > 0 && <li>{pluralize(toConfirm, 'booking')} still to confirm.</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        {tomorrowCars > 0 && (
          <Button variant="outline" size="sm" to={`/admin/bookings?day=${tomorrow}`}>
            Open tomorrow
          </Button>
        )}
        {toConfirm > 0 && (
          <Button variant="outline" size="sm" to="/admin/bookings?view=list&status=requested">
            Bookings to confirm
          </Button>
        )}
      </div>
    </section>
  );
}
