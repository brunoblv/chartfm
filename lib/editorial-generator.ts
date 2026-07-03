import type { GlobalChartEntry } from "@/lib/types";

function leaderPhrase(entry: GlobalChartEntry): string {
  if (entry.status === "new") return "é a estreia mais forte";
  if ((entry.numberOnes ?? 0) > 1) return `segue no topo pela ${entry.numberOnes}ª semana`;
  return "assume a liderança";
}

function pickBiggestRiser(entries: GlobalChartEntry[]): GlobalChartEntry | null {
  const risers = entries.filter((e) => e.status === "up" && (e.delta ?? 0) > 0);
  if (risers.length === 0) return null;
  return risers.reduce((best, e) => ((e.delta ?? 0) > (best.delta ?? 0) ? e : best));
}

function pickBiggestFaller(entries: GlobalChartEntry[]): GlobalChartEntry | null {
  const fallers = entries.filter((e) => e.status === "down" && (e.delta ?? 0) < 0);
  if (fallers.length === 0) return null;
  return fallers.reduce((worst, e) => ((e.delta ?? 0) < (worst.delta ?? 0) ? e : worst));
}

/**
 * Monta o editorial semanal a partir de dados reais do Global 100 — sem IA.
 * Cada frase só entra se o dado correspondente existir (ex.: sem maior queda, a frase some).
 */
export function buildWeeklyEditorial(
  entries: GlobalChartEntry[],
  weekLabel: string,
  publishersThisWeek: number,
): string | null {
  if (entries.length === 0) return null;

  const sentences: string[] = [];

  const leader = entries[0];
  if (leader) {
    const parts = [
      `"${leader.song.title}", de ${leader.song.artist}, ${leaderPhrase(leader)} do Global 100 na semana de ${weekLabel}.`,
    ];
    if (leader.points > 0 && leader.voters > 0) {
      parts.push(`A música somou ${leader.points.toLocaleString("pt-BR")} pontos, aparecendo em ${leader.voters} paradas.`);
    }
    sentences.push(parts.join(" "));
  }

  const riser = pickBiggestRiser(entries);
  const faller = pickBiggestFaller(entries);
  const movementParts: string[] = [];
  if (riser) {
    movementParts.push(
      `A maior subida da semana foi "${riser.song.title}", de ${riser.song.artist}, que ganhou ${riser.delta} posições e chegou ao #${riser.position}.`,
    );
  }
  if (faller && faller.prevPos != null) {
    movementParts.push(`Já "${faller.song.title}" teve a maior queda, de #${faller.prevPos} para #${faller.position}.`);
  }
  if (movementParts.length > 0) sentences.push(movementParts.join(" "));

  const newCount = entries.filter((e) => e.status === "new").length;
  const returnCount = entries.filter((e) => e.status === "return").length;
  const debutParts: string[] = [];
  if (newCount > 0) {
    debutParts.push(newCount === 1 ? "1 música estreou no ranking" : `${newCount} músicas estrearam no ranking`);
  }
  if (returnCount > 0) {
    debutParts.push(
      returnCount === 1
        ? "1 voltou depois de pelo menos uma semana fora"
        : `${returnCount} voltaram depois de pelo menos uma semana fora`,
    );
  }
  if (debutParts.length > 0) {
    sentences.push(`Ao todo, ${debutParts.join(" e ")}.`);
  }

  if (publishersThisWeek > 0) {
    sentences.push(
      publishersThisWeek === 1
        ? "1 usuário publicou parada nesta semana."
        : `${publishersThisWeek} usuários publicaram paradas nesta semana.`,
    );
  }

  return sentences.length > 0 ? sentences.join(" ") : null;
}
