import type { Locale } from "@/lib/i18n/config";
import { RELEASES, TAG_META, type Release, type ReleaseTag } from "@/lib/releases-data";

const RELEASES_EN: Release[] = [
  {
    date: "2026-07-03",
    label: "July 3, 2026",
    entries: [
      {
        title: "Context text on song, artist, and chart pages",
        tag: "melhoria",
        description:
          "Song, artist, album, chart, and community pages now include an explanatory paragraph built from that entity's real data: Global 100 position, weeks on chart, ratings, and history. Helps you understand what you're looking at without knowing the platform rules upfront.",
      },
      {
        title: "New guides and FAQ",
        tag: "novo",
        description:
          "Five new guides are live: ChartFM Glossary, How scoring works, How the Copa works, How to import your Last.fm/Spotify history, and How to review albums. There's also a FAQ page with the most common questions in one place. Visit /guides and /faq.",
      },
      {
        title: "Global 100 archive",
        tag: "novo",
        description:
          "Every consolidated Global 100 week is now browsable in the archive at /global/100/arquivo. Each entry shows that week's #1 track and a link to the full chart.",
      },
      {
        title: "2026 year in review",
        tag: "novo",
        description:
          "The year in Global 100 numbers: the retrospective page consolidates 2026 highlights from weekly snapshots. Available at /global/retrospectiva-2026.",
      },
      {
        title: "Weekly editorial from real data",
        tag: "melhoria",
        description:
          "The Global 100 editorial is now assembled automatically from the week's numbers (leader, biggest rise, biggest fall, debuts, and returns), with no AI generation. Each sentence only appears when the data exists.",
      },
      {
        title: "Week calendar when creating a chart",
        tag: "novo",
        description:
          "The create chart page now has a visual week calendar for picking the week, handy for retroactive charts or checking the exact date range before saving.",
      },
    ],
  },
  {
    date: "2026-07-01",
    label: "July 1, 2026",
    entries: [
      {
        title: "Platform news in the feed",
        tag: "novo",
        description:
          "The feed's News tab now shows automatic posts from ChartFM: when the Copa publishes a round, Push advances, or another relevant event happens, a card appears in the feed with a direct link.",
      },
      {
        title: "Communities in the main menu",
        tag: "design",
        description:
          "Communities got a fixed shortcut in the sidebar, between Global and Push, no need to go through Discover to find your groups.",
      },
      {
        title: "Flashback and Spotlight on charts",
        tag: "novo",
        description:
          "When creating or editing a chart, you can mark one song as Flashback (a nod to past weeks) and another as Spotlight. On the published page, side cards highlight those picks alongside the main list.",
      },
      {
        title: "Comments panel on chart pages",
        tag: "melhoria",
        description:
          "Chart pages now have a dedicated comments panel, with a toggle between the list and comments on mobile and a side layout on desktop, no need to scroll to the bottom of the page.",
      },
      {
        title: "Streak on the home screen",
        tag: "novo",
        description:
          "The home page now shows your streak of consecutive weeks publishing a chart, plus a quick shortcut to build this week's chart. The counter also appears in the sidebar when you're logged in.",
      },
      {
        title: "Listen on Spotify and YouTube on Global 100",
        tag: "melhoria",
        description:
          "Global 100 playback buttons were reorganized: Spotify and YouTube listen links are grouped at the top of the chart, with easier access across all variants (100, Airplay, genres, and albums).",
      },
    ],
  },
  {
    date: "2026-06-23",
    label: "June 23, 2026",
    entries: [
      {
        title: "Copa ChartFM",
        tag: "novo",
        description:
          "An artist knockout tournament driven by community votes. Each artist fields 8 songs; in the group stage and bracket, you vote on song-vs-song matchups. Follow live at /copa/ao-vivo, see groups, bracket, and full rules.",
      },
      {
        title: "Push intro screen",
        tag: "design",
        description:
          "First-time Push visitors see an intro screen explaining how the game works before joining a round.",
      },
    ],
  },
  {
    date: "2026-06-20",
    label: "June 20, 2026",
    entries: [
      {
        title: "Like comments",
        tag: "novo",
        description:
          "You can now like comments on chart pages. Tap the heart next to a comment, the author gets a notification. Tap again to remove your like.",
      },
      {
        title: "Listen to charts on YouTube",
        tag: "novo",
        description:
          "Global 100 and Global Airplay now have a button to listen to the week's chart on YouTube when a playlist is available.",
      },
      {
        title: "Drag songs on mobile",
        tag: "melhoria",
        description:
          "When editing a chart on your phone, you can now reorder songs by dragging with your finger.",
      },
    ],
  },
  {
    date: "2026-06-18",
    label: "June 18, 2026",
    entries: [
      {
        title: "Push",
        tag: "novo",
        description:
          "A new community game: each round you pick one song, listen to everyone else's picks, and build your personal ranking. Winners are crowned at the end. Find it in the Push menu, with round history and an overall participant leaderboard.",
      },
      {
        title: "CriticsFM menu in the sidebar",
        tag: "design",
        description:
          "CriticsFM has a submenu in the sidebar with shortcuts to the catalog, Releases, Album Club, and Reviews.",
      },
    ],
  },
  {
    date: "2026-06-14",
    label: "June 14, 2026",
    entries: [
      {
        title: "#1 history on profile",
        tag: "novo",
        description:
          "The profile Stats tab has a new #1s section with every song that reached number one: week counts and distinct #1 tracks. You can filter by year.",
      },
    ],
  },
  {
    date: "2026-06-09",
    label: "June 9, 2026",
    entries: [
      {
        title: "What's New with categories",
        tag: "design",
        description:
          "The 'What's New' page now has tabs to filter by category: New features, Improvements, Bug fixes, and Design. Each tab shows a counter with the total items in that category.",
      },
    ],
  },
  {
    date: "2026-06-07",
    label: "June 7, 2026",
    entries: [
      {
        title: "Weekly Releases",
        tag: "novo",
        description:
          "CriticsFM has a dedicated section for weekly music releases. A banner on the main page highlights selected albums, and at /criticsfm/lancamentos you can listen, quick-rate, and open each album on Spotify. Past weeks are available under Releases → History.",
      },
      {
        title: "Second chart scoring adjusted",
        tag: "melhoria",
        description:
          "Maximum points per position on the second chart were reduced from 20 to 10, better balancing it against the primary chart. Copy and calculations across the site were updated to match.",
      },
    ],
  },
  {
    date: "2026-06-02",
    label: "June 2, 2026",
    entries: [
      {
        title: "English language support",
        tag: "novo",
        description:
          "ChartFM is now available in Portuguese and English. Use the language switcher in the sidebar or Settings, your choice is saved in the browser and applied across all pages, including metadata and UI text.",
      },
    ],
  },
  {
    date: "2026-05-30",
    label: "May 30, 2026",
    entries: [
      {
        title: "Album Club",
        tag: "novo",
        description:
          "A weekly collective album discovery round on CriticsFM. Each week has a theme: participants nominate albums, vote in the poll, then enter a listening period to review the winner. Visit /criticsfm/clube; past rounds are under Club → History.",
      },
      {
        title: "New CriticsFM home",
        tag: "design",
        description:
          "The CriticsFM page was reorganized with clearer sections: Top Albums (community highest scores), Album Club banner, Weekly Releases, and a dedicated link to all reviews. Albums need at least two reviews to appear in the catalog.",
      },
    ],
  },
  {
    date: "2026-05-28",
    label: "May 28, 2026",
    entries: [
      {
        title: "Music video on song pages",
        tag: "novo",
        description:
          "Each song page has a Music Video tab. You can upload a clip capture, vote on community options, and choose which appears at the top and on charts in Video Clip mode. The most-voted clip is the default when you have not picked one.",
      },
      {
        title: "Year filter on profile",
        tag: "novo",
        description:
          "On the profile Stats tab you can switch between overall and a specific year. Top artists and songs are recalculated from that year's charts only, making it easier to revisit past seasons.",
      },
      {
        title: "Profile menu on mobile",
        tag: "novo",
        description:
          "The bottom navigation bar on mobile opens a menu when you tap Profile, with a shortcut to your page and sign out, no need to open Settings.",
      },
      {
        title: "Mobile chart layout",
        tag: "design",
        description:
          "List and Video Clip chart views were refined for small screens: consistent cover sizes, personal and global #1 badges on entries, and better vertical spacing in clip mode.",
      },
      {
        title: "Automatic image compression",
        tag: "melhoria",
        description:
          "Chart logo and video clip uploads are now compressed automatically before upload, reducing file size without visible quality loss and speeding up loading.",
      },
    ],
  },
  {
    date: "2026-05-26",
    label: "May 26, 2026",
    entries: [
      {
        title: "Second chart",
        tag: "novo",
        description:
          "You can now have up to 2 charts on ChartFM. The second chart can be created in Settings, Charts tab. It works independently (with its own name, size, and genres), but earns fewer points and does not count toward the Global Chart ranking.",
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
          "Each personal chart page also has a Dropouts tab showing songs that fell off since the last publish, with weeks on chart and peak position.",
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
