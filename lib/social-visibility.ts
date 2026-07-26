export const SOCIAL_VISIBILITY_VALUES = ["everyone", "following", "nobody"] as const;

export type SocialVisibility = (typeof SOCIAL_VISIBILITY_VALUES)[number];

export type SocialNetworkKey = "twitter" | "instagram" | "lastfm";

export function parseSocialVisibility(raw: unknown): SocialVisibility | null {
  if (typeof raw !== "string") return null;
  return (SOCIAL_VISIBILITY_VALUES as readonly string[]).includes(raw)
    ? (raw as SocialVisibility)
    : null;
}

export function normalizeSocialVisibility(raw: unknown): SocialVisibility {
  return parseSocialVisibility(raw) ?? "everyone";
}

/** Dono do perfil sempre vê; following = o dono segue o viewer. */
export function canViewerSeeSocial(args: {
  visibility: SocialVisibility;
  isOwner: boolean;
  ownerFollowsViewer: boolean;
}): boolean {
  if (args.isOwner) return true;
  if (args.visibility === "everyone") return true;
  if (args.visibility === "nobody") return false;
  return args.ownerFollowsViewer;
}

export function filterSocialForViewer(
  value: string | null | undefined,
  visibility: unknown,
  ctx: { isOwner: boolean; ownerFollowsViewer: boolean },
): string | null {
  const v = value?.trim() || null;
  if (!v) return null;
  if (
    !canViewerSeeSocial({
      visibility: normalizeSocialVisibility(visibility),
      isOwner: ctx.isOwner,
      ownerFollowsViewer: ctx.ownerFollowsViewer,
    })
  ) {
    return null;
  }
  return v;
}
