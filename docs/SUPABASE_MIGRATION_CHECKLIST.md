# Supabase migration completion checklist

The application is configured for project `udetpvcgkgvbevyxhxph`. Complete these remote steps before deploying. Do not run them against the former project used by the live site.

## 1. Restore application role grants

Apply `supabase/migrations/20260925014500_restore_application_role_grants.sql` to the new project through the Supabase migration workflow or SQL Editor. The migration grants only the table, sequence, schema, and function privileges used by the application. It does not change rows and does not disable RLS.

Then run:

```sh
npm run audit:supabase
```

Every application table should report `accessible: true`, and the library database/storage comparison should report no missing objects.

## 2. Repair the Auth migration at the source-data level

The read-only audit currently finds 92 `auth.users` rows but only one Auth identity. Existing email/password users need their original `auth.identities` records and compatible encrypted password data migrated from the source project, preserving user UUIDs. Use an authenticated source-project backup/export or Supabase support's supported Auth migration process.

Do not synthesize identities, reset passwords, or create replacement users. Rerun the audit afterward; `usersMissingIdentity` should be zero for users expected to sign in.

## 3. Configure Auth URLs

In the new project's Auth URL configuration, set the production Site URL and allow redirects for:

- `http://localhost:8080/**`
- the Vercel preview/production domains
- `https://nyrj.org/**` and the canonical `www` variant, if used

Test sign-up confirmation and password recovery links in addition to ordinary sign-in.

## 4. Configure deployment secrets

Copy the variables listed in `.env.example` into the Vercel project. Keep `SUPABASE_SERVICE_ROLE_KEY`, database credentials, staff/admin secrets, SendGrid credentials, AI credentials, and Microsoft Graph tokens server-only. Only variables prefixed with `VITE_` are intended for the browser bundle.

## 5. Manual smoke test

After the grants and Auth data are repaired, verify:

- Library list, article pages, and manuscript downloads
- Existing student login, persistence after refresh, logout, and submission tracking
- New account confirmation and password recovery
- Submission creation and manuscript upload
- Staff/admin login and role-gated pages
- Chapters, team/advisors, events/posters, guidance, and sponsor assets
- Editor/reviewer workflows and email delivery
- AI chat/poster extraction and Excel sync if those optional integrations are enabled

