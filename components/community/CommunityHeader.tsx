import Link from "next/link";
import type { ReactNode } from "react";
import { Settings } from "lucide-react";

export type CommunityHeaderData = {
  slug: string;
  name: string;
  tagline: string;
  cover: [string, string];
  coverImageUrl: string | null;
  icon: string;
  logoUrl: string | null;
  members: number;
  posts: number;
  founded: string;
  adminName: string;
  paradaName: string;
  isAdmin?: boolean;
};

type NavTab = "parada" | "airplay" | "albums" | "posts" | "members";

const NAV: { key: NavTab; label: string; href: (slug: string) => string }[] = [
  { key: "parada", label: "Parada", href: (s) => `/community/${s}/parada` },
  { key: "airplay", label: "Airplay", href: (s) => `/community/${s}/airplay` },
  { key: "albums", label: "Álbuns", href: (s) => `/community/${s}/albums` },
  { key: "posts", label: "Home", href: (s) => `/community/${s}` },
  { key: "members", label: "Membros", href: (s) => `/community/${s}/members` },
];

const H_PAD = "clamp(16px, 4vw, 40px)";

export function CommunityHeader({
  community,
  activeTab,
  actions,
}: {
  community: CommunityHeaderData;
  activeTab: NavTab;
  actions?: ReactNode;
}) {
  const hasCoverImage = Boolean(community.coverImageUrl?.trim());

  return (
    <>
      <div
        style={{
          position: "relative",
          color: "white",
          overflow: "hidden",
          background: `linear-gradient(135deg, ${community.cover[0]}, ${community.cover[1]})`,
        }}
      >
        {/* Faixa do banner — proporção 15:4 fixa, independente do texto */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "15 / 4",
            maxHeight: 320,
            minHeight: 120,
          }}
        >
          {hasCoverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={community.coverImageUrl!}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: hasCoverImage
                ? `linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)`
                : "transparent",
            }}
          />
        </div>

        {/* Informações — fluxo normal, sem position absolute */}
        <div style={{ padding: `0 ${H_PAD} 28px` }}>
          <div
            style={{
              display: "flex",
              gap: "clamp(16px, 3vw, 28px)",
              alignItems: "flex-start",
              flexWrap: "wrap",
              marginTop: -48,
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                minWidth: 120,
                minHeight: 120,
                borderRadius: 22,
                flexShrink: 0,
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(12px)",
                border: "3px solid rgba(255,255,255,0.3)",
                boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 52,
                overflow: "hidden",
              }}
            >
              {community.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={community.logoUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                community.icon
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingTop: 52 }}>
              <h1
                style={{
                  fontSize: "clamp(26px, 4.5vw, 52px)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.08,
                  margin: "0 0 8px",
                  wordBreak: "break-word",
                }}
              >
                {community.name}
              </h1>
              <p style={{ fontSize: 15, opacity: 0.88, margin: "0 0 14px", lineHeight: 1.45 }}>
                {community.tagline}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  fontSize: 13,
                  opacity: 0.88,
                  marginBottom: 14,
                }}
              >
                <span>
                  <strong>{community.members.toLocaleString("pt-BR")}</strong> membros
                </span>
                <span>
                  <strong>{community.posts}</strong> posts
                </span>
                <span>Fundada em {community.founded}</span>
                <span>
                  Moderado por <strong>{community.adminName}</strong>
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {actions}
                {community.isAdmin && (
                  <Link
                    href={`/community/${community.slug}/settings`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "rgba(255,255,255,0.15)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.25)",
                      padding: "8px 16px",
                      borderRadius: 100,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <Settings size={14} />
                    Configurações
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: `0 ${H_PAD}`,
          borderBottom: "1px solid var(--divider)",
          background: "var(--surface)",
          position: "sticky",
          top: 0,
          zIndex: 20,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", overflowX: "auto" }}>
          {NAV.map(({ key, label, href }) => (
            <Link
              key={key}
              href={href(community.slug)}
              style={{
                padding: "16px 20px",
                fontSize: 15,
                fontWeight: activeTab === key ? 700 : 500,
                color: activeTab === key ? "var(--text)" : "var(--text-muted)",
                borderBottom: `2px solid ${activeTab === key ? community.cover[0] : "transparent"}`,
                marginBottom: -1,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {key === "parada" ? community.paradaName : label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
