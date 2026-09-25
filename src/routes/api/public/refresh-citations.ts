import { createFileRoute } from "@tanstack/react-router";

/**
 * Refreshes citation counts for every published article from the open
 * scholarly record (OpenAlex, falling back to Crossref).
 * Protected with the staff password as a bearer token; safe to call daily.
 */
async function run(request: Request) {
  const secret = process.env["STAFF_PASSWORD"];
  if (!secret) return new Response("Not configured", { status: 500 });
  const auth = request.headers.get("authorization") ?? "";
  const url = new URL(request.url);
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : (url.searchParams.get("key") ?? "");
  if (provided !== secret) return new Response("Unauthorized", { status: 401 });

  const { syncCitationCounts } = await import("@/lib/citations.server");
  try {
    const result = await syncCitationCounts();
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[citations] sync failed:", e);
    return new Response(JSON.stringify({ error: "sync failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/public/refresh-citations")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
