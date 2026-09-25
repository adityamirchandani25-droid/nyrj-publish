import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { getArticleBySlug, incrementCitation, type ArticleRow } from "@/lib/articles.functions";

const SITE_URL = "https://nyrj.org";
const JOURNAL_TITLE = "National Youth Research Journal (NYRJ)";

function splitAuthors(authors: string): string[] {
  return authors
    .split(/\s*(?:,|;| and | & )\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Formats an APA-style journal reference citation. */
function formatCitation(a: ArticleRow): string {
  const year = (a.publication_date ?? a.added_at).slice(0, 4);
  const authorList = splitAuthors(a.authors);
  const apaAuthors = authorList
    .map((full) => {
      const parts = full.trim().split(/\s+/);
      if (parts.length === 1) return parts[0];
      const last = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map((p) => `${p[0]?.toUpperCase()}.`).join(" ");
      return `${last}, ${initials}`;
    })
    .join(", ");
  const issuePart = a.issue ? `, ${a.issue}` : "";
  const doiPart = a.doi ? ` https://doi.org/${a.doi}` : ` ${SITE_URL}/article/${a.slug}`;
  return `${apaAuthors} (${year}). ${a.title}. ${JOURNAL_TITLE}${issuePart}.${doiPart}`;
}

const articleQuery = (slug: string) =>
  queryOptions({
    queryKey: ["article", slug],
    queryFn: () => getArticleBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/article/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(articleQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Article — NYRJ" }] };
    const a = loaderData as ArticleRow;
    const url = `${SITE_URL}/article/${params.slug}`;
    const pdfUrl = `${SITE_URL}/api/public/article/${params.slug}/pdf`;
    const pubDate = (a.publication_date ?? a.added_at).slice(0, 10);
    const authors = splitAuthors(a.authors);
    const descSource = a.abstract ?? `${a.title} by ${a.authors}. Published in ${JOURNAL_TITLE}.`;
    const description = descSource.length > 160 ? descSource.slice(0, 157) + "…" : descSource;

    const meta: Array<Record<string, string>> = [
      { title: `${a.title} — NYRJ` },
      { name: "description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:title", content: a.title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: a.title },
      { name: "twitter:description", content: description },
      { name: "citation_title", content: a.title },
      { name: "citation_journal_title", content: JOURNAL_TITLE },
      { name: "citation_journal_abbrev", content: "NYRJ" },
      // Scholar's documented format is YYYY/MM/DD.
      { name: "citation_publication_date", content: pubDate.replace(/-/g, "/") },
      { name: "citation_online_date", content: pubDate.replace(/-/g, "/") },
      { name: "citation_year", content: pubDate.slice(0, 4) },
      { name: "citation_pdf_url", content: pdfUrl },
      { name: "citation_abstract_html_url", content: url },
      { name: "citation_fulltext_html_url", content: url },
      { name: "citation_language", content: "en" },
      { name: "citation_issn", content: "3143-3030" },
      ...authors.map((author) => ({ name: "citation_author", content: author })),
      ...(a.doi ? [{ name: "citation_doi", content: a.doi }] : []),
      ...(a.abstract ? [{ name: "citation_abstract", content: a.abstract }] : []),
      ...(a.keywords && a.keywords.length
        ? [{ name: "citation_keywords", content: a.keywords.join("; ") }]
        : []),
      ...(a.issue ? [{ name: "citation_issue", content: a.issue }] : []),
      { name: "citation_publisher", content: JOURNAL_TITLE },
      // Signals full open access to Google Scholar's crawler.
      { name: "citation_fulltext_world_readable", content: "" },
      { name: "dc.title", content: a.title },
      { name: "dc.publisher", content: JOURNAL_TITLE },
      { name: "dc.date", content: pubDate },
      { name: "dc.language", content: "en" },
      { name: "dc.type", content: "Text.Article" },
      { name: "dc.format", content: "application/pdf" },
      { name: "dc.source", content: JOURNAL_TITLE },
      { name: "dc.rights", content: "Open Access" },
      ...(a.abstract ? [{ name: "dc.description", content: a.abstract }] : []),
      ...authors.map((author) => ({ name: "dc.creator", content: author })),
      { name: "dc.identifier", content: url },
      ...(a.doi ? [{ name: "dc.identifier.doi", content: a.doi }] : []),
      ...(a.doi ? [{ name: "dc.relation", content: `https://doi.org/${a.doi}` }] : []),
    ];

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ScholarlyArticle",
            headline: a.title,
            name: a.title,
            datePublished: pubDate,
            author: authors.map((n) => ({ "@type": "Person", name: n })),
            isPartOf: { "@type": "Periodical", name: JOURNAL_TITLE, issn: "3143-3030" },
            abstract: a.abstract ?? undefined,
            keywords: a.keywords ?? undefined,
            inLanguage: "en",
            isAccessibleForFree: true,
            publisher: { "@type": "Organization", name: JOURNAL_TITLE, url: SITE_URL },
            ...(a.doi
              ? { identifier: `https://doi.org/${a.doi}`, sameAs: `https://doi.org/${a.doi}` }
              : {}),
            ...(a.issue ? { issueNumber: a.issue } : {}),
            encoding: { "@type": "MediaObject", contentUrl: pdfUrl, encodingFormat: "application/pdf" },
            url,
          }),
        },
      ],
    };
  },
  component: ArticlePage,
  notFoundComponent: () => (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl text-primary">Article not found</h1>
        <p className="mt-4 text-muted-foreground">
          We couldn&apos;t find that manuscript. It may have been moved.
        </p>
        <Link to="/archive" className="mt-6 inline-block text-accent underline underline-offset-4">
          ← Back to the Library
        </Link>
      </section>
    </SiteLayout>
  ),
  errorComponent: ({ error }) => (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl text-primary">Something went wrong</h1>
        <p className="mt-4 text-muted-foreground">{error.message}</p>
      </section>
    </SiteLayout>
  ),
});

function ArticlePage() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(articleQuery(params.slug));
  const a = data as ArticleRow;
  const authors = splitAuthors(a.authors);
  const pubDate = (a.publication_date ?? a.added_at).slice(0, 10);
  const pdfHref = `/api/public/article/${a.slug}/pdf`;
  const citation = formatCitation(a);

  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(a.citation_count ?? 0);
  const [showViewer, setShowViewer] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      try {
        const next = await incrementCitation({ data: { id: a.id } });
        if (typeof next === "number") setCount(next);
      } catch (err) {
        console.error("citation count failed:", err);
      }
    } catch {
      // Clipboard blocked
    }
  }

  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Research Article</p>
        <h1 className="font-serif text-3xl sm:text-4xl text-primary mt-3">
          {a.title}
          {a.award_winner && (
            <span
              className="ml-3 inline-block align-middle text-[10px] uppercase tracking-[0.2em] bg-primary text-primary-foreground px-2 py-0.5"
              title={a.award_label ?? "Award Winner"}
            >
              🏆 {a.award_label ?? "Award Winner"}
            </span>
          )}
        </h1>

        {a.doi && (
          <p className="mt-2 text-sm text-foreground/80">
            DOI:{" "}
            <a
              href={`https://doi.org/${a.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              {a.doi}
            </a>
          </p>
        )}

        <div className="mt-4 text-sm text-foreground/90">
          <p>
            {authors.map((name, i) => {
              const orcid = a.orcids?.[i];
              return (
                <span key={`${name}-${i}`}>
                  {i > 0 ? ", " : ""}
                  <span>{name}</span>
                  {orcid && (
                    <>
                      {" "}
                      <a
                        href={`https://orcid.org/${orcid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline underline-offset-2"
                      >
                        ORCID: {orcid}
                      </a>
                    </>
                  )}
                </span>
              );
            })}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>Published {new Date(pubDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
            {a.issue && <span> · {a.issue}</span>}
            <span> · {JOURNAL_TITLE}</span>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={pdfHref}
            className="inline-block px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
            rel="noopener"
            download={a.file_name}
          >
            Download PDF
          </a>
          <button
            type="button"
            onClick={() => setShowViewer((v) => !v)}
            className="inline-block px-5 py-2.5 border border-primary text-primary text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition"
          >
            {showViewer ? "Hide PDF" : "View PDF"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-block px-5 py-2.5 border border-accent text-accent text-xs uppercase tracking-[0.2em] hover:bg-accent hover:text-accent-foreground transition"
          >
            {copied ? "Copied!" : "Copy Citation"}
          </button>
          <span className="self-center text-xs text-muted-foreground">
            Cited {count} {count === 1 ? "time" : "times"}
          </span>
        </div>

        {showViewer && (
          <div className="mt-6 border border-border bg-card">
            <iframe
              src={a.signed_url || pdfHref}
              title={`${a.title} — PDF viewer`}
              className="w-full h-[85vh]"
            />
            <p className="px-3 py-2 text-[11px] text-muted-foreground">
              Trouble viewing?{" "}
              <a
                href={pdfHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2"
              >
                Open in a new tab
              </a>
              .
            </p>
          </div>
        )}

        {a.abstract && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-primary">Abstract</h2>
            <p className="mt-3 text-foreground/90 leading-relaxed whitespace-pre-wrap">{a.abstract}</p>
          </section>
        )}

        {a.keywords && a.keywords.length > 0 && (
          <section className="mt-8">
            <h2 className="font-serif text-xl text-primary">Keywords</h2>
            <p className="mt-2 text-sm text-foreground/90">{a.keywords.join(", ")}</p>
          </section>
        )}

        {(a.topic || a.grade) && (
          <section className="mt-8 flex flex-wrap gap-2">
            {a.topic && (
              <span className="text-[10px] uppercase tracking-[0.2em] border border-border px-2 py-0.5 text-foreground/80">
                {a.topic}
              </span>
            )}
            {a.grade && (
              <span className="text-[10px] uppercase tracking-[0.2em] border border-border px-2 py-0.5 text-foreground/80">
                Grade {a.grade}
              </span>
            )}
          </section>
        )}

        {a.references_text && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl text-primary">References</h2>
            <pre className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
              {a.references_text}
            </pre>
          </section>
        )}

        <section className="mt-10 border-t-2 border-primary pt-6">
          <h2 className="font-serif text-2xl text-primary">How to cite</h2>
          <p className="mt-3 text-sm text-foreground/90 leading-relaxed">{citation}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 text-xs uppercase tracking-[0.2em] text-accent hover:text-primary underline underline-offset-4"
          >
            {copied ? "Copied to clipboard ✓" : "Copy citation"}
          </button>
        </section>

        <p className="mt-12 text-xs text-muted-foreground">
          <Link to="/archive" className="text-accent underline underline-offset-4">← Back to the Library</Link>
        </p>
      </article>
    </SiteLayout>
  );
}
