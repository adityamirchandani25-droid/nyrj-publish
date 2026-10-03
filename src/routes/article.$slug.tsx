import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { getArticleBySlug, type ArticleRow } from "@/lib/articles.functions";
import {
  buildCitationBundle,
  normalizedDoi,
  splitAuthors,
  type CitationBundle,
} from "@/lib/citation-formats";
import { generateArticleCitations } from "@/lib/citation-generator.functions";

const SITE_URL = "https://nyrj.org";
const JOURNAL_TITLE = "National Youth Research Journal (NYRJ)";

const CITATION_STYLES: Array<{ key: keyof CitationBundle; label: string }> = [
  { key: "apa", label: "APA 7" },
  { key: "mla", label: "MLA 9" },
  { key: "chicago", label: "Chicago" },
  { key: "bibtex", label: "BibTeX" },
  { key: "ris", label: "RIS" },
];

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
    const doi = normalizedDoi(a.doi);
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
      ...(doi ? [{ name: "citation_doi", content: doi }] : []),
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
      ...(doi ? [{ name: "dc.identifier.doi", content: doi }] : []),
      ...(doi ? [{ name: "dc.relation", content: `https://doi.org/${doi}` }] : []),
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
            ...(doi
              ? { identifier: `https://doi.org/${doi}`, sameAs: `https://doi.org/${doi}` }
              : {}),
            ...(a.issue ? { issueNumber: a.issue } : {}),
            encoding: {
              "@type": "MediaObject",
              contentUrl: pdfUrl,
              encodingFormat: "application/pdf",
            },
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
        <p className="mt-4 text-muted-foreground">
          {error instanceof Error ? error.message : "Please try again."}
        </p>
      </section>
    </SiteLayout>
  ),
});

function ArticlePage() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(articleQuery(params.slug));
  const a = data as ArticleRow;
  const authors = splitAuthors(a.authors);
  const doi = normalizedDoi(a.doi);
  const pubDate = (a.publication_date ?? a.added_at).slice(0, 10);
  const pdfHref = `/api/public/article/${a.slug}/pdf`;
  const apaPreview = buildCitationBundle(a).apa;

  const [copied, setCopied] = useState(false);
  const count = a.citation_count ?? 0;
  const [showViewer, setShowViewer] = useState(false);
  const [citations, setCitations] = useState<CitationBundle | null>(null);
  const [citationStyle, setCitationStyle] = useState<keyof CitationBundle>("apa");
  const [citationLoading, setCitationLoading] = useState(false);
  const [citationError, setCitationError] = useState("");

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked
    }
  }

  async function handleGenerateCitations() {
    setCitationLoading(true);
    setCitationError("");
    try {
      const bundle = await generateArticleCitations({ data: { id: a.id } });
      setCitations(bundle);
    } catch (error) {
      console.error("citation generation failed:", error);
      setCitationError("Citations could not be generated right now. Please try again.");
    } finally {
      setCitationLoading(false);
    }
  }

  function handleDownload(style: "bibtex" | "ris") {
    if (!citations) return;
    const extension = style === "bibtex" ? "bib" : "ris";
    const blob = new Blob([citations[style]], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${a.slug}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
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

        {doi && (
          <p className="mt-2 text-sm text-foreground/80">
            DOI:{" "}
            <a
              href={`https://doi.org/${doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              {doi}
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
            <span>
              Published{" "}
              {new Date(pubDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
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
            onClick={() =>
              document.getElementById("cite-this-article")?.scrollIntoView({ behavior: "smooth" })
            }
            className="inline-block px-5 py-2.5 border border-accent text-accent text-xs uppercase tracking-[0.2em] hover:bg-accent hover:text-accent-foreground transition"
          >
            Cite This Article
          </button>
          <span className="self-center text-xs text-muted-foreground">
            Indexed citations: {count}
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
            <p className="mt-3 text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {a.abstract}
            </p>
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

        <section
          id="cite-this-article"
          className="mt-10 scroll-mt-24 border-t-2 border-primary pt-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl text-primary">Cite this article</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Generate verified APA, MLA, Chicago, BibTeX, and RIS citations from this
                article&apos;s published metadata.
              </p>
            </div>
            {!citations && (
              <button
                type="button"
                onClick={handleGenerateCitations}
                disabled={citationLoading}
                className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] transition hover:bg-accent disabled:cursor-wait disabled:opacity-60"
              >
                {citationLoading ? "Generating…" : "Generate Citations"}
              </button>
            )}
          </div>

          {citationError && (
            <div
              className="mt-4 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {citationError}
            </div>
          )}

          {!citations && !citationError && (
            <div className="mt-5 border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                APA preview
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{apaPreview}</p>
            </div>
          )}

          {citations && (
            <div className="mt-5">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Citation format">
                {CITATION_STYLES.map((style) => (
                  <button
                    key={style.key}
                    type="button"
                    role="tab"
                    aria-selected={citationStyle === style.key}
                    onClick={() => {
                      setCitationStyle(style.key);
                      setCopied(false);
                    }}
                    className={`border px-3 py-2 text-[10px] uppercase tracking-[0.2em] transition ${
                      citationStyle === style.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:border-accent hover:text-accent"
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>

              <div
                className="mt-3 border border-border bg-card p-4"
                role="tabpanel"
                aria-label={`${CITATION_STYLES.find((style) => style.key === citationStyle)?.label} citation`}
              >
                {citationStyle === "bibtex" || citationStyle === "ris" ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/90">
                    {citations[citationStyle]}
                  </pre>
                ) : (
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {citations[citationStyle]}
                  </p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleCopy(citations[citationStyle])}
                  className="text-xs uppercase tracking-[0.2em] text-accent underline underline-offset-4 hover:text-primary"
                >
                  {copied ? "Copied to clipboard ✓" : "Copy citation"}
                </button>
                {(citationStyle === "bibtex" || citationStyle === "ris") && (
                  <button
                    type="button"
                    onClick={() => handleDownload(citationStyle)}
                    className="text-xs uppercase tracking-[0.2em] text-accent underline underline-offset-4 hover:text-primary"
                  >
                    Download .{citationStyle === "bibtex" ? "bib" : "ris"}
                  </button>
                )}
                <span className="text-xs text-muted-foreground">
                  Checked against the article&apos;s published metadata.
                </span>
              </div>
            </div>
          )}
        </section>

        <p className="mt-12 text-xs text-muted-foreground">
          <Link to="/archive" className="text-accent underline underline-offset-4">
            ← Back to the Library
          </Link>
        </p>
      </article>
    </SiteLayout>
  );
}
