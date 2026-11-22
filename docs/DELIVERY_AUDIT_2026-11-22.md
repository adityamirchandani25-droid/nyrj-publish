# Delivery and reviewer backlog audit — November 22, 2026

Production checks were read-only except for queuing two assignment messages that SendGrid
definitively rejected with `401 Maximum credits exceeded`. No backlog email was sent.

## Findings

- SendGrid's expired credits are the current provider blocker. The website reaches the provider;
  the provider rejects the request before accepting delivery. Restoring credits on the same
  account is required before controlled delivery and spam tests can run.
- `sent_emails` contains 926 attempts: 701 marked accepted by SendGrid and 225 failed. These are
  attempts, not 225 distinct messages. The 159 failed `author-revision-overdue` attempts include
  repeated daily tries for the same staff alerts. Do not bulk replay this archive.
- The reviewer reminder cron selected `review_assignments.no_response_notified_at`, which is
  missing in production even though it exists in the migration files. That query aborts the entire
  reminder run. The server now uses the existing follow-up timestamp as a compatibility marker
  until the migration is applied. Apply the missing column in Supabase when database access is
  available: `ALTER TABLE public.review_assignments ADD COLUMN IF NOT EXISTS no_response_notified_at timestamptz;`.
- At the audit time, 27 open reviewer assignments were past their due dates; the broader 42
  overdue records also include closed or published manuscripts. The outbox held 39
  provider-accepted messages and no failed messages. Two active initial-reviewer assignment
  emails were conclusively rejected by the SendGrid quota; they are now queued in the outbox.
- Seven failed author revision reminder records still belong to active revision windows. Their
  three-day spacing rule means zero were due for retry at the audit time. The scheduled job will
  retry them when due after sending is restored. A provider-accepted record does not establish
  delivery to a recipient's inbox.

## Domain and provider visibility

- A previously received NYRJ message had SPF, DKIM, and DMARC pass in Gmail's authentication
  headers. Public DNS currently has SendGrid's `em473.nyrj.org` return-path CNAME and SPF record,
  both `s1` and `s2` DKIM CNAMEs, and DMARC `p=none`. The apex has no SPF TXT record, but the
  authenticated SendGrid return path passed SPF; an apex SPF change is not needed to address the
  current 401 rejection.
- Four historical NYRJ messages in the connected Gmail account were in Inbox and none matched
  a Spam-folder search. This is evidence for that controlled inbox before the quota failure,
  not a current delivery test or evidence for other recipients.
- The configured SendGrid API key gets `403 Missing Scope` for Email Activity and `403 access
  forbidden` for domain-authentication reads. Thus the site cannot currently distinguish
  delivered from bounced or check provider activity for prior reviewer invitations. Staff views
  label API acceptance as such and do not claim inbox delivery. Account access is needed to enable
  Email Activity or a signed Event Webhook for bounce reconciliation.
- A controlled inbox and spam-folder test remains pending until the SendGrid account can send.
  Test an NYRJ template to controlled Gmail addresses, then verify its inbox placement and raw
  authentication headers before releasing the queued backlog.

## Verification limits

The local type check, tests, and production build passed. Browser dashboard access was
unavailable in this session. Production currently has no editor or ambassador account records,
so no existing account could be used to test those login dashboards. The local code tests cover
the current and rotated ambassador code rules; a live valid-code signup needs the configured
production code and a test account after deployment.
