import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "vite";

const staticRoot = path.resolve(".vercel/output/static");
if (!fs.existsSync(staticRoot)) {
  throw new Error("Client build output was not found; run this check after vite build.");
}

const env = {
  ...loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), ""),
  ...process.env,
};
const secretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SENDGRID_API_KEY",
  "STAFF_PASSWORD",
  "AMBASSADOR_PASSWORD",
  "INITIAL_REVIEWER_ACCESS_CODE",
  "OPENAI_API_KEY",
  "AI_API_KEY",
  "MICROSOFT_EXCEL_API_KEY",
  "MICROSOFT_GRAPH_ACCESS_TOKEN",
  "LOVABLE_API_KEY",
  "GOOGLE_SEARCH_CONSOLE_API_KEY",
  "CRON_SECRET",
  "RATE_LIMIT_SECRET",
];
const forbiddenClientMarkers = [
  ...secretNames,
  "process.env",
  "api.openai.com",
  "api.sendgrid.com",
  "graph.microsoft.com",
];

const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(location);
    else files.push(location);
  }
}
walk(staticRoot);

const violations = [];
for (const file of files) {
  let contents;
  try {
    contents = fs.readFileSync(file);
  } catch {
    continue;
  }
  const relative = path.relative(staticRoot, file);
  for (const name of secretNames) {
    const value = env[name];
    if (value && value.length >= 8 && contents.includes(value)) {
      violations.push(`${relative}: contains ${name}`);
    }
  }
  const text = contents.toString("utf8");
  for (const marker of forbiddenClientMarkers) {
    if (text.includes(marker)) {
      violations.push(`${relative}: contains server-only marker ${marker}`);
    }
  }
}

if (violations.length) {
  console.error("Client security check failed:\n" + violations.join("\n"));
  process.exit(1);
}

console.log(`Client security check passed (${files.length} built files scanned).`);
