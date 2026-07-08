import type { MetadataRoute } from "next";
import { getEditorialPicksSorted } from "@/lib/editorial-picks";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://chartfm.com.br";
  const now = new Date();
  const editorialPosts = (await getEditorialPicksSorted()).map((pick) => ({
    url: `${base}/editorial/${pick.slug}`,
    lastModified: new Date(pick.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/discover`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/global`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/global/100`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${base}/global/airplay`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${base}/global/albums`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${base}/communities`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/albums`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/criticsfm`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy-policy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms-of-use`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/whats-new`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/editorial`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    ...editorialPosts,
  ];
}
