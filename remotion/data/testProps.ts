import { staticFile } from "remotion";
import type { RemotionVideoparadaEntry, RemotionVideoparadaProps } from "@/lib/videoparada-shared";
import {
  calcDurationFrames,
  FPS,
  HEIGHT,
  INTRO_FRAMES,
  OUTRO_FRAMES,
  POSITION_FRAMES,
  TRANSITION_FRAMES,
  WIDTH,
} from "./timing";

export type VideoparadaEntry = RemotionVideoparadaEntry;
export type VideoparadaProps = RemotionVideoparadaProps;

export {
  calcDurationFrames,
  FPS,
  HEIGHT,
  INTRO_FRAMES,
  OUTRO_FRAMES,
  POSITION_FRAMES,
  TRANSITION_FRAMES,
  WIDTH,
};

const DEMO_VERTICAL = staticFile("videoparada/demo-vertical.mp4");

/** Dados de teste — sem dependência de DB/yt-dlp. */
export const TEST_VIDEOPARADA_PROPS: VideoparadaProps = {
  chartName: "Top 100 Global",
  weekLabel: "Semana de teste",
  siteUrl: "chartfm.com",
  format: "vertical",
  entries: [
    {
      position: 1,
      title: "APT.",
      artist: "ROSÉ & Bruno Mars",
      coverUrl: null,
      coverPalette: ["#FA243C", "#FF5858"],
      status: "same",
      delta: 0,
      isDebut: false,
      peak: 1,
      weeks: 12,
      numberOnes: 4,
      videoSrc: DEMO_VERTICAL,
    },
    {
      position: 2,
      title: "Die With A Smile",
      artist: "Lady Gaga & Bruno Mars",
      coverUrl: null,
      coverPalette: ["#6A0572", "#FF5858"],
      status: "up",
      delta: 3,
      isDebut: false,
      peak: 2,
      weeks: 8,
      numberOnes: 0,
      videoSrc: DEMO_VERTICAL,
    },
    {
      position: 3,
      title: "Ordinary",
      artist: "Alex Warren",
      coverUrl: null,
      coverPalette: ["#009C3B", "#FFDF00"],
      status: "new",
      delta: null,
      isDebut: true,
      peak: 3,
      weeks: 1,
      numberOnes: 0,
      videoSrc: DEMO_VERTICAL,
    },
  ],
};
