import { LowerThirdBar } from "@/components/lower-third/LowerThirdBar";
import type { VideoparadaEntry } from "../data/testProps";

/** Wrapper Remotion do Lower Third oficial (`admin/lower-thirds-youtube`). */
export function LowerThird({
  entry,
  chartName,
  weekLabel,
  format = "vertical",
}: {
  entry: VideoparadaEntry;
  chartName: string;
  weekLabel: string;
  format?: "vertical" | "landscape";
}) {
  const landscape = format === "landscape";
  // Escala para 1080p — o admin usa ~1x em preview 960px.
  const scale = landscape ? 1.85 : 1.65;

  return (
    <LowerThirdBar
      entry={{
        position: entry.position,
        title: entry.title,
        artist: entry.artist,
        coverUrl: entry.coverUrl,
        coverPalette: entry.coverPalette,
        coverSeed: entry.position * 31,
        status: entry.isDebut ? "new" : entry.status,
        delta: entry.delta,
        peak: entry.peak,
        weeks: entry.weeks,
        numberOnes: entry.numberOnes,
      }}
      weekLabel={weekLabel}
      format={landscape ? "landscape" : "portrait"}
      chartLabel={chartName}
      scale={scale}
    />
  );
}
