import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — NYRJ" },
      {
        name: "description",
        content:
          "How the National Youth Research Journal collects, uses, and protects the information you share with us.",
      },
      { property: "og:title", content: "Privacy Policy — NYRJ" },
      {
        property: "og:description",
        content:
          "NYRJ does not sell or share your personal information. Read our full privacy policy.",
      },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Legal</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Last Updated: July 5, 2026
        </p>

        <section className="mt-10 space-y-5 text-sm sm:text-base text-foreground/90 leading-relaxed">
          <h2 className="font-serif text-2xl text-primary mt-8">How We Use Your Information</h2>

          <p>
            At NYRJ, we collect only the information necessary to publish, review, and preserve
            scholarly research. Every piece of information you provide serves a specific purpose in
            helping us operate the journal professionally and transparently.
          </p>

          <p>
            When you submit a manuscript, we use your information to communicate with you throughout
            the editorial process, coordinate peer review, process revisions, notify you of
            editorial decisions, and prepare accepted articles for publication.
          </p>

          <p>
            If your manuscript is accepted, certain information may appear publicly alongside your
            published article to ensure proper academic attribution and allow readers to accurately
            identify and cite your work. This information may include your name, institutional or
            school affiliation, ORCID iD (if provided), author biography, publication date, and
            other standard article metadata.
          </p>

          <p>
            Your email address is used only for journal-related communication, such as submission
            confirmations, editorial correspondence, revision requests, publication notifications,
            or responses to questions you send us. Unless you specifically request otherwise as a
            corresponding author, your email address is not displayed publicly with your article.
          </p>

          <p>
            To improve our website, we may collect limited technical information such as browser
            type, device information, pages visited, and general usage statistics. This information
            helps us identify technical issues, improve accessibility, and provide a better
            experience for our readers and authors. Whenever possible, this information is collected
            in an aggregated or anonymized form.
          </p>

          <p>
            Most importantly, we do not sell, rent, trade, or otherwise monetize your personal
            information. We do not share your information with advertisers, marketing companies, or
            unrelated third parties.
          </p>

          <p>
            Your unpublished manuscript remains confidential throughout the editorial process. It is
            shared only with authorized editors and assigned peer reviewers when necessary to
            evaluate your submission. We will never publish, distribute, or use your unpublished
            research without your permission, nor do we claim ownership of your intellectual
            property.
          </p>

          <p>
            Our commitment is simple: your information is used only to support the publication of
            your research and the operation of the National Youth Research Journal.
          </p>

          <h2 className="font-serif text-2xl text-primary mt-8">Contact Us</h2>

          <p>
            If you have any questions about this Privacy Policy or how your information is handled,
            please contact the NYRJ Editorial Office. We welcome your questions and are always happy
            to clarify our policies or address any concerns.
          </p>

          <p>
            The National Youth Research Journal was founded on the principles of academic integrity,
            transparency, and respect for every researcher. Whether you are submitting your first
            manuscript or your tenth, we are committed to protecting your privacy, respecting your
            intellectual property, and providing a safe and professional publishing experience.
          </p>

          <p>
            As NYRJ continues to grow, our Privacy Policy may occasionally be updated to reflect
            improvements to our journal, website, editorial practices, or applicable legal
            requirements. Any changes will be posted on this page along with the date of the latest
            revision.
          </p>

          <p>
            We encourage our authors, reviewers, and readers to review this page periodically so
            they remain informed about how their information is collected, used, and protected.
          </p>

          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground pt-6 border-t border-border">
            Last Updated: July 5, 2026
          </p>
        </section>
      </article>
    </SiteLayout>
  );
}
