import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { listChapters } from "@/lib/ambassadors.functions";

const chaptersQuery = queryOptions({
  queryKey: ["chapters"],
  queryFn: () => listChapters(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/chapters")({
  loader: ({ context }) => context.queryClient.ensureQueryData(chaptersQuery),
  head: () => ({
    meta: [
      { title: "NYRJ Chapters — School Clubs & Chapter Leads" },
      {
        name: "description",
        content:
          "Explore official NYRJ chapters: student-led clubs advancing youth research at schools around the world.",
      },
      {
        name: "keywords",
        content:
          "NYRJ chapters, student research clubs, high school research club, start a research chapter, school research programs",
      },
      { property: "og:title", content: "NYRJ Chapters" },
      {
        property: "og:description",
        content: "Student-led NYRJ chapters advancing youth research.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://nyrj.org/chapters" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/chapters" }],
  }),
  component: ChaptersPage,
});

function ChaptersPage() {
  const { data: chapters } = useSuspenseQuery(chaptersQuery);
  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">NYRJ Chapters</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          Chapters &amp; School Clubs
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl">
          NYRJ chapters are student-led clubs that bring the journal's mission — youth research,
          every discipline — into schools everywhere. Below is our current list of registered
          chapters. NYRJ is a peer-reviewed, open-access journal, and every chapter is free to start
          and free to join.
        </p>

        <div className="mt-6 border border-border bg-card p-5 flex flex-wrap items-center gap-4">
          <p className="text-sm text-foreground/90 flex-1 min-w-[240px]">
            Want a chapter at your school? Email{" "}
            <a
              href="mailto:NYRJINFO@GMAIL.COM"
              className="text-accent underline underline-offset-2"
            >
              NYRJINFO@GMAIL.COM
            </a>{" "}
            to start a chapter.
          </p>
          <a
            href="mailto:NYRJINFO@GMAIL.COM?subject=Starting%20an%20NYRJ%20Chapter"
            className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
          >
            Email us to start a chapter
          </a>
        </div>

        {chapters.length === 0 ? (
          <p className="mt-10 border border-border bg-card p-6 text-sm text-muted-foreground">
            No chapters have registered yet. Check back soon.
          </p>
        ) : (
          <ul className="mt-10 space-y-4">
            {chapters.map((c) => (
              <li key={c.id} className="border border-border bg-card p-5 flex gap-5 items-start">
                {c.lead_photo_url && (
                  <img
                    src={c.lead_photo_url}
                    alt={`${c.chapter_lead ?? "Chapter lead"}, chapter lead at ${c.school_name}`}
                    className="w-16 h-16 object-cover rounded-full border border-border shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-serif text-2xl text-primary">
                      Chapter {c.chapter_number}
                    </span>
                    <span className="text-lg">— {c.school_name}</span>
                    {c.location && (
                      <span className="text-sm text-muted-foreground">· {c.location}</span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-foreground/85 space-y-1">
                    {c.chapter_lead && (
                      <p>
                        <span className="uppercase tracking-[0.18em] text-[10px] text-accent mr-2">
                          Chapter Lead
                        </span>
                        {c.chapter_lead}
                        {c.chapter_lead_email && (
                          <>
                            {" "}
                            <a
                              href={`mailto:${c.chapter_lead_email}`}
                              className="text-accent underline underline-offset-2"
                            >
                              {c.chapter_lead_email}
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    {c.chapter_lead_2 && (
                      <p>
                        <span className="uppercase tracking-[0.18em] text-[10px] text-accent mr-2">
                          Second Chapter Lead
                        </span>
                        {c.chapter_lead_2}
                        {c.chapter_lead_2_email && (
                          <>
                            {" "}
                            <a
                              href={`mailto:${c.chapter_lead_2_email}`}
                              className="text-accent underline underline-offset-2"
                            >
                              {c.chapter_lead_2_email}
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    <p>
                      <span className="uppercase tracking-[0.18em] text-[10px] text-accent mr-2">
                        New Students This Year
                      </span>
                      {c.new_students_this_year}
                    </p>
                    {c.about && <p className="text-muted-foreground line-clamp-2">{c.about}</p>}
                  </div>
                  {c.slug && (
                    <Link
                      to="/chapters/$slug"
                      params={{ slug: c.slug }}
                      className="mt-3 inline-block text-xs uppercase tracking-[0.2em] text-accent hover:underline"
                    >
                      Learn more &amp; join →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteLayout>
  );
}
