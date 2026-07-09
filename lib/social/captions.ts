import { formatHashtags } from "@/lib/social/hashtags";
import { absoluteSocialUrl } from "@/lib/social/config";

export type PlatformCaptions = {
  captionInstagram: string;
  captionFacebook: string;
  captionThreads: string;
  captionTelegram: string;
};

type AlbumReviewCaptionInput = {
  kind: "ALBUM_REVIEW_MILESTONE" | "ALBUM_CLUB_WINNER";
  albumTitle: string;
  albumArtist: string;
  scoreLabelText: string;
  rating: number;
  targetUrl: string;
  hashtags: string[];
};

/** Legendas por plataforma para o card de "nota" (avaliação/vencedor do Clube). Sem inventar fatos sobre o álbum. */
export function buildAlbumReviewCaptions(input: AlbumReviewCaptionInput): PlatformCaptions {
  const { albumTitle, albumArtist, scoreLabelText, rating, kind, hashtags } = input;
  const url = absoluteSocialUrl(input.targetUrl);
  const tags = formatHashtags(hashtags);

  const isWinner = kind === "ALBUM_CLUB_WINNER";
  const headline = isWinner
    ? `${albumTitle}, de ${albumArtist}, é o álbum vencedor do Clube do Álbum!`
    : `${albumTitle}, de ${albumArtist}, já tem nota da comunidade no ChartFM: ${rating} (${scoreLabelText.toLowerCase()}).`;

  return {
    captionInstagram: `${headline}\n\nOuça e avalie você também 🎧\n${url}\n\n${tags}`,
    captionFacebook: `${headline}\n\n${isWinner ? "Confira o álbum vencedor do Clube do Álbum e deixe sua nota no ChartFM." : "Já ouviu? Deixe sua nota e sua opinião no ChartFM."}\n${url}`,
    captionThreads: `${isWinner ? `${albumTitle} venceu o Clube do Álbum 🏆` : `${albumTitle} já tem nota da comunidade: ${rating} 👀`}\nVocê concorda com a nota?`,
    captionTelegram: `${headline}\n\n${url}`,
  };
}

type ChartTop3Entry = { position: number; title: string; artist: string };

type ChartTop3CaptionInput = {
  chartName: string;
  weekLabel: string;
  top3: ChartTop3Entry[];
  editorialLine: string | null;
  targetUrl: string;
  hashtags: string[];
};

/** Legendas por plataforma para o Top 3 de uma edição de chart. O texto editorial vem pronto (dados reais, sem invenção). */
export function buildChartTop3Captions(input: ChartTop3CaptionInput): PlatformCaptions {
  const url = absoluteSocialUrl(input.targetUrl);
  const tags = formatHashtags(input.hashtags);
  const top3Lines = input.top3.map((e) => `${e.position}. ${e.title} — ${e.artist}`).join("\n");
  const editorial = input.editorialLine ? `\n\n${input.editorialLine}` : "";

  return {
    captionInstagram: `Top 3 da ${input.chartName} (${input.weekLabel}):\n\n${top3Lines}${editorial}\n\nRanking completo no link da bio.\n${url}\n\n${tags}`,
    captionFacebook: `Confira o Top 3 da ${input.chartName} desta semana (${input.weekLabel}):\n\n${top3Lines}${editorial}\n\nVeja o ranking completo:\n${url}`,
    captionThreads: `${input.editorialLine ?? `Novo Top 3 na ${input.chartName} 👀`}\nVocês esperavam essa mudança?`,
    captionTelegram: `📊 Top 3 da ${input.chartName} (${input.weekLabel})\n\n${top3Lines}${editorial}\n\n${url}`,
  };
}
