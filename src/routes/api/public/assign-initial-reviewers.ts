import { createFileRoute } from "@tanstack/react-router";

/**
 * Hands out any unassigned, still-pending papers to the initial reviewer
 * rotation and emails them. Requires CRON_SECRET (or the staff password) as a
 * bearer token; secrets are never accepted in the query string.
 */
async function run(request: Request) {
  const { rejectUnauthorizedCron } = await import("@/lib/cron-auth.server");
  const rejected = rejectUnauthorizedCron(request, [
    process.env.CRON_SECRET,
    process.env.STAFF_PASSWORD,
  ]);
  if (rejected) return rejected;

  const { sweepInitialAssignments } = await import("@/lib/initial-reviewers.server");
  const result = await sweepInitialAssignments();
  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/assign-initial-reviewers")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
