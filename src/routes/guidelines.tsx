import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  { q: "Who can submit to NYRJ?", a: "Any student from middle school through medical school may submit research to NYRJ. We welcome solo and co-authored work across every discipline." },
  { q: "Is NYRJ open access?", a: "Yes. Every published manuscript is freely available to read, download, and cite at no cost to readers or authors. We do not charge submission, review, or publication fees." },
  { q: "What file format should I submit in?", a: "Submit your manuscript as a Microsoft Word document (.doc or .docx). Word lets our reviewers, section editors, and copy editors leave tracked changes and comments throughout review. Keep working in Word until final submission — we will notify you at that point if a PDF version is needed." },
  { q: "How long does the review process take?", a: "We aim to send a first response within 5 days of submission, and a first decision within roughly two weeks. Accepted manuscripts are published on a rolling basis as soon as they clear review." },
  { q: "What types of submissions do you accept?", a: "Research Papers, Research Perspectives, Reviews, Theoretical Models, Meta-analyses, and other scholarly formats." },
  { q: "What citation style should I use?", a: "References must be in MLA or Vancouver style. Pick one and use it consistently throughout the manuscript." },
  { q: "What is your policy on AI-assisted writing?", a: "Generative AI may be used for spell-checking, light grammar polishing, or brainstorming, but AI-generated text presented as your own is plagiarism and will result in immediate rejection. You must disclose any AI use on the submission form." },
  { q: "Can I submit my paper to other journals at the same time?", a: "No. Concurrent (duplicate) submissions are a serious breach of academic publishing ethics. Withdraw your paper from any other venue before submitting to NYRJ." },
  { q: "Do you assign DOIs?", a: "Every published manuscript receives a permanent NYRJ identifier in the format SP-##### and a permanent URL. DOIs are added as our DOI registration program rolls out." },
  { q: "How do I cite an NYRJ article?", a: "Use the Copy Citation button on any article page — it produces a ready-to-paste APA-style reference with the title, authors, journal name, year, and permanent link." },
  { q: "I need help with my manuscript. Where do I start?", a: "Visit our Guidance page for video walkthroughs and to contact one of our advisors." },
];

export const Route = createFileRoute("/guidelines")({
  head: () => ({
    meta: [
      { title: "Author Guidelines — NYRJ" },
      { name: "description", content: "Formatting, structure, citation, and integrity guidelines for authors submitting to the National Youth Research Journal." },
      { name: "keywords", content: "student research paper guidelines, author guidelines student journal, how to format a research paper, APA student research, manuscript formatting guidelines, high school research writing" },
      { property: "og:title", content: "Author Guidelines — NYRJ" },
      { property: "og:description", content: "Formatting, structure, citation, and integrity requirements for NYRJ submissions." },
      { property: "og:url", content: "https://nyrj.org/guidelines" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/guidelines" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: Guidelines,
});

function Guidelines() {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">For Authors</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          Author Guidelines
        </h1>
        <p className="mt-4 text-muted-foreground">
          Before submitting to NYRJ, please make sure your manuscript meets the following formatting,
          structural, and integrity requirements. Manuscripts that do not follow these guidelines may
          be returned without review.
        </p>

        {/* Formatting */}
        <section className="mt-12 border-t-2 border-primary pt-8">
          <h3 className="font-serif text-2xl sm:text-3xl text-primary">Formatting</h3>
          <ul className="mt-4 space-y-2 text-sm text-foreground/90 list-disc pl-5">
            <li><strong>Regular text:</strong> 12&nbsp;pt Aptos.</li>
            <li><strong>Captions</strong> (tables, graphs, images): 14&nbsp;pt Aptos.</li>
            <li><strong>Subtitles / section headings:</strong> 16&nbsp;pt Aptos <em>bold</em>.</li>
            <li><strong>Main title:</strong> noticeably larger than the rest of the manuscript (we recommend ~22–28&nbsp;pt, bold).</li>
            <li>Use single column layout, 1.15–1.5 line spacing, and standard margins (1&nbsp;inch).</li>
            <li><strong>File format:</strong> submit as a Microsoft Word document (.doc / .docx) so editors can track changes; stay in Word until final submission, when we will notify you if a PDF is needed.</li>
          </ul>

        </section>

        {/* Structure */}
        <section className="mt-12 border-t border-border pt-8">
          <h3 className="font-serif text-2xl sm:text-3xl text-primary">Manuscript Structure</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Manuscripts should follow this order (sections in parentheses are optional or context dependent):
          </p>
          <ol className="mt-4 space-y-2 text-sm text-foreground/90 list-decimal pl-5">
            <li>Introduction</li>
            <li>Abstract</li>
            <li>Methods / Methodology</li>
            <li>Data <span className="text-muted-foreground">(may be a separate section from Methods)</span></li>
            <li>Data Analysis and Discussion <span className="text-muted-foreground">(Results)</span></li>
            <li>Conclusions</li>
            <li>Sources</li>
            <li>References in <strong>MLA</strong> format (minimum, in the order above) <em>or</em> <strong>Vancouver</strong> style</li>
          </ol>
        </section>

        {/* Integrity */}
        <section className="mt-12 border-t border-border pt-8">
          <h3 className="font-serif text-2xl sm:text-3xl text-primary">Research Integrity</h3>
          <div className="mt-4 border border-destructive/40 bg-destructive/5 p-5 text-sm text-foreground/90 leading-relaxed space-y-3">
            <p>
              <strong>Plagiarism of any kind — copying another author's work, paraphrasing without attribution,
              or submitting AI-generated content as your own — will result in immediate rejection
              of the manuscript and may lead to further consequences,</strong> including being barred from
              future submissions to NYRJ.
            </p>
            <p>
              <strong>You may not submit the same manuscript to NYRJ and another journal at the same time.</strong>
              Concurrent submissions (also called <em>duplicate submissions</em>) are a serious breach of
              academic publishing ethics. Your manuscript must be exclusive to NYRJ throughout our review
              process. If it is also under review elsewhere, withdraw it from the other venue first.
            </p>
          </div>
        </section>

        {/* Quick reminders */}
        <section className="mt-12 border-t border-border pt-8">
          <h3 className="font-serif text-2xl sm:text-3xl text-primary">Quick Checklist</h3>
          <ul className="mt-4 space-y-2 text-sm text-foreground/90 list-disc pl-5">
            <li>Manuscript is in Aptos at the sizes listed above.</li>
            <li>All sections are present and in the correct order.</li>
            <li>All sources are cited in MLA or Vancouver style.</li>
            <li>The work is original and has not been submitted elsewhere.</li>
            <li>No AI-generated text is presented as your own writing.</li>
            <li>Author name, grade, and school are included on the title page.</li>
          </ul>
        </section>

        {/* Journal Metrics */}
        <section className="mt-12 border-t border-border pt-8">
          <h3 className="font-serif text-2xl sm:text-3xl text-primary">Journal Metrics</h3>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Metric n="5 days" label="Time to first response" />
            <Metric n="~14 days" label="Time to first decision" />
            <Metric n="~30 days" label="Time to publication after acceptance" />
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12 border-t border-border pt-8">
          <h3 className="font-serif text-2xl sm:text-3xl text-primary">Frequently Asked Questions</h3>
          <div className="mt-6 space-y-6 text-sm text-foreground/90 leading-relaxed">
            <FAQ q="Who can submit to NYRJ?">
              Any student from middle school through medical school may submit research to NYRJ. We
              welcome solo and co-authored work across every discipline.
            </FAQ>
            <FAQ q="Is NYRJ open access?">
              Yes. Every published manuscript is freely available to read, download, and cite at
              no cost to readers or authors. We do not charge submission, review, or publication fees.
            </FAQ>
            <FAQ q="How long does the review process take?">
              We aim to send a first response within <strong>5 days</strong> of submission, and a
              first decision within roughly two weeks. Accepted manuscripts are published on a
              rolling basis as soon as they clear review.
            </FAQ>
            <FAQ q="What types of submissions do you accept?">
              Research Papers, Research Perspectives, Reviews, Theoretical Models, Meta-analyses,
              and other scholarly formats. If you are unsure where your work fits, choose "Other"
              on the submission form and we will categorize it.
            </FAQ>
            <FAQ q="What citation style should I use?">
              References must be in <strong>MLA</strong> or <strong>Vancouver</strong> style. Pick
              one and use it consistently throughout the manuscript.
            </FAQ>
            <FAQ q="What is your policy on AI-assisted writing?">
              Generative AI may be used for spell-checking, light grammar polishing, or
              brainstorming, but <strong>AI-generated text presented as your own is plagiarism</strong>
              and will result in immediate rejection. You must disclose any AI use on the submission form.
            </FAQ>
            <FAQ q="Can I submit my paper to other journals at the same time?">
              No. Concurrent (duplicate) submissions are a serious breach of academic publishing
              ethics. Withdraw your paper from any other venue before submitting to NYRJ.
            </FAQ>
            <FAQ q="Do you assign DOIs?">
              Every published manuscript receives a permanent NYRJ identifier in the format
              <code className="mx-1 px-1.5 py-0.5 bg-secondary text-foreground/90 text-xs">SP-#####</code>
              and a permanent URL. DOIs are added as our DOI registration program rolls out.
            </FAQ>
            <FAQ q="How do I cite an NYRJ article?">
              Use the <em>Copy Citation</em> button on any article page — it produces a ready-to-paste
              APA-style reference with the title, authors, journal name, year, and permanent link.
            </FAQ>
            <FAQ q="I need help with my manuscript. Where do I start?">
              Visit our <Link to="/guidance" className="text-accent underline underline-offset-2">Guidance</Link>
              {" "}page for video walkthroughs and to contact one of our advisors.
            </FAQ>
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link to="/submit" className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition">
            Submit a Manuscript
          </Link>
          <Link to="/editors" className="px-5 py-2.5 border border-primary text-primary text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition">
            See the Editing Process
          </Link>
        </div>
      </article>
    </SiteLayout>
  );
}

function Metric({ n, label }: { n: string; label: string }) {
  return (
    <div className="border border-border bg-card p-4 text-center">
      <p className="font-serif text-2xl text-accent">{n}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    </div>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="border border-border bg-card group">
      <summary className="cursor-pointer list-none px-4 py-3 font-serif text-lg text-primary flex items-center justify-between gap-3 hover:bg-secondary transition">
        <span>{q}</span>
        <span className="text-accent text-sm group-open:rotate-45 transition-transform">+</span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-foreground/90 leading-relaxed">{children}</div>
    </details>
  );
}
