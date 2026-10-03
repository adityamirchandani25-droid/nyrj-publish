import { createServerFn } from "@tanstack/react-start";
import { splitAuthors } from "./citation-formats";

function countAuthors(authors: string | null | undefined): number {
  if (!authors) return 0;
  return splitAuthors(authors).length;
}

export const getJournalStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [libRes, subRes] = await Promise.all([
    (async () => {
      const pageSize = 1000;
      const page = (offset: number) =>
        supabaseAdmin
          .from("library_entries")
          .select("id, authors, citation_count, publication_date, added_at")
          .order("id")
          .range(offset, offset + pageSize - 1);
      let result = await page(0);
      const rows = [...(result.data ?? [])];
      for (
        let offset = pageSize;
        !result.error && (result.data?.length ?? 0) === pageSize;
        offset += pageSize
      ) {
        result = await page(offset);
        rows.push(...(result.data ?? []));
      }
      return { data: rows, error: result.error };
    })(),
    supabaseAdmin
      .from("manuscript_submissions")
      .select("authors, status, decision, created_at, updated_at")
      .is("deleted_at", null),
  ]);

  // If the database is unreachable we must NOT present zeros as real figures.
  const unavailable = Boolean(libRes.error) || Boolean(subRes.error);

  const entries = libRes.data ?? [];
  const subs = subRes.data ?? [];

  const articles = entries.length;
  const researchers = entries.reduce((n, e) => n + countAuthors(e.authors as string | null), 0);

  const countries = new Set<string>();
  for (const s of subs) {
    const arr = (s.authors as Array<{ nation?: string }> | null) ?? [];
    for (const a of arr) {
      const n = (a?.nation ?? "").trim();
      if (n) countries.add(n.toUpperCase());
    }
  }

  // Students impacted is derived live from chapter attendance reports.
  const { data: chapterRows } = await supabaseAdmin
    .from("chapters")
    .select("new_students_this_year");
  const studentsImpacted = (chapterRows ?? []).reduce(
    (n, c) => n + (Number(c.new_students_this_year) || 0),
    0,
  );

  const { data: setting } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "event_attendance")
    .maybeSingle();
  const rawAtt = setting?.value as unknown;
  const eventAttendance = typeof rawAtt === "number" ? rawAtt : Number(rawAtt);

  // Editorial turnaround: derived from real submission timestamps once we have
  // enough data points; otherwise the published baselines stay in place.
  const days = (a: string, b: string) =>
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
  const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s2 = [...xs].sort((x, y) => x - y);
    const m = Math.floor(s2.length / 2);
    return s2.length % 2 ? s2[m]! : (s2[m - 1]! + s2[m]!) / 2;
  };

  const moved = subs.filter(
    (s2) =>
      typeof s2.created_at === "string" &&
      typeof s2.updated_at === "string" &&
      days(s2.created_at as string, s2.updated_at as string) > 0.01,
  );
  // First response = time from submission to the first editorial touch. We can
  // only trust that for papers still sitting in the first review stage; once a
  // paper advances, updated_at reflects the latest change, not the first one.
  const firstTouch = moved.filter(
    (s2) => `${s2.status ?? ""}`.toLowerCase().trim() === "initial review",
  );
  const responseDays = median(
    firstTouch.map((s2) => days(s2.created_at as string, s2.updated_at as string)),
  );
  const publishedDays = median(
    moved
      .filter((s2) => {
        const st = `${s2.status ?? ""} ${s2.decision ?? ""}`.toLowerCase();
        return st.includes("publish") || st.includes("accept");
      })
      .map((s2) => days(s2.created_at as string, s2.updated_at as string)),
  );

  const MIN_SAMPLE = 3;
  const turnaround = {
    firstResponseDays:
      firstTouch.length >= MIN_SAMPLE && responseDays !== null ? responseDays : null,
    finalPublishingDays:
      moved.length >= MIN_SAMPLE && publishedDays !== null ? publishedDays : null,
    sampleSize: moved.length,
    firstResponseSampleSize: firstTouch.length,
  };

  // ---- Citations & impact ----
  const citations = entries.reduce((n, e) => n + (Number(e.citation_count) || 0), 0);
  const citationsPerArticle = articles > 0 ? citations / articles : null;

  return {
    unavailable,
    turnaround,
    articles,
    researchers,
    countries: countries.size,
    chapters: (chapterRows ?? []).length,
    studentsImpacted: studentsImpacted + (Number.isFinite(eventAttendance) ? eventAttendance : 0),
    eventAttendance: Number.isFinite(eventAttendance) ? eventAttendance : 0,
    citations,
    citationsPerArticle,
  };
});
