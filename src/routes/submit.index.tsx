import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";

export const Route = createFileRoute("/submit/")({
  head: () => ({
    meta: [
      { title: "Submit a Manuscript — NYRJ" },
      {
        name: "description",
        content:
          "Start a submission to the National Youth Research Journal — what to prepare before opening the manuscript form.",
      },
      {
        name: "keywords",
        content:
          "submit student research, submit manuscript student journal, publish high school research, student research submission, youth research journal submission, publish student paper",
      },
      { property: "og:title", content: "Submit a Manuscript to NYRJ" },
      {
        property: "og:description",
        content: "What to have ready before submitting to the National Youth Research Journal.",
      },
      { property: "og:url", content: "https://nyrj.org/submit" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/submit" }],
  }),
  component: Submit,
});

function Submit() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Apply for Publication</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          Submit Your Manuscript
        </h1>

        <div className="mt-6 border-l-4 border-accent bg-accent/10 px-4 py-3 text-sm">
          <strong>Please log in first.</strong> You need a student account so your submission shows
          up in your tracker and we can email you status updates.{" "}
          <a href="/login" className="text-primary underline underline-offset-4">
            Create / log in to your account →
          </a>
        </div>

        <p className="mt-4 text-muted-foreground max-w-2xl">
          Submissions are open to students of any and all ages, on any topic. Please have these
          ready before you start:
        </p>

        <ul className="mt-6 grid gap-2 sm:grid-cols-2 text-sm">
          {[
            "Manuscript as a Microsoft Word document (.doc / .docx)",
            "Any additional files (data, figures, code) with descriptions",
            "Author details (name, email, institution, ORCID)",
            "Abstract & research type",
            "Conflict of interest, funding, and AI-use disclosures",
          ].map((r) => (
            <li key={r} className="border border-border bg-card px-3 py-2">
              <span className="text-accent mr-2">§</span>
              {r}
            </li>
          ))}
        </ul>

        <div className="mt-8 border border-border bg-card px-4 py-4 text-sm">
          <p>
            <strong>Submit in Microsoft Word.</strong> All manuscripts must be sent to us as a
            Microsoft Word document (.doc / .docx) so our reviewers, section editors, and copy
            editors can leave tracked comments and edits throughout the review process. Please keep
            working in Word until your paper reaches final submission — at that stage we will notify
            you and let you know when a PDF version is required.
          </p>
        </div>

        <div className="mt-10 border-t-2 border-primary pt-6">
          <h3 className="font-serif text-2xl text-primary mb-4">Start Your Submission</h3>
          <p className="text-muted-foreground mb-6">
            Everything happens right here on nyrj.org — no Google Forms, no third-party tools.
            Complete the three-step form (files, declarations, then manuscript details). Your
            submission is delivered straight to the NYRJ editorial office.
          </p>

          <a
            href="/submit/apply"
            className="inline-block px-6 py-3 bg-accent text-accent-foreground text-xs uppercase tracking-[0.2em] hover:opacity-90 transition"
          >
            Open Submission Form →
          </a>

          <p className="mt-6 text-xs text-muted-foreground italic">
            Trouble with the form? Email{" "}
            <a
              href="mailto:NYRJINFO@gmail.com"
              className="text-primary underline underline-offset-2"
            >
              NYRJINFO@gmail.com
            </a>
            .
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
