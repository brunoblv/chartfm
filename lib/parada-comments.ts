export type ParadaCommentSection = "songs" | "artists";
export type ParadaCommentPeriod = "weekly" | "overall";

export type ParadaCommentScopeInput = {
  communityId?: string | null;
  genreSlug?: string | null;
  section?: string | null;
  period?: string | null;
  weekIndex?: string | number | null;
};

export type ParadaCommentScope = {
  communityId: string | null;
  genreSlug: string | null;
  section: ParadaCommentSection;
  period: ParadaCommentPeriod;
  weekIndex: number | null;
};

export function parseParadaCommentScope(input: ParadaCommentScopeInput): ParadaCommentScope | null {
  const section = input.section === "artists" ? "artists" : input.section === "songs" ? "songs" : null;
  const period = input.period === "overall" ? "overall" : input.period === "weekly" ? "weekly" : null;
  if (!section || !period) return null;

  const communityId = input.communityId ? String(input.communityId) : null;
  const genreSlug = input.genreSlug ? String(input.genreSlug) : null;

  let weekIndex: number | null = null;
  if (period === "weekly") {
    const n = typeof input.weekIndex === "number" ? input.weekIndex : Number(input.weekIndex);
    if (!Number.isFinite(n)) return null;
    weekIndex = n;
  }

  return { communityId, genreSlug, section, period, weekIndex };
}
