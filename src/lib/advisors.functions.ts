// Advisors: public listing + staff-only create/delete/update photo.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AdvisorRow = {
  id: string;
  name: string;
  title: string | null;
  affiliation: string | null;
  bio: string | null;
  photo_url: string | null; // signed url (server-injected)
  photo_path?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

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
    .from("advisor-photos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

export const advisorsList = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("advisors")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) { console.error("[server] supabase error:", error); throw new Error("An unexpected error occurred. Please try again."); }
  const rows = (data ?? []) as Array<AdvisorRow & { photo_path?: string | null }>;
  const out: AdvisorRow[] = [];
  for (const r of rows) {
    out.push({ ...r, photo_url: await signPhoto((r as any).photo_url ?? null) });
  }
  return out;
});

const CreateSchema = z.object({
  staffToken: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).optional(),
  affiliation: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(2000).optional(),
  position: z.number().int().min(0).max(9999).optional(),
  photoBase64: z.string().max(5_000_000).optional(),
  photoMime: z.string().max(100).optional(),
  photoFileName: z.string().max(200).optional(),
});

export const advisorCreate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let photoPath: string | null = null;
    if (data.photoBase64 && data.photoMime) {
      if (!ALLOWED_PHOTO_MIME.has(data.photoMime)) {
        throw new Error("Photo must be PNG, JPEG, WebP, or GIF.");
      }
      const bytes = Uint8Array.from(atob(data.photoBase64), (c) => c.charCodeAt(0));
      const safeName = (data.photoFileName ?? "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
      photoPath = `${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("advisor-photos")
        .upload(photoPath, bytes, { contentType: data.photoMime, upsert: false });
      if (upErr) { console.error("[server] storage upload error:", upErr); throw new Error("Could not upload the photo. Please try again."); }
    }

    const { data: row, error } = await (supabaseAdmin as any)
      .from("advisors")
      .insert({
        name: data.name,
        title: data.title ?? null,
        affiliation: data.affiliation ?? null,
        bio: data.bio ?? null,
        position: data.position ?? 0,
        photo_url: photoPath,
      })
      .select()
      .single();
    if (error) { console.error("[server] supabase error:", error); throw new Error("An unexpected error occurred. Please try again."); }
    return { ...row, photo_url: await signPhoto(photoPath) } as AdvisorRow;
  });

const DeleteSchema = z.object({ staffToken: z.string().min(1), id: z.string().uuid() });

export const advisorDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DeleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await (supabaseAdmin as any)
      .from("advisors")
      .select("photo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.photo_url) {
      await supabaseAdmin.storage.from("advisor-photos").remove([existing.photo_url]);
    }
    const { error } = await (supabaseAdmin as any).from("advisors").delete().eq("id", data.id);
    if (error) { console.error("[server] supabase error:", error); throw new Error("An unexpected error occurred. Please try again."); }
    return { ok: true as const };
  });

// Update advisor info (name/title/affiliation/bio/position)
const UpdateInfoSchema = z.object({
  staffToken: z.string().min(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).optional(),
  affiliation: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(2000).optional(),
  position: z.number().int().min(0).max(9999).optional(),
});

export const advisorUpdateInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateInfoSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("advisors")
      .update({
        name: data.name,
        title: data.title ?? null,
        affiliation: data.affiliation ?? null,
        bio: data.bio ?? null,
        position: data.position ?? 0,
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) { console.error("[server] supabase error:", error); throw new Error("An unexpected error occurred. Please try again."); }
    return { ...row, photo_url: await signPhoto((row as any).photo_url ?? null) } as AdvisorRow;
  });

// Update photo for an existing advisor
const UpdatePhotoSchema = z.object({
  staffToken: z.string().min(1),
  id: z.string().uuid(),
  photoBase64: z.string().min(1).max(5_000_000),
  photoMime: z.string().min(1).max(100),
  photoFileName: z.string().min(1).max(200),
});

export const advisorUpdatePhoto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdatePhotoSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!ALLOWED_PHOTO_MIME.has(data.photoMime)) {
      throw new Error("Photo must be PNG, JPEG, WebP, or GIF.");
    }

    // Remove old photo if exists
    const { data: existing } = await (supabaseAdmin as any)
      .from("advisors")
      .select("photo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.photo_url) {
      await supabaseAdmin.storage.from("advisor-photos").remove([existing.photo_url]);
    }

    const bytes = Uint8Array.from(atob(data.photoBase64), (c) => c.charCodeAt(0));
    const safeName = data.photoFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const photoPath = `${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("advisor-photos")
      .upload(photoPath, bytes, { contentType: data.photoMime, upsert: false });
    if (upErr) { console.error("[server] storage upload error:", upErr); throw new Error("Could not upload the photo. Please try again."); }

    const { data: row, error } = await (supabaseAdmin as any)
      .from("advisors")
      .update({ photo_url: photoPath })
      .eq("id", data.id)
      .select()
      .single();
    if (error) { console.error("[server] supabase error:", error); throw new Error("An unexpected error occurred. Please try again."); }
    return { ...row, photo_url: await signPhoto(photoPath) } as AdvisorRow;
  });

// Remove photo from an existing advisor
const RemovePhotoSchema = z.object({
  staffToken: z.string().min(1),
  id: z.string().uuid(),
});

export const advisorRemovePhoto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RemovePhotoSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await (supabaseAdmin as any)
      .from("advisors")
      .select("photo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.photo_url) {
      await supabaseAdmin.storage.from("advisor-photos").remove([existing.photo_url]);
    }

    const { data: row, error } = await (supabaseAdmin as any)
      .from("advisors")
      .update({ photo_url: null })
      .eq("id", data.id)
      .select()
      .single();
    if (error) { console.error("[server] supabase error:", error); throw new Error("An unexpected error occurred. Please try again."); }
    return { ...row, photo_url: null } as AdvisorRow;
  });
