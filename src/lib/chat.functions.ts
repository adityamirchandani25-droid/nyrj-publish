import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

// Roles are assigned by the server, never by the caller: the transcript always
// ends with the visitor's turn and alternates backwards from there.
const MessageSchema = z.object({
  role: z.string().max(20).optional(),
  content: z.string().min(1).max(4000),
});

const ChatSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
});

// Bound how much of the paid AI gateway visitors can consume. Sage stays open
// to the public (no sign-in), so spending is capped two ways: per visitor and
// across the whole site, and the transcript length itself is bounded above.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const chatHits = new Map<string, { count: number; firstAt: number }>();

const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_MAX = 200;
let globalWindow = { count: 0, firstAt: Date.now() };

const BUSY_MESSAGE =
  "Sage is taking a short break right now. Please try again in a little while, or email NYRJINFO@Gmail.com and a person from our team will help.";

function checkChatRateLimit(ip: string) {
  const now = Date.now();

  if (now - globalWindow.firstAt > GLOBAL_WINDOW_MS) {
    globalWindow = { count: 0, firstAt: now };
  }
  globalWindow.count += 1;
  if (globalWindow.count > GLOBAL_MAX) throw new Error(BUSY_MESSAGE);

  const rec = chatHits.get(ip);
  if (!rec || now - rec.firstAt > RATE_WINDOW_MS) {
    chatHits.set(ip, { count: 1, firstAt: now });
    return;
  }
  rec.count += 1;
  if (rec.count > RATE_MAX) {
    throw new Error(
      "You've reached the limit for now. Please try again shortly, or email NYRJINFO@Gmail.com.",
    );
  }
}

const SYSTEM_PROMPT = `You are Sage — the warm, welcoming, sharp AI guide for the National Youth Research Journal (NYRJ). Visitors reach you through the "Ask Sage" button. Greet people kindly, thank them for their interest, and keep a confident, encouraging, student-friendly tone. Never make anyone feel their question is silly — young researchers of all ages come here.

If someone clearly needs a real person (a complaint, a sensitive or account-specific issue, anything you can't answer, or they simply ask for a human), warmly say a human from the NYRJ team is happy to help and give them NYRJINFO@Gmail.com to email.

About NYRJ:
- A peer-reviewed academic journal that publishes research by young researchers of any and all ages.
- ISSN 3143-3030. Fiscally sponsored under a 501(c)(3) nonprofit.
- Editorial process: Reviewer → Section Editor → Author revisions → Copy Editor → Publishing.
- Turnaround (median): 1 week to first response, 2 weeks to first peer review, 4.5 weeks to final publishing.
- Submissions go through the on-site form (no Google Forms). A student account is required.
- Manuscript formats: .doc, .docx, .pdf. Published papers get a permanent /article/<slug> URL based on the paper title.
- Every published article has a "Copy Citation" button.
- NYRJ is a Crossref member: published articles are assigned a DOI (a permanent digital identifier) so they can always be cited and found, and the metadata is registered for search engines and Google Scholar. Explain DOIs if asked, but note it's not advertised in the footer.
- Contact: NYRJINFO@Gmail.com.

Site map (use these exact paths when you link):
- / — Home
- /about — About & Mission
- /advisors — Advisors
- /team — NYRJ Team
- /metrics — Journal Metrics
- /archive — Library (all published articles)
- /submit — Submission overview
- /submit/apply — Open the on-site submission form
- /track — Track your submissions (student login required)
- /guidelines — Author Guidelines + FAQ
- /editors — Editing Process
- /guidance — Guidance videos & advisor contact
- /events — Conferences
- /contact — Contact
- /privacy — Privacy Policy
- /login — Student or staff login

Style & format:
- Be concise, warm, factual.
- You are allowed to share ANY information that appears publicly on the website — including names, roles, affiliations, and email addresses of the NYRJ Team and Advisory Board. If the visitor asks for the Chief Editor's email (or any team/advisor's email, role, or affiliation) and it's in the directory below, give it directly.
- ALWAYS end your response with a Markdown link to the most relevant page for the user's question, in this exact format on its own last line:
  → [Short Section Name](/path)
  Example: → [Submit a Manuscript](/submit/apply)
- Only ever use paths from the site map above. Never invent URLs.
- If something isn't in the directory or facts below, say you don't know and suggest emailing NYRJINFO@Gmail.com. Never invent facts about specific people, papers, or policies.`;

function formatDirectory(
  team: Array<{
    name: string;
    role: string | null;
    affiliation: string | null;
    email: string | null;
  }>,
  advisors: Array<{ name: string; title: string | null; affiliation: string | null }>,
): string {
  const lines: string[] = [];
  lines.push("NYRJ Team (current, from /team):");
  if (team.length === 0) lines.push("- (none listed yet)");
  for (const m of team) {
    const parts = [m.name];
    if (m.role) parts.push(`role: ${m.role}`);
    if (m.affiliation) parts.push(`affiliation: ${m.affiliation}`);
    if (m.email) parts.push(`email: ${m.email}`);
    lines.push(`- ${parts.join(" | ")}`);
  }
  lines.push("");
  lines.push("NYRJ Advisory Board (current, from /advisors):");
  if (advisors.length === 0) lines.push("- (none listed yet)");
  for (const a of advisors) {
    const parts = [a.name];
    if (a.title) parts.push(`title: ${a.title}`);
    if (a.affiliation) parts.push(`affiliation: ${a.affiliation}`);
    lines.push(`- ${parts.join(" | ")}`);
  }
  return lines.join("\n");
}

export const chatAssistant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ChatSchema.parse(d))
  .handler(async ({ data }) => {
    const { getAiGatewayConfig } = await import("./ai-gateway.server");
    const ai = getAiGatewayConfig();

    const ip =
      getRequestIP({ xForwardedFor: true }) ?? getRequestHeader("cf-connecting-ip") ?? "unknown";
    checkChatRateLimit(ip);

    // Server-owned roles: the newest message is always the visitor's, and the
    // transcript alternates backwards. Caller-supplied roles are discarded so
    // nobody can inject fake assistant turns.
    const total = data.messages.length;
    const turns = data.messages.map((m, i) => ({
      role: (total - 1 - i) % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    // Pull live directory info so the bot can answer "who is the chief editor / what's their email".
    let directory = "";
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [teamRes, advRes] = await Promise.all([
        supabaseAdmin
          .from("editorial_team")
          .select("name, role, affiliation, email")
          .order("position", { ascending: true }),
        supabaseAdmin
          .from("advisors")
          .select("name, title, affiliation")
          .order("position", { ascending: true }),
      ]);
      directory = formatDirectory(teamRes.data ?? [], advRes.data ?? []);
    } catch (err) {
      console.error("[chatAssistant] directory fetch failed:", err);
    }

    const systemContent = directory
      ? `${SYSTEM_PROMPT}\n\nPublic directory (safe to share verbatim):\n${directory}`
      : SYSTEM_PROMPT;

    const resp = await fetch(ai.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [{ role: "system", content: systemContent }, ...turns],
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[chatAssistant] gateway error:", resp.status, text);
      if (resp.status === 429) throw new Error("Too many requests. Please try again in a moment.");
      if (resp.status === 402)
        throw new Error("AI credits exhausted. Please email NYRJINFO@Gmail.com.");
      throw new Error("Assistant is unavailable right now.");
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Empty response from assistant.");
    return { reply };
  });
