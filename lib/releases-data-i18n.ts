import type { Locale } from "@/lib/i18n/config";
import { RELEASES, TAG_META, type Release, type ReleaseTag } from "@/lib/releases-data";

const RELEASES_EN: Release[] = [
  {
    date: "2026-05-26",
    label: "May 26, 2026",
    entries: [
      {
        title: "Second chart",
        tag: "novo",
        description:
          "You can now have up to 2 charts on ChartFM. The second chart can be created in Settings, Charts tab. It works independently — with its own name, size, and genres — but earns fewer points and does not count toward the Global Chart ranking.",
      },
      {
        title: "Dropouts tab on Global Chart",
        tag: "novo",
        description:
          "The Global Chart has a third tab: Dropouts. It lists every song that was in the top 100 last week but not this week, with the position it held and a highlight badge.",
      },
      {
        title: "Dropouts tab on personal charts",
        tag: "novo",
        description:
          "Each personal chart page also has a Dropouts tab showing songs that fell off since the last publish — with weeks on chart and peak position.",
      },
      {
        title: "Comment replies",
        tag: "novo",
        description:
          "You can now reply directly to a comment on a chart page. Each comment shows reply count and a button to expand or write a reply.",
      },
    ],
  },
  {
    date: "2026-05-22",
    label: "May 22, 2026",
    entries: [
      {
        title: "CriticsFM mobile improvements",
        tag: "design",
        description:
          "CriticsFM works better on small screens: search and filters stack vertically, the add-album button sits beside sort, and the album grid uses two columns on mobile.",
      },
      {
        title: "Global Chart always fresh",
        tag: "fix",
        description:
          "Fixed an issue where the Global Chart could show cached data for up to an hour. Data is now always fetched in real time.",
      },
    ],
  },
];

const TAG_META_EN: Record<ReleaseTag, { label: string; color: string; bg: string }> = {
  novo: { label: "New", color: "#FA243C", bg: "rgba(250,36,60,0.1)" },
  melhoria: { label: "Improvement", color: "#0A84FF", bg: "rgba(10,132,255,0.1)" },
  fix: { label: "Fix", color: "#34C759", bg: "rgba(52,199,89,0.1)" },
  design: { label: "Design", color: "#AF52DE", bg: "rgba(175,82,222,0.1)" },
};

export function getReleases(locale: Locale): Release[] {
  return locale === "en" ? RELEASES_EN : RELEASES;
}

export function getReleaseTagMeta(locale: Locale): Record<ReleaseTag, { label: string; color: string; bg: string }> {
  return locale === "en" ? TAG_META_EN : TAG_META;
}
