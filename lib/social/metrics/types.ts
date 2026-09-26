export type PostMetricValues = {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  impressions: number | null;
  views: number | null;
  clicks: number | null;
  permalink: string | null;
  /** Tudo que a API devolveu (inclusive métricas sem coluna própria) para análise dos moderadores. */
  raw: Record<string, unknown>;
};

export type PostMetricResult = { ok: true; values: PostMetricValues } | { ok: false; error: string };

export type AccountSnapshotValues = {
  followers: number | null;
  follows: number | null;
  mediaCount: number | null;
  reach: number | null;
  views: number | null;
  profileViews: number | null;
  accountsEngaged: number | null;
  interactions: number | null;
  raw: Record<string, unknown>;
};

export type AccountSnapshotResult = { ok: true; values: AccountSnapshotValues } | { ok: false; error: string };

export function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function firstNum(...values: unknown[]): number | null {
  for (const v of values) {
    const n = numOrNull(v);
    if (n !== null) return n;
  }
  return null;
}
