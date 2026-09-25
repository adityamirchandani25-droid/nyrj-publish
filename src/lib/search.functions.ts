// Public site-wide search across library, advisors, events, editorial team.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SearchHit = {
  kind: "article" | "advisor" | "event" | "team";
  id: string;
  title: string;
  subtitle?: string | null;
  snippet?: string | null;
  href: string;
};

const QuerySchema = z.object({ q: z.string().trim().min(1).max(200) });

// Keep punctuation searchable while making the term inert inside a PostgREST
// filter string: neutralise LIKE wildcards, then quote the value so commas,
// parentheses and dots are treated as literal text.
function safeTerm(s: string) {
  const cleaned = s.replace(/\s+/g, " ").trim();
  const escaped = cleaned
    .replace(/\\/g, "\\\\")
    .replace(/[%_]/g, (m) => `\\${m}`)
    .replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

export const siteSearch = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => QuerySchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supa = supabaseAdmin as any;
    const term = safeTerm(data.q);
    if (term === `"%%"`) return [] as SearchHit[];
    const hits: SearchHit[] = [];

    const [lib, adv, evt, team] = await Promise.all([
      supa
        .from("library_entries")
        .select("id, title, authors, slug, topic, issue")
        .or(`title.ilike.${term},authors.ilike.${term},topic.ilike.${term}`)
        .limit(20),
      supa
        .from("advisors")
        .select("id, name, title, affiliation, bio")
        .or(`name.ilike.${term},title.ilike.${term},affiliation.ilike.${term},bio.ilike.${term}`)
        .limit(20),
      supa
        .from("events")
        .select("id, title, description, event_date")
        .or(`title.ilike.${term},description.ilike.${term}`)
        .limit(20),
      supa
        .from("editorial_team")
        .select("id, name, role, affiliation, bio")
        .or(`name.ilike.${term},role.ilike.${term},affiliation.ilike.${term},bio.ilike.${term}`)
        .limit(20),
    ]);

    for (const r of lib.data ?? []) {
      hits.push({
        kind: "article",
        id: r.id,
        title: r.title,
        subtitle: [r.authors, r.issue].filter(Boolean).join(" · ") || null,
        snippet: r.topic ?? null,
        href: r.slug ? `/article/${r.slug}` : "/archive",
      });
    }
    for (const r of adv.data ?? []) {
      hits.push({
        kind: "advisor",
        id: r.id,
        title: r.name,
        subtitle: [r.title, r.affiliation].filter(Boolean).join(" · ") || null,
        snippet: r.bio ?? null,
        href: "/advisors",
      });
    }
    for (const r of evt.data ?? []) {
      hits.push({
        kind: "event",
        id: r.id,
        title: r.title,
        subtitle: r.event_date ?? null,
        snippet: r.description ?? null,
        href: "/events",
      });
    }
    for (const r of team.data ?? []) {
      hits.push({
        kind: "team",
        id: r.id,
        title: r.name,
        subtitle: [r.role, r.affiliation].filter(Boolean).join(" · ") || null,
        snippet: r.bio ?? null,
        href: "/team",
      });
    }

    return hits;
  });
