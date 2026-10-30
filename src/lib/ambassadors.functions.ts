import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
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
  const token = getRequest()
    ?.headers.get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (token) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData.user;
    if (!userError && user?.id && user.email) {
      const { data: account, error: accountError } = await supabaseAdmin
        .from("ambassador_accounts")
        .select("id, active, auth_user_id")
        .eq("auth_user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      if (!accountError && account) return;
    }
    if (!auth.password) throw new Error("This account does not have active ambassador access.");
  }
  const { checkAmbassadorPassword } = await import("./ambassador-auth.server");
  if (!checkAmbassadorPassword(auth.password ?? "")) {
    // The shared password is intentionally memorable, so wrong guesses are
    // throttled per client to stop it being brute-forced.
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({ scope: "ambassador-auth", limit: 10, windowSeconds: 10 * 60 });
    throw new Error("Incorrect ambassador password.");
  }
}

function accessCodeMatches(candidate: string): boolean {
  const expected = process.env.AMBASSADOR_ACCESS_CODE ?? process.env.AMBASSADOR_PASSWORD;
  if (!expected) {
    throw new Error("Ambassador registration is not configured. Please contact NYRJ staff.");
  }
  const left = createHash("sha256").update(candidate, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

export const createAmbassadorAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2, "Enter your full name.").max(120),
        email: z.string().trim().email("Enter a valid email address.").max(255),
        password: z.string().min(8, "Use at least 8 characters.").max(200),
        accessCode: z.string().min(4, "Enter the ambassador access code.").max(128),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({ scope: "ambassador-signup-ip", limit: 5, windowSeconds: 10 * 60 });
    const email = data.email.toLowerCase();
    await enforceRateLimit({
      scope: "ambassador-signup-email",
      limit: 3,
      windowSeconds: 60 * 60,
      identity: email,
    });
    if (!accessCodeMatches(data.accessCode)) {
      throw new Error("The ambassador access code is not valid.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingAccount, error: accountLookupError } = await supabaseAdmin
      .from("ambassador_accounts")
      .select("id, auth_user_id, active")
      .eq("email", email)
      .maybeSingle();
    if (accountLookupError) throw new Error("We could not start account setup. Please try again.");

    let userId = existingAccount?.auth_user_id ?? null;
    let existingUser = Boolean(userId);
    if (!userId) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.name, requested_role: "ambassador" },
      });
      if (created.user) {
        userId = created.user.id;
      } else if (createError && /already|registered|exists/i.test(createError.message)) {
        existingUser = true;
        for (let page = 1; page <= 10 && !userId; page += 1) {
          const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 1000,
          });
          if (usersError) break;
          userId = users.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
          if (users.users.length < 1000) break;
        }
      } else if (createError) {
        console.error("[ambassador] auth account creation failed:", createError);
        throw new Error("We could not create your account. Please try again.");
      }
    }
    if (!userId) {
      throw new Error(
        "An account already uses this email. Contact NYRJ staff to enable ambassador access.",
      );
    }

    const { error: saveError } = await supabaseAdmin.from("ambassador_accounts").upsert(
      {
        auth_user_id: userId,
        name: data.name,
        email,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
    if (saveError) {
      console.error("[ambassador] account profile creation failed:", saveError);
      throw new Error(
        "Your login was created, but ambassador access could not be enabled. Contact NYRJ staff.",
      );
    }
    return { ok: true as const, existingUser };
  });

/** Validates an individual ambassador session or the legacy shared password. */
export const ambassadorLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data }) => {
    await authorize({ password: data.password });
    return { ok: true as const };
  });

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
