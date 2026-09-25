import { createFileRoute } from "@tanstack/react-router";

/**
 * Sends gentle follow-up reminders to peer reviewers.
 * Protected with the staff password as a bearer token; safe to call daily.
 */
async function run(request: Request) {
  const secret = process.env["STAFF_PASSWORD"];
  if (!secret) return new Response("Not configured", { status: 500 });
  const auth = request.headers.get("authorization") ?? "";
  const url = new URL(request.url);
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : (url.searchParams.get("key") ?? "");
  if (provided !== secret) return new Response("Unauthorized", { status: 401 });

  const { runReviewReminders } = await import("@/lib/peer-review.server");
  const { sweepInitialAssignments } = await import("@/lib/initial-reviewers.server");
  let initial: { assigned: number; pending: number } = { assigned: 0, pending: 0 };
  try {
    initial = await sweepInitialAssignments();
  } catch (e) {
    console.error("[reminders] initial reviewer sweep failed:", e);
  }
  const reminders = await runReviewReminders();
  const result = { ...reminders, initialAssignments: initial };
  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/review-reminders")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
