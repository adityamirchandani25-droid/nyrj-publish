# Peer review workflow update — October 18, 2026

Implemented in the working tree. The updated application has not been deployed.

## Changes and testing

- **Reviewer feedback:** In `/review`, submit comments only, an annotated PDF/Word file only, or both. An empty submission is rejected in the browser and on the server. Each submission is saved in `review_feedback_versions`; a text-only round does not silently carry forward an old attachment. Open “Your feedback history” as the reviewer, or the paper's feedback history as staff, to check both rounds and their original files. After an author resubmits, reviewers previously marked “sent to author” are reopened for feedback on the new manuscript.
- **Sage staff mode:** Enter the existing staff password directly in Ask Sage, or use “Unlock staff mode” and the password field. The code is verified against server-only `STAFF_PASSWORD`; it is not stored in the chat transcript or sent to an AI provider. Operational answers query live Supabase rows and include the check time. Try “Are there any requests to accept?”, “Which papers are waiting on resubmission?”, “Which reviewers haven't sent comments yet?”, “Are our emails up to date?”, and `What's the status of "part of a paper title"?`. Queries include historical and legacy records. Generic “up to date” questions report actual outstanding work rather than making an unsupported yes/no claim. Unrecognized operational questions return a live overview and supported query suggestions. Exit staff mode to clear the conversation. Staff sessions expire after 12 hours and are kept in memory only. Public mode never loads these private rows.
- **Peer Reviewers dashboard:** A section at the top of `/admin/submissions` includes all papers, including completed, trashed, and published library-only records. Search by title/email, sort by updated time/title/status, and filter pending, comments sent, awaiting resubmission, or completed. “Comments sent” also finds papers whose overall state is awaiting resubmission. Expand a paper for feedback versions, notification delivery records, and reminder controls. The older Peer Reviewers tab still manages reviewer accounts.
- **Admin emails:** Every saved feedback version queues independent deliveries to Madhav (`madhavarora529@gmail.com`), Keyaan (`keyaanmerchant24@gmail.com`), and Anirudh (`Anirudh.Budumuru@gmail.com`), using the existing staff recipient configuration. This also covers email replies that staff mark as reviews. Failed recipients can be retried on the paper; the daily job retries pending/failed notifications without resending successful recipients. SendGrid acceptance is recorded; it is not an inbox-delivery receipt. A delivery left “sending” after an interrupted request is held for inspection rather than automatically duplicated.
- **Author reminders:** The existing authenticated daily `/api/public/editorial-followups` job now sends a reminder after 3 days, then no sooner than 3 days after the last attempt/delivery, with a maximum of 5 successful reminders per revision round. Failed attempts are retried on a later eligible run and do not consume a successful-reminder slot. The job checks status, round, deletion, decision, and pause state immediately before delivery. Resubmission or a closed paper stops reminders. Each paper shows delivery timestamps/statuses, errors, and Pause/Resume controls. Re-sending edits does not reset the round or cap. Pausing/resuming does not reset the cap. Separate revision rounds have separate caps.
- **Historical retention:** Opening the staff dashboard no longer automatically purges papers that have been in Trash for 30 days. That read-side deletion would also have deleted review history and reminder logs. Explicit staff permanent deletion remains available.

## Database changes actually applied

Project: `udetpvcgkgvbevyxhxph` (the configured, linked project).

Applied `supabase/migrations/20261018120000_review_history_and_revision_reminders.sql` and recorded it in Supabase migration history:

- Imported 7 tracking-only entries from `submissions` into `manuscript_submissions`, preserving original email, title, status, decision, and timestamps. The original tracking entries remain intact. `legacy_tracking_id` records their source. There are now 63 canonical manuscript records; matching legacy rows are not duplicated in the peer review overview. The overview and Sage also read the published library directly, adding its 1 paper without a matching submission, for 64 records in the historical overview. Matching papers already in the library are shown as completed while retaining their recorded workflow status.
- Preserved 8 surviving feedback records as historical versions, including existing attachment references. Earlier rounds that were overwritten before this migration cannot be recovered from the assignment field. Existing raw email replies remain separately accessible; they are not automatically treated as submitted reviews.
- Initialized all 9 active author revision windows with a request date and secure resubmission token. Dates use existing request dates, most recent sent feedback, or the paper's prior update/create date. Declined, published, and trashed papers do not receive reminders.
- Preserved any known prior single-reminder delivery in the new reminder log so it counts toward the cap.
- Added private, RLS-enabled `review_feedback_versions`, `review_staff_notifications`, and `revision_reminder_log` tables, service-role-only reminder claiming, per-paper pause state, and trigger-backed revision round management.
- Ran the initial batch: **6 author reminders and 6 admin notifications** (2 pending reviews × 3 admins) were accepted by SendGrid. Three revision windows were not yet due. The persisted per-paper logs are the delivery record.

## Deployment setup

The code still needs deployment to the Vercel project serving the site. Keep `STAFF_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, and `SENDGRID_API_KEY` server-only. The requested staff password already matches the local server configuration; no new plaintext code was added to frontend code or tracked configuration.

The existing `vercel.json` schedules `/api/public/editorial-followups` at 13:45 UTC daily. Ensure a random, server-only `CRON_SECRET` is configured in the production Vercel environment so Vercel's `Authorization: Bearer ...` requests pass the route's guard. `CRON_SECRET` was absent locally; production configuration has not been changed or verified. The initial batch ran directly through the application code; automatic future delivery depends on deploying this code and configuring that scheduled route.

Manual dry run (does not send):

```sh
node --env-file=.env.local scripts/run-review-workflow.mjs
```

Explicit real send (only currently eligible work; do not use for an ordinary smoke test):

```sh
node --env-file=.env.local scripts/run-review-workflow.mjs --send
```

## Verification

- `npm test`: 20 passing tests covering feedback alternatives and validation, historical status mapping, staff password/token enforcement, and existing security regressions.
- `npx tsc --noEmit`, targeted ESLint, and `npm run build` pass. The build checks frontend output for server secrets, including six-character secrets.
- `scripts/tests/review-workflow.sql` passed in a rollback-only database transaction: version preservation, attachment-only reviews, no duplicate versions on unrelated updates, revision-round preservation, pause/resume, overlapping claim exclusion, 3-day spacing, 5-reminder cap, automatic stop on resubmission, reviewer reopening, and private grants. Fixtures were rolled back; these checks send no mail.

Browser checks also verified direct-code Sage unlock, the live list of 9 awaiting-resubmission papers, staff gating after exit, the historical dashboard, status filtering, and a paper’s sent reminder log and pause control. The local browser test session was signed out afterward.
