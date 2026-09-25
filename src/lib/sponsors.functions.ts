// Sponsors: public listing + staff-only create/delete.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SponsorRow = {
  id: string;
  name: string;
  tier: string;
  website: string | null;
  blurb: string | null;
  logo_url: string | null; // signed url (server-injected)
  position: number;
};

const ALLOWED_LOGO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

async function signLogo(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("sponsor-logos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

export const sponsorsList = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("sponsors")
    .select("id,name,tier,website,blurb,logo_path,position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[server] supabase error:", error);
    throw new Error("An unexpected error occurred. Please try again.");
  }
  const rows = (data ?? []) as Array<Omit<SponsorRow, "logo_url"> & { logo_path: string | null }>;
  const out: SponsorRow[] = [];
  for (const r of rows) {
    const { logo_path, ...rest } = r;
    out.push({ ...rest, logo_url: await signLogo(logo_path) });
  }
  return out;
});

const CreateSchema = z.object({
  staffToken: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  tier: z
    .enum(["founding", "partner", "gold", "silver", "bronze", "supporter"])
    .default("supporter"),
  website: z.string().trim().url().max(500).optional().or(z.literal("")),
  blurb: z.string().trim().max(500).optional(),
  position: z.number().int().min(0).max(9999).optional(),
  logoBase64: z.string().max(3_000_000).optional(),
  logoMime: z.string().max(100).optional(),
  logoFileName: z.string().max(200).optional(),
});

export const sponsorCreate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let logoPath: string | null = null;
    if (data.logoBase64 && data.logoMime) {
      if (!ALLOWED_LOGO_MIME.has(data.logoMime)) {
        throw new Error("Logo must be PNG, JPEG, WebP, or SVG.");
      }
      const bytes = Uint8Array.from(atob(data.logoBase64), (c) => c.charCodeAt(0));
      const safeName = (data.logoFileName ?? "logo").replace(/[^a-zA-Z0-9._-]/g, "_");
      logoPath = `${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("sponsor-logos")
        .upload(logoPath, bytes, { contentType: data.logoMime, upsert: false });
      if (upErr) {
        console.error("[server] sponsor logo upload error:", upErr);
        throw new Error("Could not upload the logo. Please try again.");
      }
    }

    const { data: row, error } = await (supabaseAdmin as any)
      .from("sponsors")
      .insert({
        name: data.name,
        tier: data.tier,
        website: data.website || null,
        blurb: data.blurb || null,
        position: data.position ?? 0,
        logo_path: logoPath,
      })
      .select("id,name,tier,website,blurb,position")
      .single();
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ...row, logo_url: await signLogo(logoPath) } as SponsorRow;
  });

const DeleteSchema = z.object({ staffToken: z.string().min(1), id: z.string().uuid() });

export const sponsorDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DeleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await (supabaseAdmin as any)
      .from("sponsors")
      .select("logo_path")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.logo_path) {
      await supabaseAdmin.storage.from("sponsor-logos").remove([existing.logo_path]);
    }
    const { error } = await (supabaseAdmin as any).from("sponsors").delete().eq("id", data.id);
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ok: true as const };
  });
