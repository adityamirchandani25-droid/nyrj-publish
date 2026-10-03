import { createHash } from "node:crypto";
import {
  buildCitationBundle,
  citationBundleSchema,
  type CitationArticle,
  type CitationBundle,
} from "./citation-formats";

const memoryCache = new Map<string, CitationBundle>();
const pendingGenerations = new Map<string, Promise<CitationBundle>>();

function sourceHash(article: CitationArticle) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        formatterVersion: 2,
        title: article.title,
        authors: article.authors,
        issue: article.issue,
        publicationDate: article.publication_date,
        addedAt: article.added_at,
        doi: article.doi,
        slug: article.slug,
      }),
    )
    .digest("hex");
}

/** Format published metadata and cache the result for this metadata revision. */
export async function getArticleCitations(id: string): Promise<CitationBundle> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("library_entries")
    .select(
      "id, slug, nyrj_id, doi, title, authors, issue, publication_date, added_at, citation_formats, citation_source_hash",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !row?.slug) {
    console.error("[citations] article lookup failed:", error);
    throw new Error("This article could not be found.");
  }

  const article: CitationArticle = { ...row, slug: row.slug };
  const hash = sourceHash(article);
  const cacheKey = `${article.id}:${hash}`;
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory) return inMemory;

  if (row.citation_source_hash === hash) {
    const parsed = citationBundleSchema.safeParse(row.citation_formats);
    if (parsed.success) {
      memoryCache.set(cacheKey, parsed.data);
      return parsed.data;
    }
  }

  const pending = pendingGenerations.get(cacheKey);
  if (pending) return pending;

  const generation = Promise.resolve(buildCitationBundle(article))
    .then(async (bundle) => {
      memoryCache.set(cacheKey, bundle);
      const { error: cacheError } = await supabaseAdmin
        .from("library_entries")
        .update({
          citation_formats: bundle,
          citation_source_hash: hash,
          citation_generated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      if (cacheError) console.warn("[citations] database cache unavailable:", cacheError.message);
      return bundle;
    })
    .finally(() => pendingGenerations.delete(cacheKey));

  pendingGenerations.set(cacheKey, generation);
  return generation;
}
