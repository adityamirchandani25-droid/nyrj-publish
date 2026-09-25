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
  auth: {},
  storage: {},
};
let failed = false;

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
