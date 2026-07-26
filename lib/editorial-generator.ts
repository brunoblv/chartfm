import type { GlobalChartEntry } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

function englishOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function leaderPhrase(entry: GlobalChartEntry, locale: Locale): string {
  if (locale === "en") {
    if (entry.status === "new") return "is the strongest debut";
    if ((entry.numberOnes ?? 0) > 1) {
      return `holds the top for a ${englishOrdinal(entry.numberOnes!)} week`;
    }
    return "takes the lead";
  }
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

function formatPoints(locale: Locale, points: number): string {
  return points.toLocaleString(locale === "en" ? "en-US" : "pt-BR");
}

/**
 * Monta o editorial semanal a partir de dados reais do Global 100 — sem IA.
 * Cada frase só entra se o dado correspondente existir (ex.: sem maior queda, a frase some).
 */
export function buildWeeklyEditorial(
  entries: GlobalChartEntry[],
  weekLabel: string,
  publishersThisWeek: number,
  locale: Locale = "pt-BR",
): string | null {
  if (entries.length === 0) return null;

  const sentences: string[] = [];
  const en = locale === "en";

  const leader = entries[0];
  if (leader) {
    const parts = en
      ? [
          `"${leader.song.title}" by ${leader.song.artist} ${leaderPhrase(leader, locale)} on the Global 100 in ${weekLabel}.`,
        ]
      : [
          `"${leader.song.title}", de ${leader.song.artist}, ${leaderPhrase(leader, locale)} do Global 100 na semana de ${weekLabel}.`,
        ];
    if (leader.points > 0 && leader.voters > 0) {
      parts.push(
        en
          ? `The song scored ${formatPoints(locale, leader.points)} points, appearing on ${leader.voters} charts.`
          : `A música somou ${formatPoints(locale, leader.points)} pontos, aparecendo em ${leader.voters} paradas.`,
      );
    }
    sentences.push(parts.join(" "));
  }

  const riser = pickBiggestRiser(entries);
  const faller = pickBiggestFaller(entries);
  const movementParts: string[] = [];
  if (riser) {
    movementParts.push(
      en
        ? `This week's biggest climber was "${riser.song.title}" by ${riser.song.artist}, which gained ${riser.delta} positions and reached #${riser.position}.`
        : `A maior subida da semana foi "${riser.song.title}", de ${riser.song.artist}, que ganhou ${riser.delta} posições e chegou ao #${riser.position}.`,
    );
  }
  if (faller && faller.prevPos != null) {
    movementParts.push(
      en
        ? `Meanwhile, "${faller.song.title}" had the biggest drop, from #${faller.prevPos} to #${faller.position}.`
        : `Já "${faller.song.title}" teve a maior queda, de #${faller.prevPos} para #${faller.position}.`,
    );
  }
  if (movementParts.length > 0) sentences.push(movementParts.join(" "));

  const newCount = entries.filter((e) => e.status === "new").length;
  const returnCount = entries.filter((e) => e.status === "return").length;
  const debutParts: string[] = [];
  if (newCount > 0) {
    if (en) {
      debutParts.push(newCount === 1 ? "1 song debuted on the chart" : `${newCount} songs debuted on the chart`);
    } else {
      debutParts.push(newCount === 1 ? "1 música estreou no ranking" : `${newCount} músicas estrearam no ranking`);
    }
  }
  if (returnCount > 0) {
    if (en) {
      debutParts.push(
        returnCount === 1
          ? "1 returned after at least one week away"
          : `${returnCount} returned after at least one week away`,
      );
    } else {
      debutParts.push(
        returnCount === 1
          ? "1 voltou depois de pelo menos uma semana fora"
          : `${returnCount} voltaram depois de pelo menos uma semana fora`,
      );
    }
  }
  if (debutParts.length > 0) {
    sentences.push(en ? `In all, ${debutParts.join(" and ")}.` : `Ao todo, ${debutParts.join(" e ")}.`);
  }

  if (publishersThisWeek > 0) {
    if (en) {
      sentences.push(
        publishersThisWeek === 1
          ? "1 user published a chart this week."
          : `${publishersThisWeek} users published charts this week.`,
      );
    } else {
      sentences.push(
        publishersThisWeek === 1
          ? "1 usuário publicou parada nesta semana."
          : `${publishersThisWeek} usuários publicaram paradas nesta semana.`,
      );
    }
  }

  return sentences.length > 0 ? sentences.join(" ") : null;
}
