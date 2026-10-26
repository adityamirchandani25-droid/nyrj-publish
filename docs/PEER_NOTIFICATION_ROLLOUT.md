# Peer notification rollout

The peer notification outbox is introduced by
`supabase/migrations/20261025120000_peer_notification_outbox.sql`. Apply this
migration before deploying the matching server code. Configure `CRON_SECRET`
in Vercel so `/api/public/peer-notifications` can process retries each day.
SendGrid responses establish provider acceptance only; inbox delivery needs
SendGrid event reconciliation or a recipient confirmation.

The cron rebuilds missing invitation and revision jobs created after the
migration's recorded install time. Older invitations and revisions need a
manual comparison of assignment state, `sent_emails`, SendGrid activity, and
recipient responses before they can be retried safely. No automatic replay of
older records is attempted because the historical email log can omit a
successful send if its database write failed. Avoid using the old archive retry
for reviewer invitations or revisions; these events now use the outbox.

After deployment, confirm the migration and `CRON_SECRET`, inspect the admin
reviewer monitoring table for `failed`, `retrying`, or `processing` rows,
verify SendGrid's message activity for the stored provider message IDs, and
test with controlled reviewer accounts before reconciling historical failures.
