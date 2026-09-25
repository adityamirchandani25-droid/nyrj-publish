import { createFileRoute } from "@tanstack/react-router";

/**
 * Hands out any unassigned, still-pending papers to the initial reviewer
 * rotation and emails them. Protected with the staff password as a bearer
 * token (or ?key=), so it is safe to call on a schedule.
 */
async function run(request: Request) {
  const secret = process.env["STAFF_PASSWORD"];
  if (!secret) return new Response("Not configured", { status: 500 });
  const auth = request.headers.get("authorization") ?? "";
  const url = new URL(request.url);
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : (url.searchParams.get("key") ?? "");
  if (provided !== secret) return new Response("Unauthorized", { status: 401 });

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
