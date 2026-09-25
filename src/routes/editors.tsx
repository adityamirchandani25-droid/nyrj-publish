import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";


export const Route = createFileRoute("/editors")({
  head: () => ({
    meta: [
      { title: "Peer Review & Editing Process — NYRJ" },
      { name: "description", content: "How NYRJ peer review works: initial reviewer, section editor, author revision, and copy editor — plus how to apply as an editor." },
      { property: "og:title", content: "NYRJ Peer Review & Editing Process" },
      { property: "og:description", content: "The full path a manuscript takes at NYRJ, from initial review through publication." },
      { property: "og:url", content: "https://nyrj.org/editors" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/editors" }],
  }),
  component: Editors,
});

function Editors() {


  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">EDITORIAL STAGE</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          Peer Review & Editing Process
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl">
          The <em>National Youth Research Journal</em> is a <strong>peer-reviewed</strong> publication.
          Every manuscript undergoes evaluation by a series of reviewers before
          acceptance. Below is the full path a manuscript takes starting from submission to publication. The entire process is usually 2-3 weeks. However, based on the amount of publications it can be extended to 2 months.
        </p>

        <div className="mt-14">
          <Timeline
            steps={[
              {
                title: "Initial Review",
                body: "A reviewer reads the manuscript and evaluates its content, methodology, quality, and originality. They provide detailed feedback and recommend whether the work should move forward.",
              },
              {
                title: "Accept or Decline",
                body: "Based on the reviewer's recommendation, the manuscript is either accepted into the editorial layers or declined. If accepted, it proceeds to the next stage. *If the author wants to appeal the decision, they can email our information support.",
              },
              {
                title: "Section Editor Review",
                body: "Two section editors — individuals with knowledge and experience in the manuscript's field of study — examine the paper for major changes in format, content, structure, and academic rigor.",
              },
              {
                title: "Author Revision",
                body: "The manuscript is sent back to the author with the section editor's notes. The author makes revisions and resubmits. The section editors review the updated draft and request further edits if needed.",
              },
              {
                title: "Copy Editor Review",
                body: "The paper is forwarded to a copy editor (or returned to the author) for careful proofreading. The copy editor corrects grammar, spelling, minor formatting issues, and any remaining inconsistencies.",
              },
              {
                title: "Final Revision or Publishing",
                body: "After the copy editor's pass, the manuscript either goes back to the author for a final revision or moves directly into publishing, where it is released to the public Library.",
              },
            ]}
          />
        </div>

        <div className="mt-12 border-t-2 border-primary pt-8">
          <h3 className="font-serif text-2xl text-primary">Apply to Join Our Editorial Team</h3>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            We welcome applications from students of all ages with strong academic writing skills,
            attention to detail, and a passion for research. Prior editorial or review experience
            is helpful but not required.
          </p>
          <p className="mt-4 text-sm">
            To inquire about open positions, send a brief statement of interest and your grade / school
            to:{" "}
            <a
              href="mailto:NYRJINFO@gmail.com"
              className="text-primary underline underline-offset-4 hover:text-accent"
            >
              NYRJINFO@gmail.com
            </a>
          </p>
        </div>

      </section>
    </SiteLayout>
  );
}

function Timeline({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <div className="relative">
      <div className="absolute left-[15px] sm:left-[19px] top-4 bottom-4 w-px bg-border" />
      <div className="space-y-10">
        {steps.map((step, i) => (
          <div key={step.title} className="relative flex gap-4 sm:gap-6">
            <div className="relative z-10 shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-serif text-sm sm:text-base">
                {i + 1}
              </div>
            </div>
            <div className="border border-border bg-card p-5 sm:p-6 flex-1 -mt-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent mb-2">
                Step {i + 1}
              </p>
              <h3 className="font-serif text-xl sm:text-2xl text-primary leading-snug">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

