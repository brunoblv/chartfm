import React from "react";
import { Composition } from "remotion";
import { VideoparadaTest } from "./VideoparadaTest";
import {
  calcDurationFrames,
  FPS,
  TEST_VIDEOPARADA_PROPS,
  type VideoparadaProps,
} from "./data/testProps";
import { LANDSCAPE, VERTICAL } from "./data/timing";

const LANDSCAPE_PROPS: VideoparadaProps = {
  ...TEST_VIDEOPARADA_PROPS,
  format: "landscape",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoparadaVertical"
        component={VideoparadaTest}
        durationInFrames={calcDurationFrames(TEST_VIDEOPARADA_PROPS.entries.length, "vertical")}
        fps={FPS}
        width={VERTICAL.width}
        height={VERTICAL.height}
        defaultProps={TEST_VIDEOPARADA_PROPS}
        calculateMetadata={async ({ props }: { props: VideoparadaProps }) => {
          const format = props.format ?? "vertical";
          const t = format === "landscape" ? LANDSCAPE : VERTICAL;
          return {
            durationInFrames: calcDurationFrames(props.entries.length, format),
            width: t.width,
            height: t.height,
          };
        }}
      />
      <Composition
        id="VideoparadaLandscape"
        component={VideoparadaTest}
        durationInFrames={calcDurationFrames(LANDSCAPE_PROPS.entries.length, "landscape")}
        fps={FPS}
        width={LANDSCAPE.width}
        height={LANDSCAPE.height}
        defaultProps={LANDSCAPE_PROPS}
        calculateMetadata={async ({ props }: { props: VideoparadaProps }) => ({
          durationInFrames: calcDurationFrames(props.entries.length, "landscape"),
          width: LANDSCAPE.width,
          height: LANDSCAPE.height,
        })}
      />
      {/* Alias legado */}
      <Composition
        id="VideoparadaTest"
        component={VideoparadaTest}
        durationInFrames={calcDurationFrames(TEST_VIDEOPARADA_PROPS.entries.length, "vertical")}
        fps={FPS}
        width={VERTICAL.width}
        height={VERTICAL.height}
        defaultProps={TEST_VIDEOPARADA_PROPS}
        calculateMetadata={async ({ props }: { props: VideoparadaProps }) => {
          const format = props.format ?? "vertical";
          const t = format === "landscape" ? LANDSCAPE : VERTICAL;
          return {
            durationInFrames: calcDurationFrames(props.entries.length, format),
            width: t.width,
            height: t.height,
          };
        }}
      />
    </>
  );
};
