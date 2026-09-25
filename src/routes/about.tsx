import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { SponsorsSection } from "@/components/SponsorsSection";
import { SocialLink, SOCIAL_LINKEDIN, SOCIAL_INSTAGRAM, SOCIAL_YOUTUBE, LinkedInIcon, InstagramIcon, YouTubeIcon } from "@/components/SocialLinks";


export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About & Mission — National Youth Research Journal" },
      { name: "description", content: "The mission of NYRJ: a peer-reviewed venue for original student research from middle school through medical school, across every academic discipline." },
      { name: "keywords", content: "about NYRJ, national youth research journal mission, student research journal, peer review youth research, scholarly publishing for students" },
      { property: "og:title", content: "About & Mission — National Youth Research Journal" },
      { property: "og:description", content: "A peer-reviewed venue for original student research across every discipline." },
      { property: "og:url", content: "https://nyrj.org/about" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/about" }],
  }),
  component: About,
});

function About() {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Mission Statement</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          A journal of record for the next generation of researchers.
        </h1>
        <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground/90">
          <p>
            The <em>National Youth Research Journal</em> (NYRJ) is a scholarly journal
            dedicated to publishing research by students <strong>ranging from middle school to med school</strong>. We are open to <strong>publishing any topic or field:</strong> biology, chemistry, physics, computer science, mathematics, engineering, psychology,
            sociology, economics, history, literature, linguistics, philosophy, music theory,
            visual arts research, and beyond.
          </p>
          <p>
            We exist because serious research from today&apos;s youth deserves a serious venue. Too
            often student work is trapped inside science fair binders or never gets a chance to be
            published and change the world. NYRJ provides opportunities for students to publish
            their research. We exist <strong>for learning and to give students real research
            experience</strong> — the peer-review process itself is part of the education. We bring
            the platform — you bring the paper.
          </p>
          <p>
            Manuscripts are reviewed for clarity, rigor, originality, and appropriate content for
            the author&apos;s academic stage. Articles are published on a rolling basis as they
            clear review, and accepted work is stored permanently in our public library, along with
            ongoing efforts to have it preserved in a major archive.
          </p>
          <p>
            NYRJ is <strong>self-published</strong> — we own our editorial workflow, our peer-review
            standards, and our public library end to end. That independence lets us keep the journal
            free to read, free to submit to, and accountable only to the scholarship we publish.
          </p>
          <p>
            Based in the United States, NYRJ is an international journal: we welcome submissions
            from students around the world and publish research across every field and discipline.
          </p>
        </div>


        <SponsorsSection />

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Follow NYRJ</p>
          <div className="mt-3 flex items-center gap-3">
            <SocialLink
              href={SOCIAL_LINKEDIN}
              label="NYRJ on LinkedIn"
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent transition-colors"
            >
              <LinkedInIcon className="h-4 w-4" />
              LinkedIn
            </SocialLink>
            <SocialLink
              href={SOCIAL_INSTAGRAM}
              label="NYRJ on Instagram"
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent transition-colors"
            >
              <InstagramIcon className="h-4 w-4" />
              Instagram
            </SocialLink>
            <SocialLink
              href={SOCIAL_YOUTUBE}
              label="NYRJ on YouTube"
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent transition-colors"
            >
              <YouTubeIcon className="h-4 w-4" />
              YouTube
            </SocialLink>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Editorial Office</p>
          <p className="mt-2 text-sm">
            Questions, partnerships, or press inquiries:&nbsp;
            <a href="mailto:nyrj.official@gmail.com" className="text-primary underline underline-offset-4 hover:text-accent">
              nyrj.official@gmail.com
            </a>
          </p>
        </div>

      </article>
    </SiteLayout>
  );
}



