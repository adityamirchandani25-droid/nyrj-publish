import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { runEditorialFollowups } = await import("@/lib/editorial-followups.server");
    return Response.json(await runEditorialFollowups());
  } catch (error) {
    console.error("[editorial-followups] failed:", error);
    return Response.json({ error: "Editorial follow-ups failed" }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/editorial-followups")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
