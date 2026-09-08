import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "../lib/seo";

const privatePaths = [
  "/admin",
  "/account",
  "/today",
  "/attempts",
  "/choices",
  "/login",
  "/lessons",
  "/rank-estimate",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      {
        userAgent: ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "Google-Extended", "ClaudeBot", "PerplexityBot"],
        allow: ["/guides/", "/subjects/", "/topics/", "/articles/", "/resources/", "/authors/", "/report-cards"],
        disallow: privatePaths,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
