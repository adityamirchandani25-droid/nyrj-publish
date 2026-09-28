// Editorial team: public listing + staff-only create/update/delete.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { TablesUpdate } from "@/integrations/supabase/types";

export type EditorRow = {
  id: string;
  name: string;
  role: string | null;
  affiliation: string | null;
  bio: string | null;
  email: string | null;
  photo_url: string | null; // signed URL (server-injected)
  member_group: "editorial" | "reviewer";
  position: number;
  created_at: string;
  updated_at: string;
};

const PHOTO_BUCKET = "advisor-photos";
const ALLOWED_PHOTO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

async function signPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

export const editorsList = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("editorial_team")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[server] supabase error:", error);
    throw new Error("An unexpected error occurred. Please try again.");
  }
  return Promise.all(
    (data ?? []).map(async (r): Promise<EditorRow> => ({
      id: r.id,
      name: r.name,
      role: r.role ?? null,
      affiliation: r.affiliation ?? null,
      bio: r.bio ?? null,
      email: r.email ?? null,
      photo_url: await signPhoto(r.photo_path ?? null),
      member_group: r.member_group === "reviewer" ? "reviewer" : "editorial",
      position: r.position ?? 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  );
});

const CreateSchema = z.object({
  staffToken: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).optional(),
  affiliation: z.string().trim().max(200).optional(),
  email: z.string().trim().max(320).optional(),
  memberGroup: z.enum(["editorial", "reviewer"]).optional(),
  position: z.number().int().min(0).max(9999).optional(),
  photoBase64: z.string().max(5_000_000).optional(),
  photoMime: z.string().max(100).optional(),
  photoFileName: z.string().max(200).optional(),
});

async function uploadPhoto(base64: string, mime: string, fileName: string): Promise<string> {
  if (!ALLOWED_PHOTO_MIME.has(mime)) {
    throw new Error("Photo must be PNG, JPEG, WebP, or GIF.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const photoPath = `${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabaseAdmin.storage
    .from(PHOTO_BUCKET)
    .upload(photoPath, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  return photoPath;
}

export const editorTeamCreate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let photoPath: string | null = null;
    if (data.photoBase64 && data.photoMime) {
      photoPath = await uploadPhoto(
        data.photoBase64,
        data.photoMime,
        data.photoFileName ?? "photo",
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from("editorial_team")
      .insert({
        name: data.name,
        role: data.role ?? null,
        affiliation: data.affiliation ?? null,
        email: data.email ?? null,
        member_group: data.memberGroup ?? "editorial",
        position: data.position ?? 0,
        photo_path: photoPath,
      })
      .select()
      .single();
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ...row, photo_url: await signPhoto(photoPath) } as EditorRow;
  });

const DeleteSchema = z.object({ staffToken: z.string().min(1), id: z.string().uuid() });

export const editorTeamDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DeleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("editorial_team")
      .select("photo_path")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.photo_path) {
      await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([existing.photo_path]);
    }
    const { error } = await supabaseAdmin.from("editorial_team").delete().eq("id", data.id);
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ok: true as const };
  });

const UpdateSchema = z.object({
  staffToken: z.string().min(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).optional(),
  affiliation: z.string().trim().max(200).optional(),
  email: z.string().trim().max(320).optional(),
  memberGroup: z.enum(["editorial", "reviewer"]).optional(),
  position: z.number().int().min(0).max(9999).optional(),
  photoBase64: z.string().max(5_000_000).optional(),
  photoMime: z.string().max(100).optional(),
  photoFileName: z.string().max(200).optional(),
  removePhoto: z.boolean().optional(),
});

export const editorTeamUpdate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: TablesUpdate<"editorial_team"> = {
      name: data.name,
      role: data.role ?? null,
      affiliation: data.affiliation ?? null,
      email: data.email ?? null,
      member_group: data.memberGroup ?? "editorial",
      position: data.position ?? 0,
    };

    if (data.removePhoto || (data.photoBase64 && data.photoMime)) {
      const { data: existing } = await supabaseAdmin
        .from("editorial_team")
        .select("photo_path")
        .eq("id", data.id)
        .maybeSingle();
      if (existing?.photo_path) {
        await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([existing.photo_path]);
      }
      patch.photo_path = null;
    }

    if (data.photoBase64 && data.photoMime) {
      patch.photo_path = await uploadPhoto(
        data.photoBase64,
        data.photoMime,
        data.photoFileName ?? "photo",
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from("editorial_team")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ...row, photo_url: await signPhoto(row.photo_path) } as EditorRow;
  });
