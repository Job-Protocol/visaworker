import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { fetchActiveFirmSlugs } from "@/lib/firms";

const BASE_URL = "https://visaworker.ai";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/find-a-lawyer", changefreq: "weekly", priority: "0.9" },
          { path: "/find-a-lawyer/o-1", changefreq: "weekly", priority: "0.8" },
          { path: "/find-a-lawyer/eb-1a", changefreq: "weekly", priority: "0.8" },
          { path: "/find-a-lawyer/niw", changefreq: "weekly", priority: "0.8" },
          { path: "/for-lawyers", changefreq: "weekly", priority: "0.8" },
          { path: "/open-source", changefreq: "weekly", priority: "0.7" },
          { path: "/demo", changefreq: "weekly", priority: "0.6" },
          { path: "/auth", changefreq: "monthly", priority: "0.5" },
          { path: "/forgot-password", changefreq: "monthly", priority: "0.3" },
          { path: "/reset-password", changefreq: "monthly", priority: "0.3" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        // Fan out one URL per active firm.
        try {
          const slugs = await fetchActiveFirmSlugs();
          for (const slug of slugs) {
            entries.push({
              path: `/find-a-lawyer/${slug}`,
              changefreq: "monthly",
              priority: "0.6",
            });
          }
        } catch {
          // If the firms table is temporarily unreachable, still return static entries.
        }

        const urls = entries
          .map((e) =>
            [
              `  <url>`,
              `    <loc>${BASE_URL}${e.path}</loc>`,
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
              e.priority ? `    <priority>${e.priority}</priority>` : null,
              `  </url>`,
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

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
