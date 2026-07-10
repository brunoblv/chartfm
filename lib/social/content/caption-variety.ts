import type { ChartHighlight } from "@/lib/social/content/chart-highlights";

function pick<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sentenceForHighlight(h: ChartHighlight, chartName: string): string {
  switch (h.type) {
    case "leader":
      if (h.isDebut) {
        return pick([
          `"${h.title}", de ${h.artist}, estreia direto na liderança do ${chartName}.`,
          `${h.artist} chega com tudo: "${h.title}" já nasce em #1 no ${chartName}.`,
          `Entrada avassaladora: "${h.title}", de ${h.artist}, estreia no topo do ${chartName}.`,
        ]);
      }
      if (h.numberOnes != null && h.numberOnes > 1) {
        return pick([
          `"${h.title}", de ${h.artist}, segue no topo do ${chartName}, já são ${h.numberOnes} semanas em #1.`,
          `${h.artist} mantém "${h.title}" na liderança do ${chartName} pela ${h.numberOnes}ª semana.`,
        ]);
      }
      return pick([
        `"${h.title}", de ${h.artist}, assume a liderança do ${chartName} nesta semana.`,
        `${h.artist} chega ao topo do ${chartName} com "${h.title}".`,
      ]);
    case "weeksAtOne":
      return pick([
        `${h.artist} conquista sua ${h.numberOnes}ª semana em #1 no ${chartName} com "${h.title}".`,
        `Marco na liderança: "${h.title}", de ${h.artist}, chega à ${h.numberOnes}ª semana consecutiva no topo.`,
      ]);
    case "riser":
      return pick([
        `A maior subida da semana foi "${h.title}", de ${h.artist}, que ganhou ${h.delta} posições e chegou à #${h.position}.`,
        `${h.artist} deu um salto: "${h.title}" avançou ${h.delta} posições até a #${h.position}.`,
        `Destaque de ascensão: "${h.title}" (${h.artist}) subiu ${h.delta} posições, agora na #${h.position}.`,
      ]);
    case "faller":
      return pick([
        `Já "${h.title}", de ${h.artist}, teve a maior queda da semana, saindo da #${h.prevPos} para a #${h.position}.`,
        `${h.artist} sentiu a queda: "${h.title}" caiu da #${h.prevPos} para a #${h.position}.`,
      ]);
    case "debut":
      return pick([
        `"${h.title}", de ${h.artist}, estreia na #${h.position}.`,
        `Chegando com força: "${h.title}" (${h.artist}) entra direto na #${h.position}.`,
      ]);
    case "growth":
      return pick([
        `A música que mais cresceu em pontos foi "${h.title}", de ${h.artist}.`,
        `"${h.title}", de ${h.artist}, teve o maior salto de pontuação da semana.`,
      ]);
    case "catalogMilestone":
      return pick([
        `${h.artist} chega à sua ${h.count}ª música diferente no ${chartName} com "${h.songTitle}".`,
        `Marco de carreira: ${h.artist} agora tem ${h.count} músicas diferentes que já passaram pelo ${chartName}.`,
      ]);
  }
}

/**
 * Monta um texto narrativo variado a partir dos destaques reais da semana — nunca inventa dados,
 * só varia a redação e a seleção/ordem das frases para não repetir sempre a mesma estrutura.
 * Não repete chartName/weekLabel no início porque a legenda já mostra isso no cabeçalho.
 */
export function buildVariedChartNarrative(highlights: ChartHighlight[], chartName: string, weekLabel: string): string | null {
  void weekLabel;
  if (highlights.length === 0) return null;

  const leaderIdx = highlights.findIndex((h) => h.type === "weeksAtOne");
  const leader = leaderIdx >= 0 ? highlights[leaderIdx] : highlights.find((h) => h.type === "leader");
  const rest = highlights.filter((h) => h !== leader && h.type !== "leader");

  const chosenRest = shuffle(rest).slice(0, 2);
  const sentences = [leader, ...chosenRest].filter((h): h is ChartHighlight => Boolean(h)).map((h) => sentenceForHighlight(h, chartName));

  return sentences.join(" ") || null;
}

export type AlbumNarrativeFacts = {
  albumTitle: string;
  albumArtist: string;
  rating: number;
  reviewCount: number;
  scoreLabelText: string;
  albumTypeLabel: string | null; // "álbum" | "single" | "EP"
  totalTracks: number | null;
  label: string | null;
  daysSinceRelease: number | null;
};

function formatDaysSinceRelease(days: number): string {
  if (days <= 7) return "lançado nesta semana";
  if (days <= 31) return "lançado há poucas semanas";
  if (days <= 365) return "lançado neste ano";
  return "um clássico do catálogo";
}

export function buildVariedAlbumNarrative(facts: AlbumNarrativeFacts, kind: "ALBUM_REVIEW_MILESTONE" | "ALBUM_CLUB_WINNER"): string {
  const { albumTitle, albumArtist, rating, reviewCount, scoreLabelText, albumTypeLabel, totalTracks, label, daysSinceRelease } = facts;
  const typeLabel = albumTypeLabel ?? "álbum";
  const sentences: string[] = [];

  if (kind === "ALBUM_CLUB_WINNER") {
    sentences.push(
      pick([
        `${albumTitle}, de ${albumArtist}, foi eleito o ${typeLabel} vencedor do Clube do Álbum pela comunidade do ChartFM.`,
        `A comunidade decidiu: ${albumTitle}, de ${albumArtist}, é o novo vencedor do Clube do Álbum.`,
      ]),
    );
  } else {
    const recency = daysSinceRelease != null && daysSinceRelease <= 31 ? formatDaysSinceRelease(daysSinceRelease) : null;
    sentences.push(
      pick([
        recency
          ? `${albumTitle}, ${recency}, é o novo ${typeLabel} de ${albumArtist} e já tem nota da crítica no ChartFM.`
          : `${albumTitle}, de ${albumArtist}, já tem nota da comunidade no ChartFM.`,
        `A crítica já se manifestou sobre ${albumTitle}, de ${albumArtist}.`,
      ]),
    );
  }

  sentences.push(
    pick([
      `Nota atual: ${rating}, ${scoreLabelText.toLowerCase()}, com base em ${reviewCount} avaliações.`,
      `${reviewCount} avaliações já foram registradas, com média de ${rating} pontos (${scoreLabelText.toLowerCase()}).`,
    ]),
  );

  const extras: string[] = [];
  if (totalTracks) extras.push(`O ${typeLabel} reúne ${totalTracks} faixa${totalTracks === 1 ? "" : "s"}.`);
  if (label) extras.push(`Lançamento pela ${label}.`);
  if (extras.length > 0) sentences.push(pick(extras));

  return sentences.join(" ");
}
