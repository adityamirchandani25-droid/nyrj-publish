import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { getChapterBySlug } from "@/lib/ambassadors.functions";

const chapterQuery = (slug: string) =>
  queryOptions({
    queryKey: ["chapter", slug],
    queryFn: () => getChapterBySlug({ data: { slug } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/chapters/$slug")({
  loader: async ({ context, params }) => {
    const chapter = await context.queryClient.ensureQueryData(chapterQuery(params.slug));
    if (!chapter) throw notFound();
    return chapter;
  },
  head: ({ params, loaderData }) => {
    const name = loaderData
      ? `Chapter ${loaderData.chapter_number} — ${loaderData.school_name}`
      : "NYRJ Chapter";
    const desc =
      (loaderData?.about ?? "").slice(0, 155) ||
      "An official NYRJ chapter: a student-led research club advancing youth research.";
    const url = `https://nyrj.org/chapters/${params.slug}`;
    return {
      meta: [
        { title: `${name} — NYRJ Chapters` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — NYRJ Chapters` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
        ...(loaderData?.location ? [{ name: "geo.placename", content: loaderData.location }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: loaderData
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "EducationalOrganization",
                name: `NYRJ Chapter ${loaderData.chapter_number} — ${loaderData.school_name}`,
                url,
                description: loaderData.about ?? undefined,
                parentOrganization: {
                  "@type": "Organization",
                  name: "National Youth Research Journal",
                  url: "https://nyrj.org",
                },
                location: loaderData.location
                  ? { "@type": "Place", name: loaderData.location }
                  : undefined,
                employee: loaderData.chapter_lead
                  ? {
                      "@type": "Person",
                      name: loaderData.chapter_lead,
                      email: loaderData.chapter_lead_email ?? undefined,
                      jobTitle: "Chapter Lead",
                    }
                  : undefined,
              }),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Chapters",
                    item: "https://nyrj.org/chapters",
                  },
                  { "@type": "ListItem", position: 2, name, item: url },
                ],
              }),
            },
          ]
        : [],
    };
  },
  component: ChapterDetailPage,
  errorComponent: () => (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="font-serif text-3xl text-primary">Chapter unavailable</h1>
        <p className="mt-3 text-muted-foreground">Please try again in a moment.</p>
      </section>
    </SiteLayout>
  ),
  notFoundComponent: () => (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="font-serif text-3xl text-primary">Chapter not found</h1>
        <Link to="/chapters" className="mt-4 inline-block text-accent underline underline-offset-4">
          Back to all chapters
        </Link>
      </section>
    </SiteLayout>
  ),
});

function ChapterDetailPage() {
  const { slug } = Route.useParams();
  const { data: chapter } = useSuspenseQuery(chapterQuery(slug));
  if (!chapter) return null;

  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <Link
          to="/chapters"
          className="text-xs uppercase tracking-[0.2em] text-accent hover:underline"
        >
          ← All chapters
        </Link>
        <p className="mt-6 text-[10px] uppercase tracking-[0.35em] text-accent">
          Chapter {chapter.chapter_number}
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          {chapter.school_name}
        </h1>
        {chapter.location && <p className="mt-2 text-muted-foreground">{chapter.location}</p>}

        <div className="mt-10 border border-border bg-card p-6 flex flex-wrap gap-6 items-start">
          {chapter.lead_photo_url && (
            <img
              src={chapter.lead_photo_url}
              alt={`${chapter.chapter_lead ?? "Chapter lead"}, chapter lead of NYRJ Chapter ${chapter.chapter_number} at ${chapter.school_name}`}
              className="w-28 h-28 object-cover rounded-full border border-border"
              loading="lazy"
            />
          )}
          <div className="min-w-[200px]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Chapter Lead</p>
            <p className="font-serif text-2xl text-primary mt-1">{chapter.chapter_lead}</p>
            {chapter.chapter_lead_email && (
              <a
                href={`mailto:${chapter.chapter_lead_email}`}
                className="mt-2 inline-block text-sm text-accent underline underline-offset-4"
              >
                {chapter.chapter_lead_email}
              </a>
            )}
            {chapter.chapter_lead_2 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
                  Second Chapter Lead
                </p>
                <p className="font-serif text-xl text-primary mt-1">{chapter.chapter_lead_2}</p>
                {chapter.chapter_lead_2_email && (
                  <a
                    href={`mailto:${chapter.chapter_lead_2_email}`}
                    className="mt-1 inline-block text-sm text-accent underline underline-offset-4"
                  >
                    {chapter.chapter_lead_2_email}
                  </a>
                )}
              </div>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              New students this year:{" "}
              <span className="text-foreground font-semibold">
                {chapter.new_students_this_year}
              </span>
            </p>
            {chapter.chapter_lead_email && (
              <a
                href={`mailto:${chapter.chapter_lead_email}?subject=Joining%20NYRJ%20Chapter%20${chapter.chapter_number}`}
                className="mt-5 inline-block px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
              >
                Contact the chapter lead to join
              </a>
            )}
          </div>
        </div>

        {chapter.about && (
          <>
            <h2 className="font-serif text-2xl text-primary mt-12">About this chapter</h2>
            <p className="mt-3 text-foreground/85 leading-relaxed whitespace-pre-line">
              {chapter.about}
            </p>
          </>
        )}

        {chapter.notes && (
          <>
            <h2 className="font-serif text-2xl text-primary mt-10">Additional notes</h2>
            <p className="mt-3 text-muted-foreground italic whitespace-pre-line">{chapter.notes}</p>
          </>
        )}
      </article>
    </SiteLayout>
  );
}
