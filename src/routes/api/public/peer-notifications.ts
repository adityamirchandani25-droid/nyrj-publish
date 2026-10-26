import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request) {
  const { rejectUnauthorizedCron } = await import("@/lib/cron-auth.server");
  const rejected = rejectUnauthorizedCron(request);
  if (rejected) return rejected;
  const {
    processDuePeerNotifications,
    queueRevisionNotifications,
    recoverRecentInvitations,
    notificationRolloutAt,
  } = await import("@/lib/peer-notifications.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Rebuild jobs only for revisions committed after this outbox was introduced;
  // older mail lacks a trustworthy delivery key and must be reconciled manually.
  const rolloutAt = await notificationRolloutAt();
  const { data: revisions, error } = await supabaseAdmin
    .from("manuscript_versions")
    .select("submission_id,version")
    .gte("version", 2)
    .gte("created_at", rolloutAt)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  for (const row of revisions ?? [])
    await queueRevisionNotifications(row.submission_id, row.version);
  const recoveredInvitations = await recoverRecentInvitations();
  const results = await processDuePeerNotifications();
  return Response.json({
    seededRevisions: revisions?.length ?? 0,
    recoveredInvitations,
    providerAccepted: results.filter((x) => x.status === "provider_accepted").length,
    failed: results.filter((x) => x.status === "failed").length,
  });
}

export const Route = createFileRoute("/api/public/peer-notifications")({
  server: { handlers: { GET: ({ request }) => run(request) } },
});
