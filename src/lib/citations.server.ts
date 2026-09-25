// Citation tracking for NYRJ.
//
// Every published article is registered with a Crossref DOI. Citation counts
// are therefore discoverable from the open scholarly graph. We read them from
// OpenAlex (free, no key, covers Crossref + Scholar-indexed sources) and fall
// back to Crossref's own "is-referenced-by-count" when OpenAlex has no record
// of the DOI yet. The resulting number is stored on library_entries.citation_count
// so the public metrics page and article pages can display it instantly.

const UA = "NYRJ-citation-sync (https://nyrj.org; mailto:NYRJINFO@gmail.com)";

async function openAlexCount(doi: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?mailto=NYRJINFO@gmail.com`,
      { headers: { "user-agent": UA, accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { cited_by_count?: number };
    return typeof json.cited_by_count === "number" ? json.cited_by_count : null;
  } catch {
    return null;
  }
}

async function crossrefCount(doi: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { "user-agent": UA, accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      message?: { "is-referenced-by-count"?: number };
    };
    const n = json.message?.["is-referenced-by-count"];
    return typeof n === "number" ? n : null;
  } catch {
    return null;
  }
}

export type CitationSyncResult = {
  checked: number;
  updated: number;
  totalCitations: number;
  skipped: number;
};

/**
 * Refreshes citation_count for every library entry that has a DOI.
 * Safe to run on a schedule; never lowers a manually recorded count below
 * what the scholarly record reports.
 */
export async function syncCitationCounts(): Promise<CitationSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("library_entries")
    .select("id, doi, citation_count");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  let updated = 0;
  let checked = 0;
  let skipped = 0;
  let totalCitations = 0;

  for (const row of rows) {
    const doi = (row.doi ?? "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    const current = Number(row.citation_count) || 0;
    if (!doi) {
      skipped += 1;
      totalCitations += current;
      continue;
    }
    checked += 1;
    const fetched = (await openAlexCount(doi)) ?? (await crossrefCount(doi));
    const next = fetched == null ? current : Math.max(fetched, 0);
    totalCitations += next;
    if (fetched != null && next !== current) {
      const { error: upErr } = await supabaseAdmin
        .from("library_entries")
        .update({ citation_count: next })
        .eq("id", row.id);
      if (!upErr) updated += 1;
    }
  }

  return { checked, updated, totalCitations, skipped };
}
