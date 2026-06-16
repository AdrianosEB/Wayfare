import { Button } from '@/components/Button';
import { Photo } from '@/components/Photo';
import { PlaneIcon, BedIcon, ActivityIcon } from '@/components/icons';
import { images } from '@/lib/images';
import { navigate, planHref } from '@/lib/router';
import { MARKETING } from '@/lib/content';
import { Section } from './_shared';

/**
 * "All-in-one planner" — two-column section. Left is the pitch + a single primary CTA.
 * Right is a static, non-interactive product-shot mock of an itinerary plus an azure budget
 * panel. The mock's prices carry an "Estimated" source dot — it reinforces the honest-budget
 * differentiator and never claims a live/bookable price. (Not the real planner components.)
 */
export function AllInOne() {
  return (
    <Section id="how-it-works">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
            {MARKETING.allInOne}
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-ink-2">
            Describe the trip, answer a couple of quick questions, and watch the whole plan come
            together — every price sourced and dated, with a running total you can trust.
          </p>
          <div className="mt-8">
            <Button size="lg" onClick={() => navigate(planHref())}>
              Start planning
            </Button>
          </div>
        </div>

        <ProductShot />
      </div>
    </Section>
  );
}

/** Static styled mock — an itinerary preview + an azure budget panel. Decorative. */
function ProductShot() {
  return (
    <div className="relative" aria-hidden>
      <div className="rounded-lg border border-border bg-bg p-4 shadow-float sm:p-5">
        {/* mini header */}
        <div className="flex items-center gap-3">
          <Photo
            image={images.for('naxos')}
            imageKey="naxos"
            alt=""
            ratio="aspect-square"
            className="h-12 w-12 shrink-0 rounded-md"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-ink">8 days on Naxos</p>
            <p className="truncate text-xs text-ink-3">Aug 23–31 · 2 travelers</p>
          </div>
        </div>

        {/* itinerary rows */}
        <div className="mt-4 space-y-2.5">
          <MockRow icon={<PlaneIcon />} title="London → Naxos" sub="Direct · 3h 55m" price="€318" />
          <MockRow icon={<BedIcon />} title="Beachfront studio" sub="7 nights · 120 m to beach" price="€1,134" />
          <MockRow icon={<ActivityIcon />} title="Boat trip to the Small Cyclades" sub="Day 4 · half day" price="€96" />
        </div>

        {/* budget panel */}
        <div className="mt-4 rounded-md bg-azure-50 p-4">
          <div className="flex items-end justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-azure-700">Running total</span>
            <span className="tnum font-display text-2xl font-semibold text-azure-700">€2,410</span>
          </div>
          {/* budget bar — comfortably under a €2,500 target */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-azure-100">
            <div className="h-full rounded-pill bg-azure-500" style={{ width: '96%' }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-estimate" />
              Estimated
            </span>
            <span className="tnum">Target €2,500</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockRow({
  icon,
  title,
  sub,
  price,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  price: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface text-base text-azure-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        <p className="truncate text-xs text-ink-3">{sub}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tnum text-sm font-semibold text-ink">{price}</p>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-3">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-estimate" />
          Estimated
        </span>
      </div>
    </div>
  );
}
