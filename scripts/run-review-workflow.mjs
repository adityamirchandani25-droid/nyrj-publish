// Uses the same server implementation as the authenticated Vercel cron.
// Dry run is the default. --send sends real due reminders/admin notifications.
import path from "node:path";
import { createServer } from "vite";
const send = process.argv.includes("--send");
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  resolve: {
    alias: {
      "@": path.resolve("src"),
      "entities/lib/decode.js": path.resolve("node_modules/entities/lib/decode.js"),
      "entities/lib/encode.js": path.resolve("node_modules/entities/lib/encode.js"),
      entities: path.resolve("node_modules/entities"),
    },
  },
});
try {
  const workflow = await server.ssrLoadModule("/src/lib/review-workflow.server.ts");
  const overview = await workflow.reviewOverview();
  console.log(
    JSON.stringify({
      papers: overview.length,
      awaitingResubmission: overview.filter((p) => p.reviewStatus === "awaiting resubmission")
        .length,
      mode: send ? "send" : "dry-run",
    }),
  );
  if (send) {
    console.log(
      JSON.stringify({
        remindersSent: await workflow.sendRevisionReminders(),
        adminNotificationsSent: await workflow.dispatchReviewNotifications(),
      }),
    );
  }
} finally {
  await server.close();
}
