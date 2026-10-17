import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  "library_entries",
  "submissions",
  "manuscript_submissions",
  "profiles",
  "chapters",
  "site_settings",
  "editorial_team",
  "advisors",
  "events",
  "event_ideas",
  "guidance_videos",
  "sponsors",
  "team_members",
  "peer_reviewers",
  "review_assignments",
  "peer_review_email_replies",
  "review_audit_log",
  "initial_reviewers",
  "editor_accounts",
  "editor_recommendations",
  "manuscript_versions",
  "sent_emails",
];

const report = {
  project: new URL(url).hostname.split(".")[0],
  tables: {},
  schema: {},
  auth: {},
  storage: {},
};
let failed = false;

const requiredAutomationColumns = {
  manuscript_submissions: [
    "revision_requested_at",
    "revision_reminder_sent_at",
    "revision_staff_alert_sent_at",
  ],
  initial_reviewers: ["workload_reminder_sent_on"],
  review_assignments: [
    "no_response_notified_at",
    "no_response_followup_sent_at",
    "followup_staff_notified_at",
  ],
};

async function listStorageTree(bucket, prefix = "") {
  const objects = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const page = data ?? [];
    for (const item of page) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) objects.push(path);
      else objects.push(...(await listStorageTree(bucket, path)));
    }
    if (page.length < 1000) break;
    offset += page.length;
  }
  return objects;
}

for (const table of tables) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "count=exact",
    },
  });
  if (response.ok) {
    const contentRange = response.headers.get("content-range") ?? "";
    const total = Number(contentRange.split("/")[1]);
    report.tables[table] = {
      accessible: true,
      ...(Number.isFinite(total) ? { rows: total } : {}),
    };
  } else {
    failed = true;
    const body = await response.json().catch(() => ({}));
    report.tables[table] = {
      accessible: false,
      status: response.status,
      code: body.code,
      message: body.message || response.statusText,
    };
  }
}

for (const [table, columns] of Object.entries(requiredAutomationColumns)) {
  const response = await fetch(
    `${url}/rest/v1/${table}?select=${encodeURIComponent(columns.join(","))}&limit=0`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  if (response.ok) {
    report.schema[table] = { requiredColumnsPresent: true };
  } else {
    failed = true;
    const body = await response.json().catch(() => ({}));
    report.schema[table] = {
      requiredColumnsPresent: false,
      code: body.code,
      message: body.message || response.statusText,
    };
  }
}

const { data: revisionIntegrity, error: revisionIntegrityError } = await admin.rpc(
  "revision_integrity_healthcheck",
);
const revisionConstraintsPresent =
  !revisionIntegrityError &&
  revisionIntegrity?.version_unique_index === true &&
  revisionIntegrity?.token_unique_index === true;
report.schema.revisionIntegrity = revisionIntegrityError
  ? {
      ready: false,
      error: revisionIntegrityError.message,
    }
  : {
      ready: revisionConstraintsPresent,
      ...revisionIntegrity,
    };
if (!revisionConstraintsPresent) failed = true;

const {
  data: libraryRows,
  error: libraryError,
  count: libraryCount,
} = await admin.from("library_entries").select("file_path", { count: "exact" });

const requiredBuckets = [
  "library",
  "submissions",
  "advisor-photos",
  "sponsor-logos",
  "chapter-photos",
  "event-posters",
];
for (const bucket of requiredBuckets) {
  try {
    const objects = await listStorageTree(bucket);
    report.storage[bucket] = { accessible: true, objects: objects.length };
  } catch (error) {
    failed = true;
    report.storage[bucket] = {
      accessible: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const { data: openRevisions, error: openRevisionsError } = await admin
  .from("manuscript_submissions")
  .select("id,current_version")
  .eq("status", "waiting for edits")
  .neq("decision", "declined")
  .is("deleted_at", null)
  .not("resubmit_token", "is", null);
if (openRevisionsError) {
  report.storage.revisions = { error: openRevisionsError.message };
  failed = true;
} else {
  let strandedUploads = 0;
  for (const revision of openRevisions ?? []) {
    const { data: files, error } = await admin.storage
      .from("submissions")
      .list(`revisions/${revision.id}`, { limit: 1000 });
    if (error) {
      report.storage.revisions = { error: error.message };
      failed = true;
      break;
    }
    const expectedPrefix = `v${revision.current_version + 1}-`;
    if (
      (files ?? []).some(
        (file) =>
          file.id && file.name.startsWith(expectedPrefix) && Number(file.metadata?.size) > 0,
      )
    ) {
      strandedUploads += 1;
    }
  }
  if (!report.storage.revisions) {
    report.storage.revisions = {
      openWindows: openRevisions?.length ?? 0,
      strandedUploads,
    };
    if (strandedUploads > 0) failed = true;
  }
}

if (libraryError) {
  report.storage.library = { ...report.storage.library, databaseError: libraryError.message };
  failed = true;
} else {
  let libraryObjects = [];
  let storageError;
  try {
    libraryObjects = await listStorageTree("library");
  } catch (error) {
    storageError = error;
  }
  const objectNames = new Set(libraryObjects);
  const missingFiles = (libraryRows ?? [])
    .map((row) => row.file_path)
    .filter((path) => !objectNames.has(path));
  report.storage.library = storageError
    ? { error: storageError.message }
    : {
        databaseRows: libraryCount ?? libraryRows?.length ?? 0,
        objects: libraryObjects.length,
        missingReferencedFiles: missingFiles.length,
      };
  if (storageError || missingFiles.length) failed = true;
}

const userIds = [];
let confirmed = 0;
for (let page = 1; ; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) {
    report.auth.error = error.message;
    failed = true;
    break;
  }
  const users = data.users ?? [];
  userIds.push(...users.map((user) => user.id));
  confirmed += users.filter((user) => Boolean(user.email_confirmed_at)).length;
  if (users.length < 1000) break;
}

let identities = 0;
let usersMissingIdentity = 0;
for (const id of userIds) {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error) {
    failed = true;
    continue;
  }
  const identityCount = data.user.identities?.length ?? 0;
  identities += identityCount;
  if (identityCount === 0) usersMissingIdentity += 1;
}
report.auth = {
  ...report.auth,
  users: userIds.length,
  confirmed,
  identities,
  usersMissingIdentity,
};
if (usersMissingIdentity > 0) failed = true;

const publicResponse = await fetch(`${url}/rest/v1/library_entries?select=id&limit=1`, {
  headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
});
report.publicLibraryDirectAccess = {
  status: publicResponse.status,
  expected: "denied; public reads are served by a server function",
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = failed ? 1 : 0;
