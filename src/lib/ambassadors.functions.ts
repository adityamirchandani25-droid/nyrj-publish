import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { TablesInsert } from "@/integrations/supabase/types";

const ALLOWED_PHOTO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const ChapterInput = z.object({
  // Either the shared ambassador password or a staff token authorizes writes.
  password: z.string().optional(),
  staffToken: z.string().optional(),
  id: z.string().uuid().optional(),
  chapter_number: z.number().int().positive(),
  school_name: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  chapter_lead: z.string().trim().min(1).max(200),
  chapter_lead_email: z.string().trim().email().max(200),
  chapter_lead_2: z.string().trim().max(200).optional().nullable(),
  chapter_lead_2_email: z.string().trim().max(200).optional().nullable(),
  about: z.string().trim().min(20).max(4000),
  new_students_this_year: z.number().int().min(0).max(100000).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  photoBase64: z.string().max(7_000_000).optional(),
  photoMime: z.string().max(100).optional(),
  photoFileName: z.string().max(200).optional(),
  removePhoto: z.boolean().optional(),
});

const DeleteInput = z.object({
  password: z.string().optional(),
  staffToken: z.string().optional(),
  id: z.string().uuid(),
});

const NumberSettingInput = z.object({
  password: z.string().optional(),
  staffToken: z.string().optional(),
  value: z.number().int().min(0).max(10_000_000),
});

const SlugInput = z.object({ slug: z.string().trim().min(1).max(200) });

async function authorize(auth: { password?: string; staffToken?: string }) {
  if (auth.staffToken) {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(auth.staffToken);
    return;
  }
  const { assertAmbassador } = await import("./ambassador-auth.server");
  assertAmbassador(auth.password ?? "");
}

const CHAPTER_COLUMNS =
  "id, chapter_number, school_name, location, chapter_lead, chapter_lead_email, chapter_lead_2, chapter_lead_2_email, about, lead_photo_path, slug, new_students_this_year, notes, created_at, updated_at";

async function signPhoto(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("chapter-photos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

export type Chapter = {
  id: string;
  chapter_number: number;
  school_name: string;
  location: string | null;
  chapter_lead: string | null;
  chapter_lead_email: string | null;
  chapter_lead_2: string | null;
  chapter_lead_2_email: string | null;
  about: string | null;
  lead_photo_path: string | null;
  lead_photo_url: string | null;
  slug: string | null;
  new_students_this_year: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Chapter lead email addresses are personal data and never leave the server
 * on a public read. Only the authorized staff/ambassador listing includes them. */
function stripContact(c: Chapter): Chapter {
  return { ...c, chapter_lead_email: null, chapter_lead_2_email: null, notes: null };
}

async function loadChapters(): Promise<Chapter[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("chapters")
    .select(CHAPTER_COLUMNS)
    .order("chapter_number", { ascending: true });
  if (error) {
    console.error("[server] database error:", error);
    throw new Error("Something went wrong. Please try again.");
  }
  const rows = (data ?? []) as Chapter[];
  const out: Chapter[] = [];
  for (const r of rows) out.push({ ...r, lead_photo_url: await signPhoto(r.lead_photo_path) });
  return out;
}

/** Public listing — contact details removed. */
export const listChapters = createServerFn({ method: "GET" }).handler(
  async (): Promise<Chapter[]> => {
    return (await loadChapters()).map(stripContact);
  },
);

/** Staff/ambassador listing — includes contact details after authorization. */
export const listChaptersAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: z.string().optional(), staffToken: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<Chapter[]> => {
    await authorize(data);
    return loadChapters();
  });

export const getChapterBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => SlugInput.parse(d))
  .handler(async ({ data }): Promise<Chapter | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("chapters")
      .select(CHAPTER_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) {
      console.error("[server] database error:", error);
      throw new Error("Something went wrong. Please try again.");
    }
    if (!row) return null;
    return stripContact({
      ...(row as Chapter),
      lead_photo_url: await signPhoto((row as Chapter).lead_photo_path),
    });
  });

export const saveChapter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ChapterInput.parse(d))
  .handler(async ({ data }) => {
    await authorize(data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let photoPath: string | null | undefined = undefined;
    if (data.photoBase64 && data.photoMime) {
      if (!ALLOWED_PHOTO_MIME.has(data.photoMime)) {
        throw new Error("Photo must be PNG, JPEG, WebP, or GIF.");
      }
      const bytes = Uint8Array.from(atob(data.photoBase64), (c) => c.charCodeAt(0));
      const safeName = (data.photoFileName ?? "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
      photoPath = `${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("chapter-photos")
        .upload(photoPath, bytes, { contentType: data.photoMime, upsert: false });
      if (upErr) {
        console.error("[server] storage upload error:", upErr);
        throw new Error("Could not upload the photo. Please try again.");
      }
    } else if (data.removePhoto) {
      photoPath = null;
    }

    const row: TablesInsert<"chapters"> = {
      chapter_number: data.chapter_number,
      school_name: data.school_name,
      location: data.location,
      chapter_lead: data.chapter_lead,
      chapter_lead_email: data.chapter_lead_email,
      chapter_lead_2: data.chapter_lead_2?.trim() || null,
      chapter_lead_2_email: data.chapter_lead_2_email?.trim() || null,
      about: data.about,
      new_students_this_year: data.new_students_this_year,
      notes: data.notes ?? null,
    };
    if (photoPath !== undefined) row.lead_photo_path = photoPath;

    if (data.id) {
      const { error } = await supabaseAdmin.from("chapters").update(row).eq("id", data.id);
      if (error) {
        console.error("[server] database error:", error);
        throw new Error("Something went wrong. Please try again.");
      }
      return { ok: true as const, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("chapters")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      console.error("[server] database error:", error);
      throw new Error("Something went wrong. Please try again.");
    }
    return { ok: true as const, id: ins.id };
  });

export const deleteChapter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DeleteInput.parse(d))
  .handler(async ({ data }) => {
    await authorize(data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("chapters").delete().eq("id", data.id);
    if (error) {
      console.error("[server] database error:", error);
      throw new Error("Something went wrong. Please try again.");
    }
    return { ok: true as const };
  });

async function readNumberSetting(key: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const raw = data?.value as unknown;
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "object" && raw && "value" in raw
        ? Number((raw as { value: unknown }).value)
        : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export const getEventAttendance = createServerFn({ method: "GET" }).handler(async () =>
  readNumberSetting("event_attendance"),
);

export const setEventAttendance = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => NumberSettingInput.parse(d))
  .handler(async ({ data }) => {
    await authorize(data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "event_attendance", value: data.value, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[server] database error:", error);
      throw new Error("Something went wrong. Please try again.");
    }
    return { ok: true as const, value: data.value };
  });

// Kept for the ambassador login handshake (validates the shared password).
export const getStudentsImpacted = createServerFn({ method: "GET" }).handler(async () =>
  readNumberSetting("event_attendance"),
);

export const setStudentsImpacted = setEventAttendance;
