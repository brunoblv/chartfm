import type { GlobalChartEntry } from "@/lib/types";

type TopSongInput = {
  title: string;
  artist: string;
  status: string;
  delta: number | null;
  weeks: number;
};

export async function generateWeeklyEditorial(
  topSongs: TopSongInput[],
  weekLabel: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const top5 = topSongs.slice(0, 5).map((s, i) => {
    const deltaPart = s.delta != null ? `, delta: ${s.delta}` : "";
    return `${i + 1}. "${s.title}" de ${s.artist} (status: ${s.status}${deltaPart})`;
  }).join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Escreva um parágrafo editorial curto (3-4 frases) sobre a parada musical da semana de ${weekLabel} no ChartFM. Top 5:\n${top5}\n\nEscreva em português brasileiro, tom editorial de rádio, sem títulos, sem listas. Só o parágrafo.`,
          },
        ],
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export function chartEntriesToEditorialInput(entries: GlobalChartEntry[]): TopSongInput[] {
  return entries.map((e) => ({
    title: e.song.title,
    artist: e.song.artist,
    status: e.status,
    delta: e.delta,
    weeks: e.weeks,
  }));
}
