import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { listArticleSlugs } from "@/lib/articles.functions";
import { listChapters } from "@/lib/ambassadors.functions";

const BASE_URL = "https://nyrj.org";

const STATIC_PATHS = [
  { path: "/", priority: "1.0", changefreq: "weekly" as const },
  { path: "/about", priority: "0.7", changefreq: "weekly" as const },
  { path: "/advisors", priority: "0.6", changefreq: "weekly" as const },
  { path: "/archive", priority: "0.9", changefreq: "weekly" as const },
  { path: "/contact", priority: "0.5", changefreq: "yearly" as const },
  { path: "/editors", priority: "0.6", changefreq: "weekly" as const },
  { path: "/events", priority: "0.6", changefreq: "weekly" as const },
  { path: "/guidance", priority: "0.6", changefreq: "weekly" as const },
  { path: "/guidelines", priority: "0.6", changefreq: "weekly" as const },
  { path: "/metrics", priority: "0.5", changefreq: "weekly" as const },
  { path: "/submit", priority: "0.7", changefreq: "weekly" as const },
  { path: "/team", priority: "0.6", changefreq: "weekly" as const },
  { path: "/track", priority: "0.4", changefreq: "weekly" as const },
  { path: "/chapters", priority: "0.6", changefreq: "weekly" as const },
  { path: "/privacy", priority: "0.3", changefreq: "yearly" as const },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const articles = await listArticleSlugs();
        const articleUrls = articles
          .filter((a) => a.slug)
          .map((a) => {
            const lastmod = (a.publication_date ?? a.added_at).slice(0, 10);
            return [
              "  <url>",
              `    <loc>${BASE_URL}/article/${a.slug}</loc>`,
              `    <lastmod>${lastmod}</lastmod>`,
              `    <changefreq>yearly</changefreq>`,
              `    <priority>0.8</priority>`,
              "  </url>",
            ].join("\n");
          });

        const chapters = await listChapters();
        const chapterUrls = chapters
          .filter((c) => c.slug)
          .map((c) =>
            [
              "  <url>",
              `    <loc>${BASE_URL}/chapters/${c.slug}</loc>`,
              `    <lastmod>${c.updated_at.slice(0, 10)}</lastmod>`,
              `    <changefreq>weekly</changefreq>`,
              `    <priority>0.5</priority>`,
              "  </url>",
            ].join("\n"),
          );

        const staticUrls = STATIC_PATHS.map(
          (e) =>
            [
              "  <url>",
              `    <loc>${BASE_URL}${e.path}</loc>`,
              `    <changefreq>${e.changefreq}</changefreq>`,
              `    <priority>${e.priority}</priority>`,
              "  </url>",
            ].join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...staticUrls,
          ...articleUrls,
          ...chapterUrls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
