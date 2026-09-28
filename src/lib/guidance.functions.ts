// Guidance videos: public list + staff-only create/delete (YouTube/Vimeo embeds).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type GuidanceVideo = {
  id: string;
  title: string;
  url: string;
  provider: "youtube" | "vimeo";
  embed_id: string;
  position: number;
  created_at: string;
};

function parseVideoUrl(raw: string): { provider: "youtube" | "vimeo"; embed_id: string } {
  const url = raw.trim();
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return { provider: "youtube", embed_id: id };
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return { provider: "youtube", embed_id: v };
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "shorts" || p === "embed" || p === "live");
      if (idx >= 0 && parts[idx + 1]) return { provider: "youtube", embed_id: parts[idx + 1] };
    }

    // Vimeo
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      const id = parts.find((p) => /^\d+$/.test(p));
      if (id) return { provider: "vimeo", embed_id: id };
    }
  } catch {
    /* fallthrough */
  }
  throw new Error("Please paste a YouTube or Vimeo link.");
}

// ---------- Public list ----------
export const guidanceVideosList = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("guidance_videos")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[server] supabase error:", error);
    throw new Error("An unexpected error occurred. Please try again.");
  }
  return (data ?? []) as GuidanceVideo[];
});

// ---------- Staff: create ----------
const CreateSchema = z.object({
  staffToken: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(500),
});

export const guidanceVideoCreate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { provider, embed_id } = parseVideoUrl(data.url);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: maxRow } = await supabaseAdmin
      .from("guidance_videos")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = ((maxRow?.position as number | undefined) ?? -1) + 1;
    const { data: row, error } = await supabaseAdmin
      .from("guidance_videos")
      .insert({
        title: data.title,
        url: data.url,
        provider,
        embed_id,
        position: nextPos,
      })
      .select()
      .single();
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return row as GuidanceVideo;
  });

// ---------- Staff: delete ----------
const DeleteSchema = z.object({ staffToken: z.string().min(1), id: z.string().uuid() });

export const guidanceVideoDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DeleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("guidance_videos").delete().eq("id", data.id);
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ok: true as const };
  });
