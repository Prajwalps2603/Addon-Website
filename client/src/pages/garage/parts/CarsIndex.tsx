import { useMemo } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { ErrorState, PageHeader, WhatsAppButton } from "@/components/commerce";
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Skeleton,
} from "@/components/ui";
import { useActiveVehicle } from "@/hooks/useActiveVehicle";
import { useVehicles } from "@/hooks/useVehicles";
import { pluralize } from "@/lib/format";
import { useDocumentMeta } from "@/lib/seo";
import { cn } from "@/lib/cn";
import type { BodyType, VehicleMake, VehicleModelGroup } from "@/types/api";
import { carPath, matchesQuery, modelPath, yearsLabel } from "./carText";

const CRUMBS = [{ label: "Home", to: "/" }, { label: "Cars" }];

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "muv", label: "MUV" },
  { value: "pickup", label: "Pickup" },
  { value: "coupe", label: "Coupe" },
];

/** "Swift, Baleno, Brezza and 8 more": the make's popular models first, as the API orders them. */
function modelPreview(make: VehicleMake, shown = 3): string {
  const names = make.models.slice(0, shown).map((model) => model.name);
  const rest = make.models.length - names.length;
  return rest > 0 ? `${names.join(", ")} and ${rest} more` : names.join(", ");
}

/** A round badge with the make's first letter, standing in for a logo. */
function MakeMark({ name, size = 'md' }: { name: string; size?: 'md' | 'sm' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-raised font-display font-black text-ink italic transition-colors duration-200 group-hover:bg-brand group-hover:text-brand-ink',
        size === 'md' ? 'size-12 text-xl' : 'size-9 text-base',
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function PopularMakeTile({ make }: { make: VehicleMake }) {
  const shown = make.models.slice(0, 2);
  const rest = make.models.length - shown.length;
  return (
    <Link
      to={`/cars/${make.slug}`}
      className="group focus-ring flex h-full flex-col gap-4 rounded-[20px] bg-surface p-4 transition-colors duration-200 hover:bg-surface-2 sm:p-5"
    >
      <span className="flex items-center gap-3">
        <MakeMark name={make.name} />
        <span className="grid min-w-0 flex-1">
          <span className="text-xl leading-tight font-bold break-words">{make.name}</span>
          <span className="text-xs text-muted tnum">{pluralize(make.models.length, "model")}</span>
        </span>
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-raised transition-transform duration-200 group-hover:translate-x-0.5">
          <ArrowRight className="size-4" />
        </span>
      </span>
      <span className="mt-auto flex flex-nowrap items-center gap-1.5 overflow-hidden" aria-label={modelPreview(make)}>
        {shown.map((model) => (
          <span key={model.slug} aria-hidden className="truncate rounded-full bg-raised px-2.5 py-1 text-xs font-semibold">
            {model.name}
          </span>
        ))}
        {rest > 0 && (
          <span aria-hidden className="shrink-0 rounded-full px-1.5 py-1 text-xs font-semibold text-muted">
            +{rest} more
          </span>
        )}
      </span>
    </Link>
  );
}

function MakeTile({ make }: { make: VehicleMake }) {
  return (
    <Link
      to={`/cars/${make.slug}`}
      className="group focus-ring flex h-full items-center gap-3 rounded-[16px] bg-surface p-3 transition-colors duration-200 hover:bg-surface-2"
    >
      <MakeMark name={make.name} size="sm" />
      <span className="grid min-w-0">
        <span className="leading-tight font-bold break-words">{make.name}</span>
        <span className="text-xs text-muted tnum">{pluralize(make.models.length, "model")}</span>
      </span>
    </Link>
  );
}

interface ModelHit {
  make: VehicleMake;
  model: VehicleModelGroup;
}

function ModelHits({ hits }: { hits: readonly ModelHit[] }) {
  return (
    <ul className="grid border-t border-line md:grid-cols-2 md:gap-x-8 xl:grid-cols-3">
      {hits.map(({ make, model }) => (
        <li key={`${make.slug}/${model.slug}`} className="border-b border-line">
          <Link
            to={modelPath(make.slug, model.slug)}
            className="group focus-ring-inset flex min-h-16 items-center gap-3 py-3 pr-1"
          >
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-bold group-hover:underline group-hover:underline-offset-4">
                {make.name} {model.name}
              </span>
              <span className="type-small truncate text-muted tnum">
                {model.generations.map((gen) => yearsLabel(gen)).join(", ")}
              </span>
            </span>
            <ArrowRight aria-hidden className="size-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function IndexSkeleton() {
  return (
    <div aria-hidden className="grid gap-10">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    </div>
  );
}

/** /cars: every make we list, popular ones first and larger, with a search across makes and models. */
export function CarsIndex() {
  useDocumentMeta({
    title: "Shop by car",
    description:
      "Every make and model we list parts for. Choose yours to see only the parts that fit it.",
  });
  const { data: makes, isPending, error, refetch } = useVehicles();
  const active = useActiveVehicle();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const bodyParam = params.get("body");
  const body = BODY_TYPES.some((type) => type.value === bodyParam)
    ? (bodyParam as BodyType)
    : null;
  const searching = query.trim() !== "" || body !== null;

  const setParam = (key: "q" | "body", value: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  const setQuery = (value: string) => setParam("q", value);
  const setBody = (value: BodyType | null) => setParam("body", value);
  const clearAll = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("q");
        next.delete("body");
        return next;
      },
      { replace: true },
    );

  const modelCount =
    makes?.reduce((sum, make) => sum + make.models.length, 0) ?? 0;

  // Models per body type, for the counts on the filter chips.
  const bodyCounts = useMemo(() => {
    const counts = new Map<BodyType, number>();
    for (const make of makes ?? [])
      for (const model of make.models)
        counts.set(model.bodyType, (counts.get(model.bodyType) ?? 0) + 1);
    return counts;
  }, [makes]);

  const results = useMemo(() => {
    if (!makes || !searching) return null;
    const typed = query.trim() !== "";
    // With a body type chosen the answer is models, not makes: a make has every kind of car.
    const matchedMakes =
      typed && !body
        ? makes.filter((make) => matchesQuery(make.name, query))
        : [];
    const hits: ModelHit[] = [];
    for (const make of makes) {
      for (const model of make.models) {
        if (body && model.bodyType !== body) continue;
        if (typed && !matchesQuery(`${make.name} ${model.name}`, query))
          continue;
        hits.push({ make, model });
      }
    }
    return { makes: matchedMakes, hits };
  }, [makes, query, body, searching]);

  const filterLabel = [
    query.trim() && `“${query.trim()}”`,
    body && BODY_TYPES.find((type) => type.value === body)?.label,
  ]
    .filter(Boolean)
    .join(" · ");

  const popular = makes?.filter((make) => make.isPopular) ?? [];
  const rest = makes?.filter((make) => !make.isPopular) ?? [];

  return (
    <div className="container-page pb-16 md:pb-24">
      <PageHeader
        title="Shop by car"
        breadcrumbs={CRUMBS}
        description="Choose your car to see only the parts that fit it."
        meta={
          makes && makes.length > 0
            ? `${pluralize(makes.length, "make")}, ${pluralize(modelCount, "model")}`
            : undefined
        }
      />

      {active && (
        <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-line py-3">
          <span className="text-muted">Your car:</span>
          <span className="font-bold">{active.label}</span>
          <Link
            to={carPath(active)}
            className="font-bold underline underline-offset-4 hover:decoration-2"
          >
            See the parts that fit it
          </Link>
        </p>
      )}

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          title="Could not load the list of cars"
        />
      ) : isPending ? (
        <IndexSkeleton />
      ) : makes.length === 0 ? (
        <EmptyState
          title="No cars listed yet"
          description="The shop has not added any cars. Universal parts still suit every car."
          actions={<Button to="/shop">Browse the shop</Button>}
        />
      ) : (
        <div className="grid gap-10">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:gap-10">
            <form role="search" onSubmit={(event) => event.preventDefault()}>
              <Field
                label="Find your car"
                hint="Type a make or a model, e.g. Creta or Maruti Swift"
              >
                <Input
                  type="search"
                  inputSize="lg"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                  enterKeyHint="search"
                  leading={<Search aria-hidden className="size-5" />}
                  trailing={
                    searching ? (
                      <IconButton
                        label="Clear search"
                        size="sm"
                        onClick={() => setQuery("")}
                      >
                        <X aria-hidden />
                      </IconButton>
                    ) : undefined
                  }
                />
              </Field>
            </form>

            <div
              role="group"
              aria-labelledby="cars-body-label"
              className="grid gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p id="cars-body-label" className="type-small font-bold">
                  Body type
                </p>
                {searching && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="type-small font-bold text-muted underline underline-offset-4 hover:text-ink"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {BODY_TYPES.filter(
                  (type) => (bodyCounts.get(type.value) ?? 0) > 0,
                ).map((type) => {
                  const on = body === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setBody(on ? null : type.value)}
                      className={cn(
                        "focus-ring inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors dur-quick",
                        on
                          ? "border-ink bg-ink text-page"
                          : "border-line bg-page hover:border-ink",
                      )}
                    >
                      {on && <X aria-hidden className="size-3.5" />}
                      {type.label}
                      <span
                        className={cn(
                          "text-xs font-medium tnum",
                          on ? "text-page/70" : "text-muted",
                        )}
                      >
                        {bodyCounts.get(type.value)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {results ? (
            <section aria-label="Search results" className="grid gap-8">
              <p aria-live="polite" className="type-small text-muted tnum">
                {results.hits.length === 0 && results.makes.length === 0
                  ? `Nothing matches ${filterLabel}.`
                  : body
                    ? `${pluralize(results.hits.length, "model")} match ${filterLabel}.`
                    : `${pluralize(results.makes.length, "make")} and ${pluralize(results.hits.length, "model")} match ${filterLabel}.`}
              </p>
              {results.makes.length > 0 && (
                <ul
                  aria-label="Matching makes"
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
                >
                  {results.makes.map((make) => (
                    <li key={make.slug}>
                      <MakeTile make={make} />
                    </li>
                  ))}
                </ul>
              )}
              {results.hits.length > 0 && <ModelHits hits={results.hits} />}
              {results.hits.length === 0 && results.makes.length === 0 && (
                <EmptyState
                  size="sm"
                  title="We could not find that car"
                  description="Check the spelling, or try just the model name. If your car is not listed, universal parts still suit it, and we can check the rest for you."
                  actions={
                    <>
                      <Button variant="dark" onClick={clearAll}>
                        Show every make
                      </Button>
                      <WhatsAppButton
                        text={`Hi, do you have parts for a ${query.trim() || "car like mine"}?`}
                      >
                        Ask us about your car
                      </WhatsAppButton>
                    </>
                  }
                />
              )}
            </section>
          ) : (
            <>
              {popular.length > 0 && (
                <section aria-labelledby="cars-popular" className="grid gap-4">
                  <h2 id="cars-popular" className="type-h3 italic uppercase">
                    Popular makes
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {popular.map((make) => (
                      <li key={make.slug}>
                        <PopularMakeTile make={make} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {rest.length > 0 && (
                <section aria-labelledby="cars-all" className="grid gap-4">
                  <h2
                    id="cars-all"
                    className={popular.length > 0 ? "type-h3" : "type-h2"}
                  >
                    {popular.length > 0 ? "More makes" : "Every make"}
                  </h2>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                    {rest.map((make) => (
                      <li key={make.slug}>
                        <MakeTile make={make} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
