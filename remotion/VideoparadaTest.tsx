import { AbsoluteFill, Sequence } from "remotion";
import { Intro } from "./components/Intro";
import { Outro } from "./components/Outro";
import { PositionSlide } from "./components/PositionSlide";
import { PositionTransition } from "./components/PositionTransition";
import type { VideoparadaProps } from "./data/testProps";
import { timingForFormat } from "./data/timing";

export function VideoparadaTest({
  chartName,
  weekLabel,
  siteUrl,
  entries,
  format = "vertical",
}: VideoparadaProps) {
  const t = timingForFormat(format);
  let cursor = t.introFrames;
  // Contagem regressiva: #N … #1 (padrão de paradas / countdowns)
  const countdown = [...entries].sort((a, b) => b.position - a.position);

  return (
    <AbsoluteFill style={{ background: "#050506" }}>
      <Sequence durationInFrames={t.introFrames} name="Intro">
        <Intro chartName={chartName} weekLabel={weekLabel} />
      </Sequence>

      {countdown.map((entry, i) => {
        const from = cursor - (i === 0 ? 0 : t.transitionFrames);
        cursor = from + t.positionFrames;
        return (
          <Sequence
            key={`${entry.position}-${entry.title}`}
            from={from}
            durationInFrames={t.positionFrames}
            name={`#${entry.position}`}
          >
            <PositionSlide
              entry={entry}
              chartName={chartName}
              weekLabel={weekLabel}
              format={format}
              transitionInFrames={i > 0 ? t.transitionFrames : 0}
            />
            {i > 0 ? (
              <Sequence durationInFrames={t.transitionFrames} name={`wipe-#${entry.position}`}>
                <PositionTransition
                  position={entry.position}
                  durationInFrames={t.transitionFrames}
                />
              </Sequence>
            ) : null}
          </Sequence>
        );
      })}

      <Sequence from={cursor} durationInFrames={t.outroFrames} name="Outro">
        <Outro chartName={chartName} siteUrl={siteUrl} />
      </Sequence>
    </AbsoluteFill>
  );
}
