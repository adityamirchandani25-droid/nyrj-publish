// Citation tracking for NYRJ.
//
// Articles with DOIs can be looked up in scholarly indexes. We read them from
// OpenAlex and fall back to Crossref's "is-referenced-by-count" when it has no record
// or reports zero citations
// of the DOI yet. The resulting number is stored on library_entries.citation_count
// so the public metrics page and article pages can display it instantly.

const UA = "NYRJ-citation-sync (https://nyrj.org; mailto:NYRJINFO@gmail.com)";

async function openAlexCount(doi: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?mailto=NYRJINFO@gmail.com`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      },
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
      signal: AbortSignal.timeout(8000),
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
 * Safe to run on a schedule. This replaces legacy counts based on citation
 * button clicks with counts actually reported by the indexes.
 */
export async function syncCitationCounts(): Promise<CitationSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pageSize = 1000;
  const page = (offset: number) =>
    supabaseAdmin
      .from("library_entries")
      .select("id, doi, citation_count")
      .order("id")
      .range(offset, offset + pageSize - 1);
  let result = await page(0);
  if (result.error) throw new Error(result.error.message);
  const rows = [...(result.data ?? [])];
  for (let offset = pageSize; (result.data?.length ?? 0) === pageSize; offset += pageSize) {
    result = await page(offset);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data ?? []));
  }
  let updated = 0;
  let checked = 0;
  let skipped = 0;
  let totalCitations = 0;

  for (const row of rows) {
    const doi = (row.doi ?? "")
      .trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "");
    const current = Number(row.citation_count) || 0;
    if (!doi) {
      skipped += 1;
      if (current !== 0) {
        const { error: upErr } = await supabaseAdmin
          .from("library_entries")
          .update({ citation_count: 0 })
          .eq("id", row.id);
        if (upErr) throw new Error(upErr.message);
        updated += 1;
      }
      continue;
    }
    checked += 1;
    const openAlex = await openAlexCount(doi);
    const fetched = openAlex && openAlex > 0 ? openAlex : ((await crossrefCount(doi)) ?? openAlex);
    const next = fetched == null ? current : Math.max(fetched, 0);
    totalCitations += next;
    if (fetched != null && next !== current) {
      const { error: upErr } = await supabaseAdmin
        .from("library_entries")
        .update({ citation_count: next })
        .eq("id", row.id);
      if (upErr) throw new Error(upErr.message);
      updated += 1;
    }
  }

  return { checked, updated, totalCitations, skipped };
}
