# Reviewer email reply sync

The site can import replies sent to `NYRJINFO@gmail.com` into the matching manuscript's **Peer Review** panel. It reads the journal mailbox through the Gmail API once a day at 14:00 UTC. It does not send, delete, label, or archive Gmail messages.

## Activate

1. Apply the pending files in `supabase/migrations/` to the production Supabase database before deploying the matching code. The consolidated `20261012163000_editorial_automation.sql` migration is safe to apply when some columns were added manually earlier.
2. In a Google Cloud project, enable the Gmail API and create a web OAuth client. Authorize **NYRJINFO@gmail.com** with offline access and the `https://www.googleapis.com/auth/gmail.readonly` scope. Obtain that account's refresh token.
3. Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and a strong `CRON_SECRET` as server-only production environment variables. Vercel uses `CRON_SECRET` to authenticate all four daily jobs.
4. Deploy, then call `GET /api/public/sync-review-emails` with `Authorization: Bearer <CRON_SECRET>`. A healthy configured response has `"configured":true`; check `imported` and `unmatched` before relying on the scheduled run.

The OAuth app's public privacy policy must describe the Gmail data the site reads and stores. Keep the published `/privacy` page current before requesting Google's production verification. An external OAuth app in Testing gives short-lived refresh tokens; production use requires moving beyond Testing and satisfying Google's applicable verification requirements.

Google documents the [Gmail message list/get API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list) and [server-side OAuth refresh tokens](https://developers.google.com/identity/protocols/oauth2/web-server).

## Matching and review

New invitation and reminder subjects contain a stable `[NYRJ Review <assignment-id>]` marker. The importer requires the sender to match the assigned reviewer. For older email threads without a marker, it accepts a unique title match or a reviewer with only one eligible assignment. Ambiguous replies are skipped and counted as `unmatched`.

The panel shows email text and supported attachments (PDF, Word, JPEG, PNG, or plain text, up to 8 MB each). Staff can record an attachment-only reply as reviewer feedback. Staff decide whether an email is an acceptance, a decline, or actual review feedback. Simply receiving an email never automatically publishes reviewer comments to an author or changes the assignment's status.

The importer searches the most recent 30 days of messages sent to the journal mailbox and checks up to 300 messages per run. The Gmail message ID prevents duplicate entries on later runs.
