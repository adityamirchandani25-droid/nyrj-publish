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
  const errors: string[] = [];
  let seededRevisions = 0;
  let recoveredInvitations = 0;
  try {
    const rolloutAt = await notificationRolloutAt();
    for (let offset = 0; ; offset += 100) {
      const { data: revisions, error } = await supabaseAdmin
        .from("manuscript_versions")
        .select("submission_id,version")
        .gte("version", 2)
        .gte("created_at", rolloutAt)
        .order("created_at", { ascending: true })
        .order("submission_id", { ascending: true })
        .range(offset, offset + 99);
      if (error) throw new Error(error.message);
      for (const row of revisions ?? []) {
        try {
          await queueRevisionNotifications(row.submission_id, row.version);
          seededRevisions++;
        } catch (cause) {
          console.error("[peer-notifications] revision recovery failed:", row, cause);
          errors.push(`revision ${row.submission_id} v${row.version}`);
        }
      }
      if ((revisions?.length ?? 0) < 100) break;
    }
  } catch (cause) {
    console.error("[peer-notifications] revision scan failed:", cause);
    errors.push("revision scan");
  }
  try {
    recoveredInvitations = await recoverRecentInvitations();
  } catch (cause) {
    console.error("[peer-notifications] invitation recovery failed:", cause);
    errors.push("invitation recovery");
  }
  const results = await processDuePeerNotifications();
  errors.push(
    ...results
      .filter((x) => x.status === "error" || x.status === "failed" || x.status === "uncertain")
      .map((x) => `job ${"id" in x ? x.id : "unknown"}`),
  );
  return Response.json(
    {
      seededRevisions,
      recoveredInvitations,
      providerAccepted: results.filter((x) => x.status === "provider_accepted").length,
      failed: results.filter((x) => x.status === "failed").length,
      errors,
    },
    { status: errors.length ? 500 : 200 },
  );
}

export const Route = createFileRoute("/api/public/peer-notifications")({
  server: { handlers: { GET: ({ request }) => run(request) } },
});
