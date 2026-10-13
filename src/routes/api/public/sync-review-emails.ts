import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request) {
  const { rejectUnauthorizedCron } = await import("@/lib/cron-auth.server");
  const rejected = rejectUnauthorizedCron(request);
  if (rejected) return rejected;
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
