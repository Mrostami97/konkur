import type { MetadataRoute } from "next";
import { absoluteUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/account/", "/today/", "/attempts/", "/choices/", "/*?*"] },
      { userAgent: ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "Google-Extended", "ClaudeBot", "PerplexityBot"], allow: ["/guides/", "/subjects/", "/articles/", "/resources/"], disallow: ["/admin/", "/account/", "/today/", "/attempts/"] },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
