import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ArticleRow = {
  id: string;
  slug: string;
  nyrj_id: string | null;
  doi: string | null;
  featured: boolean;
  award_winner: boolean;
  award_label: string | null;
  citation_count: number;
  title: string;
  authors: string;
  issue: string | null;
  topic: string | null;
  grade: string | null;
  abstract: string | null;
  keywords: string[] | null;
  references_text: string | null;
  publication_date: string | null;
  orcids: string[] | null;
  file_name: string;
  mime_type: string;
  file_path: string;
  added_at: string;
  signed_url: string;
};

const PUBLIC_ARTICLE_COLUMNS =
  "id, slug, nyrj_id, doi, featured, award_winner, award_label, citation_count, title, authors, issue, topic, grade, abstract, keywords, references_text, publication_date, orcids, file_name, mime_type, file_path, added_at";

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data }): Promise<ArticleRow | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("library_entries")
      .select(PUBLIC_ARTICLE_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    if (!row) return null;
    const { data: signed } = await supabaseAdmin.storage
      .from("library")
      .createSignedUrl(row.file_path, 60 * 60 * 24 * 7);
    return { ...row, signed_url: signed?.signedUrl ?? "" } as ArticleRow;
  });


export const listArticleSlugs = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("library_entries")
    .select("slug, added_at, publication_date")
    .order("added_at", { ascending: false });
  if (error) {
    console.error("[server] supabase error:", error);
    return [] as Array<{ slug: string; added_at: string; publication_date: string | null }>;
  }
  return (data ?? []) as Array<{ slug: string; added_at: string; publication_date: string | null }>;
});

/** Public list of featured published articles for the home page. */
export const listFeaturedArticles = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("library_entries")
    .select("id, slug, nyrj_id, title, authors, issue, topic, abstract, added_at, publication_date")
    .eq("featured", true)
    .order("added_at", { ascending: false })
    .limit(6);
  if (error) {
    console.error("[server] supabase error:", error);
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    slug: string;
    nyrj_id: string | null;
    title: string;
    authors: string;
    issue: string | null;
    topic: string | null;
    abstract: string | null;
    added_at: string;
    publication_date: string | null;
  }>;
});

/** Atomically increments citation_count via an SQL RPC. Authenticated only to prevent abuse. */
export const incrementCitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<number> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: next, error } = await (supabaseAdmin as any).rpc("increment_citation_count", {
      _id: data.id,
    });
    if (error) {
      console.error("[server] citation rpc error:", error);
      return 0;
    }
    return typeof next === "number" ? next : 0;
  });
