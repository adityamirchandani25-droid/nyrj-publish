import { createFileRoute } from "@tanstack/react-router";

/**
 * Google Scholar requires the URL in `citation_pdf_url` to serve the full text
 * PDF directly, on the same host as the abstract page, with no login, no
 * expiring token and no cross-domain redirect. So we proxy the bytes.
 */
export const Route = createFileRoute("/api/public/article/$slug/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await (supabaseAdmin as any)
          .from("library_entries")
          .select("file_path, file_name")
          .eq("slug", params.slug)
          .maybeSingle();
        if (!row?.file_path) return new Response("Not found", { status: 404 });

        const { data: file, error } = await supabaseAdmin.storage
          .from("library")
          .download(row.file_path);
        if (error || !file) return new Response("Not found", { status: 404 });

        const name = String(row.file_name ?? `${params.slug}.pdf`).replace(/[^\w.\-]+/g, "_");
        const buffer = await file.arrayBuffer();

        return new Response(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(buffer.byteLength),
            "Content-Disposition": `inline; filename="${name}"`,
            "Cache-Control": "public, max-age=3600",
            "X-Robots-Tag": "all",
          },
        });
      },
    },
  },
});
