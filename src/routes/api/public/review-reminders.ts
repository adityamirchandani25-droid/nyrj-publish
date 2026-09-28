import { createFileRoute } from "@tanstack/react-router";

/**
 * Sends gentle follow-up reminders to peer reviewers.
 * Vercel sends CRON_SECRET as a bearer token for the daily production cron.
 */
async function run(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return new Response("Not configured", { status: 500 });
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

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
