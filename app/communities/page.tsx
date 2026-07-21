import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users, BarChart2, MessageCircle, Star } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { prisma } from "@/lib/prisma";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: `${t("communities.title")} | ChartFM`,
    description: t("communities.subtitle"),
    alternates: { canonical: "/communities" },
  };
}

type CommunityCard = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  logoUrl: string | null;
  cover: [string, string];
  members: number;
  posts: number;
  memberSample: {
    id: string;
    name: string;
    avatar: string;
    imageUrl: string | null;
  }[];
  newPosts: number;
};

function toCommunityCard(
  community: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    icon: string;
    logoUrl: string | null;
    coverA: string;
    coverB: string;
    members: number;
    posts: number;
    communityMembers: {
      joinedAt: Date;
      user: {
        id: string;
        name: string;
        avatarColor: string;
        image: string | null;
      };
    }[];
    communityPosts?: { createdAt: Date }[];
  },
): CommunityCard {
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;

  return {
    id: community.id,
    slug: community.slug,
    name: community.name,
    tagline: community.tagline,
    icon: community.icon,
    logoUrl: community.logoUrl,
    cover: [community.coverA, community.coverB],
    members: community.members,
    posts: community.posts,
    memberSample: community.communityMembers.map(({ user }) => ({
      id: user.id,
      name: user.name,
      avatar: user.avatarColor,
      imageUrl: user.image,
    })),
    newPosts: community.communityPosts?.filter((post) => post.createdAt.getTime() >= yesterday).length ?? 0,
  };
}

const GENRES = [
  { label: "Pop", icon: "🎤" },
  { label: "Rock", icon: "🎸" },
  { label: "Hip-Hop", icon: "🎧" },
  { label: "Eletrônico", icon: "🎛️" },
  { label: "R&B", icon: "🎶" },
  { label: "Indie", icon: "🌿" },
  { label: "K-Pop", icon: "⭐" },
  { label: "MPB", icon: "🎵" },
  { label: "Sertanejo", icon: "🤠" },
  { label: "Funk", icon: "🔊" },
  { label: "Metal", icon: "🤘" },
  { label: "Jazz", icon: "🎺" },
];

const HOW_IT_WORKS = [
  {
    icon: <Users size={18} />,
    titleKey: "howItWorksJoinTitle",
    descKey: "howItWorksJoinDesc",
  },
  {
    icon: <BarChart2 size={18} />,
    titleKey: "howItWorksChartTitle",
    descKey: "howItWorksChartDesc",
  },
  {
    icon: <MessageCircle size={18} />,
    titleKey: "howItWorksDiscussTitle",
    descKey: "howItWorksDiscussDesc",
  },
  {
    icon: <Star size={18} />,
    titleKey: "howItWorksTrendsTitle",
    descKey: "howItWorksTrendsDesc",
  },
] as const;

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const { t, locale } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const params = await searchParams;
  const rawQuery = Array.isArray(params?.q) ? params?.q[0] : params?.q;
  const query = rawQuery?.trim() ?? "";
  const publicCommunityWhere = {
    isPublic: true,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { tagline: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [myRows, exploreRows] = await Promise.all([
    userId
      ? prisma.community.findMany({
          where: { communityMembers: { some: { userId } } },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            slug: true,
            name: true,
            tagline: true,
            icon: true,
            logoUrl: true,
            coverA: true,
            coverB: true,
            members: true,
            posts: true,
            communityMembers: {
              orderBy: { joinedAt: "asc" },
              take: 3,
              select: {
                joinedAt: true,
                user: { select: { id: true, name: true, avatarColor: true, image: true } },
              },
            },
            communityPosts: {
              where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
              select: { createdAt: true },
            },
          },
        })
      : Promise.resolve([]),
    prisma.community.findMany({
      where: publicCommunityWhere,
      orderBy: [{ members: "desc" }, { createdAt: "desc" }],
      take: 24,
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        icon: true,
        logoUrl: true,
        coverA: true,
        coverB: true,
        members: true,
        posts: true,
        communityMembers: {
          orderBy: { joinedAt: "asc" },
          take: 3,
          select: {
            joinedAt: true,
            user: { select: { id: true, name: true, avatarColor: true, image: true } },
          },
        },
      },
    }),
  ]);

  const myComms = myRows.map(toCommunityCard);
  const exploreComms = exploreRows.map(toCommunityCard);
  const myCommunityIds = new Set(myComms.map((community) => community.id));

  return (
    <Shell title={t("communities.title")} subtitle={t("communities.subtitle")}>

      {/* ===== SEARCH + CREATE ===== */}
      <div style={{ display: "flex", gap: 12, marginBottom: 36, alignItems: "center" }}>
        <form
          action="/communities"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--surface)",
            border: "1px solid var(--divider-strong)",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            name="q"
            defaultValue={query}
            placeholder={t("communities.searchPlaceholder")}
            style={{
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "var(--text)",
              flex: 1,
              background: "transparent",
            }}
          />
        </form>
        <Link
          href="/community/create"
          style={{
            background: "#FA243C",
            color: "white",
            textDecoration: "none",
            padding: "10px 22px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
            whiteSpace: "nowrap",
          }}
        >
          {t("communities.create")}
        </Link>
      </div>

      {/* ===== SUAS COMUNIDADES ===== */}
      {userId && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>
            {t("communities.yours")}
          </h2>
          {myComms.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {myComms.map((c) => (
                <Link key={c.id} href={`/community/${c.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div
                    style={{
                      background: "var(--surface)",
                      borderRadius: 18,
                      border: "1px solid var(--divider)",
                      padding: "16px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        flexShrink: 0,
                        background: `linear-gradient(135deg, ${c.cover[0]}, ${c.cover[1]})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        overflow: "hidden",
                      }}
                    >
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        c.icon
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {t("communities.members", { count: c.members.toLocaleString(locale) })}
                      </div>
                      <div style={{ fontSize: 12, color: "#FA243C", fontWeight: 600, marginTop: 2 }}>
                        {c.newPosts === 1
                          ? t("communities.newPost")
                          : t("communities.newPosts", { count: c.newPosts })}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div
              style={{
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--divider)",
                padding: 18,
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              {t("communities.notJoined")}
            </div>
          )}
        </section>
      )}

      {/* ===== EXPLORAR ===== */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>
          {t("communities.explore")}
        </h2>
        {exploreComms.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {exploreComms.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "var(--surface)",
                  borderRadius: 18,
                  border: "1px solid var(--divider)",
                  overflow: "hidden",
                }}
              >
                {/* Banner */}
                <div
                  style={{
                    height: 120,
                    background: `linear-gradient(135deg, ${c.cover[0]}, ${c.cover[1]})`,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {c.logoUrl ? (
                    <img
                      src={c.logoUrl}
                      alt={c.name}
                      style={{
                        width: 76,
                        height: 76,
                        borderRadius: 20,
                        objectFit: "cover",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 56 }}>{c.icon}</div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "rgba(0,0,0,0.5)",
                      backdropFilter: "blur(8px)",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 20,
                    }}
                  >
                    {t("communities.members", { count: c.members.toLocaleString(locale) })}
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "16px 18px 18px" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{c.name}</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-muted)",
                      marginBottom: 14,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      lineHeight: 1.55,
                    }}
                  >
                    {c.tagline}
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      <MessageCircle size={12} />
                      {t("communities.postsCount", { count: c.posts.toLocaleString(locale) })}
                    </span>
                    {c.newPosts > 0 && (
                      <span style={{ fontSize: 12, color: "#FA243C", fontWeight: 600 }}>
                        {t("communities.today", { count: c.newPosts })}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Avatar stack */}
                    <div style={{ display: "flex" }}>
                      {(c.memberSample ?? []).slice(0, 3).map((u, i) => (
                        <div
                          key={u.id}
                          style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid var(--surface)", borderRadius: "50%" }}
                        >
                          <Avatar user={u} imageUrl={u.imageUrl} size={24} />
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <Link
                      href={`/community/${c.slug}`}
                      style={{
                        background: "var(--btn-dark-bg)",
                        color: "var(--btn-dark-fg)",
                        textDecoration: "none",
                        padding: "7px 16px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {myCommunityIds.has(c.id) ? t("communities.open") : t("communities.join")}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid var(--divider)",
              padding: 18,
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            {query ? t("communities.noResultsForSearch") : t("communities.noPublicCommunities")}
          </div>
        )}
      </section>

      {/* ===== GÊNEROS: pills compactos ===== */}
      <section style={{ marginBottom: 48 }}>
        <h2
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}
        >
          {t("communities.searchByGenre")}
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {GENRES.map((g) => (
            <Link
              key={g.label}
              href={`/communities?q=${encodeURIComponent(g.label)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--surface)",
                border: "1px solid var(--divider-strong)",
                borderRadius: 100,
                padding: "8px 15px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <span>{g.icon}</span>
              {g.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ===== EDITORIAL: condensado, no fim ===== */}
      <section style={{ borderTop: "1px solid var(--divider)", paddingTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px 0" }}>
          {t("communities.howItWorksTitle")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
          {HOW_IT_WORKS.map((step) => (
            <div key={step.titleKey}>
              <div style={{ color: "#FA243C", marginBottom: 8 }}>{step.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t(`communities.${step.titleKey}`)}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{t(`communities.${step.descKey}`)}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
          {t("communities.ctaFooterPrefix")}{" "}
          <Link href="/community/create" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            {t("communities.ctaFooterLink")}
          </Link>{" "}
          {t("communities.ctaFooterSuffix")}
        </p>
      </section>
    </Shell>
  );
}
