import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { syncGmailReviewReplies } = await import("@/lib/gmail-review-sync.server");
    const result = await syncGmailReviewReplies();
    return Response.json(result);
  } catch (error) {
    console.error("[gmail-review-sync] failed:", error);
    return Response.json({ error: "Review email sync failed" }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/sync-review-emails")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
