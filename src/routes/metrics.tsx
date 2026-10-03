import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { getJournalStats } from "@/lib/metrics.functions";

const statsQuery = queryOptions({
  queryKey: ["journal-stats"],
  queryFn: () => getJournalStats(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/metrics")({
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQuery),
  head: () => ({
    meta: [
      { title: "Journal Metrics — NYRJ" },
      {
        name: "description",
        content:
          "NYRJ journal metrics: published articles, researchers featured, countries represented, and editorial turnaround times.",
      },
      {
        name: "keywords",
        content:
          "journal metrics, student research statistics, peer review turnaround time, acceptance rate student journal, open access journal metrics",
      },
      { property: "og:title", content: "Journal Metrics — NYRJ" },
      {
        property: "og:description",
        content: "Current reach, citation impact, and editorial turnaround metrics for NYRJ.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nyrj.org/metrics" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/metrics" }],
  }),
  component: MetricsPage,
});

function MetricsPage() {
  const { data: stats } = useSuspenseQuery(statsQuery);
  const down = (stats as { unavailable?: boolean }).unavailable === true;
  // Never publish a hard zero we can't stand behind: if the figure is
  // genuinely zero (or unreadable right now), show an em dash instead.
  const num = (n: number | null | undefined) =>
    down || n == null || !Number.isFinite(n) || n === 0 ? "—" : n.toLocaleString();
  const dec = (n: number | null | undefined) =>
    down || n == null || !Number.isFinite(n) ? "—" : n.toFixed(2);

  const reach = [
    {
      value: num(stats.articles),
      label: "Articles published",
      detail: `${dec(stats.citationsPerArticle)} indexed citations per article · Total peer-reviewed, open-access manuscripts currently available in the NYRJ public library.`,
    },
    {
      value: num(stats.researchers),
      label: "Researchers featured",
      detail:
        "Named authors across every published paper — students whose work is now on the record.",
    },
    {
      value: num(stats.studentsImpacted),
      label: "Students impacted",
      detail:
        "Students reached through NYRJ chapters and events — updates live as chapter leads report attendance and events are recorded.",
    },
    {
      value: num(stats.countries),
      label: "Countries represented",
      detail:
        "Distinct nations submitting authors have listed on their manuscripts. Updates automatically as new submissions come in.",
    },
  ];

  const fmtDays = (d: number | null | undefined, fallback: string) => {
    if (d == null || !Number.isFinite(d)) return fallback;
    if (d < 14) return `${Math.max(1, Math.round(d))} days`;
    return `${(d / 7).toFixed(1).replace(/\.0$/, "")} weeks`;
  };
  const t = stats.turnaround;
  const live = (t?.sampleSize ?? 0) >= 3;

  const turnaround = [
    {
      value: fmtDays(t?.firstResponseDays, "1 week"),
      label: "Median to first response",
      detail:
        "How long, on average, until an author hears back from the editorial office after submitting a manuscript.",
    },
    {
      value: "2 weeks",
      label: "Median to first peer review",
      detail: "How long, on average, until the first reviewer report is returned to the author.",
    },
    {
      value: "4 weeks",

      label: "Median to final publishing",
      detail:
        "How long, on average, from initial submission to public release in the NYRJ library.",
    },
  ];

  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Journal Metrics</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          Our reach, in numbers.
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl">
          NYRJ is a self-published, peer-reviewed, open-access rolling-publication journal — every
          article is free to read, with no subscription and no author fees. These figures update
          automatically as new manuscripts are accepted and new authors submit. A dash indicates a
          figure we are not yet able to report.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reach.map((m) => (
            <div key={m.label} className="border border-border bg-card p-6">
              <p className="font-serif text-4xl text-primary">{m.value}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-accent">{m.label}</p>
              <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{m.detail}</p>
            </div>
          ))}
        </div>

        <h2 className="font-serif text-3xl text-primary mt-16">Citation impact.</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Citation counts are fetched for articles with DOIs from OpenAlex, with Crossref as a
          fallback. Indexing can lag publication, and articles without DOIs are not monitored.
        </p>

        <div className="mt-8 border border-border bg-card p-6">
          <p className="font-serif text-4xl text-primary">{num(stats.citations)}</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-accent">
            Indexed citations
          </p>
          <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
            Lifetime citations currently reported by the scholarly indexes for published articles
            with DOIs. Copying a citation on this site does not change this count.
          </p>
        </div>

        <h2 className="font-serif text-3xl text-primary mt-16">Editorial turnaround.</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Medians across our current editorial workflow, all disciplines and author stages.{" "}
          {live
            ? `Calculated automatically from ${t?.sampleSize ?? 0} real manuscripts moving through review.`
            : "Baseline targets — these update automatically once enough manuscripts have moved through review."}
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {turnaround.map((m) => (
            <div key={m.label} className="border border-border bg-card p-6">
              <p className="font-serif text-4xl text-primary">{m.value}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-accent">{m.label}</p>
              <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{m.detail}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground italic">
          Article and researcher counts are drawn from the public library. Country counts are drawn
          from the nations authors list on their submission forms — every new submission with a new
          country expands this number automatically.
        </p>
      </article>
    </SiteLayout>
  );
}
