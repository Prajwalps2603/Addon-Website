import { ArrowRight, ClipboardList, Wallet, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { SectionHeading } from '@/components/commerce';

interface Tool {
  to: string;
  name: string;
  Icon: LucideIcon;
  does: string;
}

const TOOLS: Tool[] = [
  {
    to: '/new-car',
    name: 'New Car planner',
    Icon: ClipboardList,
    does: 'Give us the car, the delivery date and a budget. Get three kits of parts that fit, to hold up against the dealer’s accessory quote.',
  },
  {
    to: '/pocket-builds',
    name: 'Pocket Builds',
    Icon: Wallet,
    does: 'Type a budget and pick a style. Get a complete kit that stays under that number.',
  },
];

/** The tools as rounded cards. */
export function ToolsBand() {
  return (
    <section aria-labelledby="home-tools" className="section-y">
      <div className="container-page grid gap-10">
        <SectionHeading
          id="home-tools"
          title="Try it before you buy it"
          description="Two tools for the questions a product list cannot answer."
        />

        <ul className="grid gap-4 md:grid-cols-2">
          {TOOLS.map(({ to, name, Icon, does }) => (
            <li key={to}>
              <Link
                to={to}
                className="group grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-[20px] bg-surface p-5 transition-colors duration-200 hover:bg-surface-2 focus-ring md:p-6"
              >
                <span aria-hidden className="grid size-12 place-items-center rounded-[14px] bg-raised text-ink transition-colors duration-200 group-hover:bg-brand group-hover:text-brand-ink">
                  <Icon className="size-6" />
                </span>
                <span className="grid gap-1">
                  <span className="type-h3">{name}</span>
                  <span className="type-small text-muted">{does}</span>
                </span>
                <ArrowRight aria-hidden className="mt-1 size-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
