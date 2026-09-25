import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ChapterEditor } from "@/components/ChapterEditor";
import { getSession, isStaff, onAuthChange, staffToken, type Session } from "@/lib/auth";

export const Route = createFileRoute("/admin/chapters")({
  head: () => ({
    meta: [
      { title: "Staff · Chapters — NYRJ" },
      { name: "description", content: "Staff administration for NYRJ chapters and chapter leads." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminChaptersPage,
});

function AdminChaptersPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(getSession());
    return onAuthChange(setSession);
  }, []);

  if (!isStaff(session)) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-2xl px-6 py-16">
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Restricted</p>
          <h1 className="font-serif text-4xl text-primary mt-3">Staff access required</h1>
          <button
            onClick={() => navigate({ to: "/login", search: { account: "staff" as never } })}
            className="mt-6 px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
          >
            Go to Staff Login
          </button>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Staff Dashboard</p>
        <h1 className="font-serif text-4xl text-primary mt-2">Chapters</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Full control over every registered chapter: create, edit, add a chapter-lead photo, or
          delete. Student-reported attendance here feeds the live “Students impacted” metric.
        </p>
        <ChapterEditor getAuth={() => ({ staffToken: staffToken() })} />
      </section>
    </SiteLayout>
  );
}
