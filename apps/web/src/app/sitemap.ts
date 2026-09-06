import type { MetadataRoute } from "next";
import { articles, editorialDateIso, guides, subjects } from "../content/editorial";
import { absoluteUrl } from "../lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = ["", "/guides", "/subjects", "/articles", "/resources", "/admissions", "/courses", "/exams", "/about", "/editorial-policy", "/corrections"];
  return [
    ...staticPages.map((path) => ({ url: absoluteUrl(path || "/"), lastModified: now, changeFrequency: path === "" ? "daily" as const : "weekly" as const, priority: path === "" ? 1 : .8 })),
    ...guides.map((page) => ({ url: absoluteUrl(`/guides/${page.slug}`), lastModified: new Date(editorialDateIso(page.reviewedAt)), changeFrequency: "weekly" as const, priority: .9 })),
    ...articles.map((page) => ({ url: absoluteUrl(`/articles/${page.slug}`), lastModified: new Date(editorialDateIso(page.reviewedAt)), changeFrequency: "monthly" as const, priority: .75 })),
    ...subjects.map((subject) => ({ url: absoluteUrl(`/subjects/${subject.slug}`), lastModified: now, changeFrequency: "weekly" as const, priority: .8 })),
  ];
}
