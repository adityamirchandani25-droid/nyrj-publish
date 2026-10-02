// Events: public listing + idea submission, plus staff-only CRUD and AI poster extraction.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string | null; // YYYY-MM-DD
  poster_url: string | null; // signed url (server-injected)
  poster_path?: string | null;
  created_at: string;
  updated_at: string;
};

async function signPoster(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("event-posters")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

// ---------- Public list ----------
export const eventsList = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .order("event_date", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("[server] supabase error:", error);
    throw new Error("An unexpected error occurred. Please try again.");
  }
  const rows = (data ?? []) as Array<EventRow & { poster_path?: string | null }>;
  const out: EventRow[] = [];
  for (const r of rows) {
    // `poster_url` column stores the storage path in the `event-posters` bucket.
    const path = r.poster_path ?? r.poster_url ?? null;
    out.push({ ...r, poster_url: await signPoster(path) });
  }
  return out;
});

// ---------- Authenticated: submit an event idea (login required) ----------
const IdeaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
});

export const eventIdeaSubmit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdeaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({
      scope: "event-idea",
      limit: 5,
      windowSeconds: 24 * 60 * 60,
      identity: context.userId,
    });
    const email = (context.claims?.email as string | undefined)?.toLowerCase();
    if (!email) throw new Error("Your account has no email on file.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("event_ideas").insert({
      student_email: email,
      title: data.title,
      description: data.description ?? null,
    });
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }

    // Notify the editorial inbox (managed email). Never block the submission.
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("event-idea", "NYRJINFO@gmail.com", {
        idempotencyKey: `event-idea-${Date.now()}-${email}`,
        replyTo: email,
        templateData: {
          studentEmail: email,
          title: data.title,
          description: data.description ?? "",
        },
      });
    } catch (e) {
      console.error("[server] event idea notification email failed:", e);
    }
    return { ok: true as const };
  });

// ---------- Staff: AI extract from poster ----------
const ExtractSchema = z.object({
  staffToken: z.string().min(1),
  imageBase64: z.string().min(1).max(5_000_000),
  mimeType: z.string().min(1).max(100),
});

export const eventExtractFromPoster = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ExtractSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({
      scope: "event-poster-ai",
      limit: 30,
      windowSeconds: 60 * 60,
      identity: data.staffToken,
    });

    const { getAiGatewayConfig } = await import("./ai-gateway.server");
    const ai = getAiGatewayConfig();

    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
    const res = await fetch(ai.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          {
            role: "system",
            content:
              'Extract event info from the poster image. Reply with ONLY a strict JSON object: {"title": string, "description": string, "location": string, "event_date": "YYYY-MM-DD" or null}. Be concise. Infer the year if not shown; if no year, omit.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Read this event poster and return the JSON." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI extraction failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const GatewayResponse = z.object({
      choices: z
        .array(z.object({ message: z.object({ content: z.string().optional() }) }))
        .optional(),
    });
    const json = GatewayResponse.safeParse(await res.json());
    const content = json.success ? (json.data.choices?.[0]?.message.content ?? "{}") : "{}";
    // Strip code fences if present
    const cleaned = content
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    let parsed: {
      title?: string;
      description?: string;
      location?: string;
      event_date?: string | null;
    } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to find first {...} block
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          /* leave empty */
        }
      }
    }
    return {
      title: parsed.title?.toString().slice(0, 200) ?? "",
      description: parsed.description?.toString().slice(0, 2000) ?? "",
      location: parsed.location?.toString().slice(0, 200) ?? "",
      event_date:
        parsed.event_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.event_date)
          ? parsed.event_date
          : null,
    };
  });

// ---------- Staff: create event (optionally with poster upload) ----------
const CreateSchema = z.object({
  staffToken: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(200).optional(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  posterBase64: z.string().max(5_000_000).optional(),
  posterMime: z.string().max(100).optional(),
  posterFileName: z.string().max(200).optional(),
});

const ALLOWED_POSTER_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export const eventCreate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let posterPath: string | null = null;
    if (data.posterBase64 && data.posterMime) {
      if (!ALLOWED_POSTER_MIME.has(data.posterMime)) {
        throw new Error("Poster must be PNG, JPEG, WebP, or GIF.");
      }
      const bytes = Uint8Array.from(atob(data.posterBase64), (c) => c.charCodeAt(0));
      const safeName = (data.posterFileName ?? "poster").replace(/[^a-zA-Z0-9._-]/g, "_");
      posterPath = `${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("event-posters")
        .upload(posterPath, bytes, { contentType: data.posterMime, upsert: false });
      if (upErr) throw new Error(upErr.message);
    }

    const { data: row, error } = await supabaseAdmin
      .from("events")
      .insert({
        title: data.title,
        description: data.description ?? null,
        location: data.location ?? null,
        event_date: data.eventDate ?? null,
        poster_url: posterPath,
      })
      .select()
      .single();
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ...row, poster_url: await signPoster(posterPath) } as EventRow;
  });

// ---------- Staff: delete ----------
const DeleteSchema = z.object({ staffToken: z.string().min(1), id: z.string().uuid() });

export const eventDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DeleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("events")
      .select("poster_url")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.poster_url) {
      await supabaseAdmin.storage.from("event-posters").remove([existing.poster_url]);
    }
    const { error } = await supabaseAdmin.from("events").delete().eq("id", data.id);
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ok: true as const };
  });
