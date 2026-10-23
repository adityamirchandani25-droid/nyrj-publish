import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";

const MANUSCRIPT_SECTIONS = [
  "Title Page",
  "Abstract",
  "Introduction",
  "Methods",
  "Data",
  "Data Analysis and Discussion",
  "Conclusions",
  "References (Approved Styles Listed Below)",
];

const REFERENCE_STYLES = [
  { discipline: "Social Sciences", style: "APA" },
  { discipline: "Humanities", style: "MLA" },
  { discipline: "Sciences", style: "CSE" },
  { discipline: "Engineering", style: "IEEE" },
];

export const Route = createFileRoute("/guidelines")({
  head: () => ({
    meta: [
      { title: "Author Guidelines — NYRJ" },
      {
        name: "description",
        content:
          "Official NYRJ manuscript structure, title-page format, reference styles, formatting requirements, and submission instructions.",
      },
      {
        name: "keywords",
        content:
          "NYRJ author guidelines, manuscript structure, research paper formatting, APA, MLA, CSE, IEEE, student research submission",
      },
      { property: "og:title", content: "Author Guidelines — NYRJ" },
      {
        property: "og:description",
        content:
          "Prepare an NYRJ manuscript using the required structure, title-page format, reference style, and submission format.",
      },
      { property: "og:url", content: "https://nyrj.org/guidelines" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/guidelines" }],
  }),
  component: Guidelines,
});

function Guidelines() {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">For Authors</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-primary sm:text-5xl">
          Author Guidelines
        </h1>
        <p className="mt-4 text-muted-foreground">
          Use these requirements when preparing your manuscript for the National Youth Research
          Journal. The official PDF and the guidance below contain the same formatting rules.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/docs/author-guidelines.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-block bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground transition hover:bg-accent"
          >
            Open Author Guidelines PDF
          </a>
          <a
            href="/docs/author-guidelines.pdf"
            download="NYRJ-Author-Guidelines.pdf"
            className="inline-block border border-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            Download PDF
          </a>
        </div>

        <section className="mt-12 border-t-2 border-primary pt-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Required Order</p>
          <h2 className="mt-2 font-serif text-2xl text-primary sm:text-3xl">
            Manuscript Structure
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Manuscripts should be structured in the following order:
          </p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {MANUSCRIPT_SECTIONS.map((section, index) => (
              <li key={section} className="flex gap-3 border border-border bg-card p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-sm text-primary-foreground">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm font-medium text-foreground">{section}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Use This Template</p>
          <h2 className="mt-2 font-serif text-2xl text-primary sm:text-3xl">Title Page Format</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Present the title page in the exact format shown below.
          </p>
          <div className="mt-5 border-l-4 border-accent bg-card p-5 text-sm leading-7 text-foreground sm:p-6">
            <p className="font-bold">[Title]</p>
            <p className="mt-3">
              <strong>Main Author:</strong> [Name] (ORCID: [number])
            </p>
            <p>
              <strong>Corresponding Author:</strong> [Name], ORCID: [number], [Institution],
              [email], [phone number]
            </p>
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">
            Discipline-Specific Citations
          </p>
          <h2 className="mt-2 font-serif text-2xl text-primary sm:text-3xl">
            Approved Reference Styles
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {REFERENCE_STYLES.map(({ discipline, style }) => (
              <div
                key={discipline}
                className="flex items-center justify-between gap-4 border border-border bg-card px-5 py-4"
              >
                <span className="text-sm font-medium text-foreground">{discipline}</span>
                <span className="font-serif text-xl text-accent">{style}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Document Setup</p>
          <h2 className="mt-2 font-serif text-2xl text-primary sm:text-3xl">
            Formatting Requirements
          </h2>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-foreground/90">
            <li className="border border-border bg-card p-4">
              <strong>Font:</strong> Use a serif font, such as Times New Roman or Georgia, at 12 pt.
            </li>
            <li className="border border-border bg-card p-4">
              <strong>Headings and titles:</strong> All titles and subtitles must be bold.
            </li>
            <li className="border border-border bg-card p-4">
              <strong>Layout and spacing:</strong> Use a single-column layout with double line
              spacing (2.0).
            </li>
          </ul>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="border-2 border-primary bg-card p-6 sm:p-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Submission Format</p>
            <h2 className="mt-2 font-serif text-2xl text-primary sm:text-3xl">
              Submit both PDF and Word files
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              Upload a matching <strong>PDF</strong> and editable{" "}
              <strong>Word (.doc or .docx)</strong> file for your submission and each revision.
              Remove author names and personal details from review copies.
            </p>
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-serif text-2xl text-primary sm:text-3xl">Before You Submit</h2>
          <ul className="mt-5 space-y-2 text-sm text-foreground/90">
            <ChecklistItem>All eight manuscript sections are present and in order.</ChecklistItem>
            <ChecklistItem>The title page follows the required format exactly.</ChecklistItem>
            <ChecklistItem>
              References use APA, MLA, CSE, or IEEE according to the manuscript&apos;s discipline.
            </ChecklistItem>
            <ChecklistItem>The manuscript uses a 12 pt serif font.</ChecklistItem>
            <ChecklistItem>Titles and subtitles are bold.</ChecklistItem>
            <ChecklistItem>The document is single-column and double-spaced.</ChecklistItem>
            <ChecklistItem>
              The final PDF is ready, and the editable .docx file has been retained.
            </ChecklistItem>
          </ul>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/submit"
            className="bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground transition hover:bg-accent"
          >
            Submit a Manuscript
          </Link>
          <Link
            to="/editors"
            className="border border-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            See the Editing Process
          </Link>
        </div>
      </article>
    </SiteLayout>
  );
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 font-semibold text-accent">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}
