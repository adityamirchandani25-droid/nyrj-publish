import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { listFeaturedArticles } from "@/lib/articles.functions";

const featuredQuery = queryOptions({
  queryKey: ["featured-articles"],
  queryFn: () => listFeaturedArticles(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(featuredQuery),
  head: () => ({
    meta: [
      { title: "NYRJ — National Youth Research Journal (ISSN 3143-3030)" },
      {
        name: "description",
        content:
          "Open-access, peer-reviewed rolling-publication journal of original student research from middle school through medical school, across every discipline.",
      },
      {
        name: "keywords",
        content:
          "national youth research journal, NYRJ, student research journal, peer reviewed student journal, high school research journal, youth scholarly publishing, open access student research, ISSN 3143-3030",
      },
      { property: "og:title", content: "NYRJ — National Youth Research Journal" },
      {
        property: "og:description",
        content:
          "Peer-reviewed, open-access rolling-publication journal of original student research — every discipline.",
      },
      { property: "og:url", content: "https://nyrj.org/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "NYRJ — National Youth Research Journal" },
      {
        name: "twitter:description",
        content: "Peer-reviewed rolling-publication student research — every discipline.",
      },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/" }],
  }),
  errorComponent: ({ error }) => (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl text-primary">Something went wrong</h1>
        <p className="mt-4 text-muted-foreground">
          {error instanceof Error ? error.message : "Please try again."}
        </p>
      </section>
    </SiteLayout>
  ),
  notFoundComponent: () => (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl text-primary">Page not found</h1>
      </section>
    </SiteLayout>
  ),
  component: Home,
});

function Home() {
  const { data: featured } = useSuspenseQuery(featuredQuery);

  return (
    <SiteLayout>
      {/* Mission hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent mb-4">
            Open Access · Peer-Reviewed · Vol. I · ISSN 3143-3030
          </p>
          <h1 className="font-serif text-3xl sm:text-5xl text-primary leading-tight">
            Rigorous research has no minimum age.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground italic">
            From middle school to med school — student research across every discipline.
          </p>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
            The <em>National Youth Research Journal</em> is a rolling-publication journal that
            accepts applications from students ranging from middle school to med school. We accept
            research in any topic or category — from molecular biology and astrophysics to history,
            social sciences, and economics. Our mission is to give young scholars real experience
            conducting research and publishing it before they ever set foot on a college campus.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/submit"
              className="px-5 py-2.5 bg-accent text-accent-foreground text-xs uppercase tracking-[0.2em] hover:opacity-90 transition"
            >
              Submit a Manuscript
            </Link>
            <Link
              to="/archive"
              className="px-5 py-2.5 border border-primary text-primary text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition"
            >
              Read the Library
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Papers */}
      {featured.length > 0 && (
        <section className="border-b border-border bg-secondary">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-accent">In This Issue</p>
              <h2 className="font-serif text-3xl sm:text-4xl text-primary mt-2">Featured Papers</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                Hand-picked manuscripts from our editorial team.
              </p>
            </div>
            <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((a) => (
                <li key={a.id} className="border border-border bg-background p-5 flex flex-col">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
                    Research Article
                    {a.topic ? ` · ${a.topic}` : ""}
                  </p>
                  <Link
                    to="/article/$slug"
                    params={{ slug: a.slug }}
                    className="mt-2 font-serif text-xl text-primary hover:text-accent transition leading-snug"
                  >
                    {a.title}
                  </Link>
                  <p className="mt-2 text-sm text-foreground/80">{a.authors}</p>
                  {a.abstract && (
                    <p className="mt-3 text-xs text-muted-foreground line-clamp-4">{a.abstract}</p>
                  )}
                  <Link
                    to="/article/$slug"
                    params={{ slug: a.slug }}
                    className="mt-auto pt-4 text-[11px] uppercase tracking-[0.2em] text-accent hover:text-primary"
                  >
                    Read article →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Inaugural Issue callout */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-accent">In This Issue</p>
        <h2 className="font-serif text-3xl sm:text-4xl text-primary mt-2">Rolling Publication</h2>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          New manuscripts are continuously under review. Published articles appear in the Library as
          soon as they clear review.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/submit"
            className="px-5 py-2.5 bg-accent text-accent-foreground text-xs uppercase tracking-[0.2em] hover:opacity-90 transition"
          >
            Submit a Manuscript
          </Link>
          <Link
            to="/archive"
            className="px-5 py-2.5 border border-primary text-primary text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition"
          >
            View Library
          </Link>
        </div>
      </section>

      {/* Three pillars */}
      <section className="bg-secondary border-y border-border">
        <div className="mx-auto max-w-6xl px-6 py-16 grid gap-10 md:grid-cols-3 text-center">
          <Pillar
            n="01"
            title="Every Discipline"
            body="Whether it be sciences or literature, we welcome all types and disciplines of research"
          />
          <Pillar
            n="02"
            title="Peer-Reviewed"
            body="Every manuscript is evaluated by reviewers and our sectional editors before publication."
          />
          <Pillar
            n="03"
            title="Rolling Publication"
            body="Accepted manuscripts are published as soon as they clear review — no artificial issue deadlines."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-serif text-3xl sm:text-4xl text-primary">Have research to share?</h2>
        <p className="mt-4 text-muted-foreground">
          Submissions are open year-round. Send your manuscript, supplemental files, and a short
          author note.
        </p>
        <Link
          to="/submit"
          className="inline-block mt-6 px-6 py-3 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
        >
          Apply for Publication
        </Link>
      </section>

      {/* Join the Editorial Team */}
      <section className="border-t border-border bg-secondary">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">
            Editorial Opportunities
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl text-primary mt-2">
            Apply to Join Our Editorial Team
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Editors at NYRJ evaluate manuscripts, manage review, and ensure every published article
            meets standards of clarity, rigor, and prestige. We are not looking for students with
            world class research, we are looking for students interested to learn, share and lead
            the world towards the future.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/editors"
              className="px-5 py-2.5 bg-accent text-accent-foreground text-xs uppercase tracking-[0.2em] hover:opacity-90 transition"
            >
              Learn More &amp; Apply
            </Link>
            <a
              href="mailto:NYRJINFO@gmail.com"
              className="px-5 py-2.5 border border-primary text-primary text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition"
            >
              Contact NYRJINFO@gmail.com
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function Pillar({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <p className="font-serif text-4xl text-accent">{n}</p>
      <h4 className="font-serif text-xl text-primary mt-2">{title}</h4>
      <p className="text-sm text-muted-foreground mt-2">{body}</p>
    </div>
  );
}
