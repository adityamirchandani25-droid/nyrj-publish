import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";


export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact the Editorial Office — NYRJ" },
      { name: "description", content: "Reach the National Youth Research Journal editorial office for submissions, press, partnerships, or general inquiries." },
      { name: "keywords", content: "contact student research journal, NYRJ contact, submit inquiry research journal, student journal editorial office" },
      { property: "og:title", content: "Contact the Editorial Office — NYRJ" },
      { property: "og:description", content: "Reach the NYRJ editorial office for submissions, press, and partnerships." },
      { property: "og:url", content: "https://nyrj.org/contact" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/contact" }],
  }),
  component: Contact,
});

function Contact() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Editorial Correspondence</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3">Contact</h1>
        <p className="mt-4 text-muted-foreground">
          For any question submissions, review, partnerships, or press, feel free to write to the
          editorial office.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:items-stretch">
          <ContactCard
            label="GENERAL INQUIRIES AND SUMBISSIONS"
            body="Questions about the manuscript status, edits, application and others contact-"
            email="NYRJINFO@Gmail.com"
          />
          <ContactCard
            label="MEDIA RELATIONS AND PRESS"
            body="Partnerships, Media, Communication inquiries contact-"
            email="nyrj.official@gmail.com"
          />
        </div>


        <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>We respond to all inquiries within 3 business days.</p>
        </div>
      </section>
    </SiteLayout>
  );
}

function ContactCard({ label, body, email }: { label: string; body: string; email: string }) {
  return (
    <div className="flex h-full flex-col border border-border bg-card p-6">
      <p className="text-[10px] uppercase tracking-[0.25em] text-accent">{label}</p>
      <p className="mt-2 text-sm text-foreground/85">{body}</p>
      <a
        href={`mailto:${email}`}
        className="mt-auto pt-4 inline-block font-serif text-lg text-primary hover:text-accent"
      >
        {email}
      </a>
    </div>
  );
}
