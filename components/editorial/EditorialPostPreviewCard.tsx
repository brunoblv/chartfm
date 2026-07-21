import Link from "next/link";
import { Play, Music2 } from "lucide-react";
import {
  EDITORIAL_CATEGORY_LABELS,
  type EditorialPick,
} from "@/lib/editorial-picks-data";
import { getServerTranslations } from "@/lib/i18n/server-translations";

type Props = {
  pick: EditorialPick;
  previewImage: string | null;
  /**
   * "compact": versão menor para o feed misto (thumb lateral, sem excerpt).
   * "featured": hero de largura total, usado como 1º item da grade de artigos.
   * "grid": card médio (imagem + badge de categoria sobreposto), usado na grade de artigos.
   * "row": linha horizontal compacta, usada para os itens finais da grade de artigos.
   */
  variant?: "full" | "compact" | "featured" | "grid" | "row";
  /** "featured": empilha texto/imagem em 1 coluna em vez de lado a lado (telas estreitas). */
  stacked?: boolean;
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const WORDS_PER_MINUTE = 200;

export function estimateReadingMinutes(pick: EditorialPick): number {
  const words = pick.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export async function EditorialPostPreviewCard({ pick, previewImage, variant = "full", stacked = false }: Props) {
  const { t, locale } = await getServerTranslations();
  const hasYoutube = Boolean(pick.youtubeUrl);
  const hasSpotify = Boolean(pick.spotifyUrl);

  if (variant === "featured") {
    return (
      <Link
        href={`/editorial/${pick.slug}`}
        style={{
          gridColumn: "1 / -1",
          display: "grid",
          gridTemplateColumns: stacked ? "1fr" : "1.1fr 1fr",
          textDecoration: "none",
          color: "inherit",
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 18,
          overflow: "hidden",
          transition: "border-color 0.15s ease",
        }}
      >
        <div style={{ padding: "26px 26px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 10,
            }}
          >
            {EDITORIAL_CATEGORY_LABELS[pick.category]} · {t("editorial.featuredBadge")}
          </span>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "var(--text)",
              marginBottom: 10,
              lineHeight: 1.2,
            }}
          >
            {pick.title}
          </div>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--text-subtle)",
              lineHeight: 1.6,
              margin: "0 0 14px 0",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {pick.excerpt}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-muted)" }}>
            <span>{pick.author}</span>
            <span>·</span>
            <span>{t("editorial.readTime", { min: estimateReadingMinutes(pick) })}</span>
          </div>
        </div>
        <div
          style={{
            position: "relative",
            minHeight: 180,
            background: previewImage
              ? "var(--fill-subtle)"
              : "linear-gradient(135deg, #1D1D1F, #3A3A3C)",
          }}
        >
          {previewImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(135deg, rgba(250,36,60,0.25), rgba(131,56,236,0.25))",
              }}
            />
          )}
          {hasYoutube && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <Play size={20} fill="white" strokeWidth={0} style={{ marginLeft: 3 }} />
              </div>
            </div>
          )}
        </div>
      </Link>
    );
  }

  if (variant === "grid") {
    return (
      <Link
        href={`/editorial/${pick.slug}`}
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 18,
          overflow: "hidden",
          transition: "border-color 0.15s ease",
        }}
      >
        <div
          style={{
            position: "relative",
            height: 130,
            background: previewImage ? "var(--fill-subtle)" : "linear-gradient(135deg, #8338EC, #5B5BD6)",
          }}
        >
          {previewImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              fontSize: 10,
              fontWeight: 800,
              color: "#fff",
              background: "rgba(0,0,0,0.28)",
              padding: "4px 10px",
              borderRadius: 100,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {EDITORIAL_CATEGORY_LABELS[pick.category]}
          </span>
          {hasYoutube && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "9px solid transparent",
                  borderBottom: "9px solid transparent",
                  borderLeft: "15px solid rgba(255,255,255,0.9)",
                  marginLeft: 3,
                }}
              />
            </div>
          )}
        </div>
        <div style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--text)", marginBottom: 6, lineHeight: 1.3 }}>
            {pick.title}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {pick.author} · {estimateReadingMinutes(pick)} min
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "row") {
    return (
      <Link
        href={`/editorial/${pick.slug}`}
        style={{
          gridColumn: "1 / -1",
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "20px 22px",
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 18,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            flexShrink: 0,
            background: previewImage
              ? `url(${previewImage}) center/cover no-repeat`
              : "linear-gradient(135deg, #FFC542, #FA243C)",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {pick.title}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {pick.author} · {estimateReadingMinutes(pick)} min
          </div>
        </div>
        <div style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>{t("editorial.readRow")}</div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        href={`/editorial/${pick.slug}`}
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 14,
          textDecoration: "none",
          color: "inherit",
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 18,
          overflow: "hidden",
          transition: "border-color 0.15s ease",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 132,
            flexShrink: 0,
            background: previewImage
              ? "var(--fill-subtle)"
              : "linear-gradient(135deg, var(--accent-tint), var(--fill-subtle))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {previewImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
              {hasYoutube && (
                <div
                  style={{
                    position: "relative",
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.65)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <Play size={15} fill="white" strokeWidth={0} style={{ marginLeft: 2 }} />
                </div>
              )}
              {hasSpotify && !hasYoutube && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    background: "rgba(0,0,0,0.7)",
                    color: "#1ed760",
                    borderRadius: 100,
                    padding: 4,
                    display: "flex",
                  }}
                >
                  <Music2 size={11} />
                </div>
              )}
            </>
          ) : (
            <Music2 size={22} color="var(--accent)" />
          )}
        </div>

        <div style={{ padding: "14px 16px 14px 0", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--accent)",
              }}
            >
              {EDITORIAL_CATEGORY_LABELS[pick.category]}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(pick.publishedAt, locale)}</span>
          </div>

          <h2
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: "0 0 6px 0",
              color: "var(--text)",
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {pick.title}
          </h2>

          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{t("editorial.readArticle")}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/editorial/${pick.slug}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        borderRadius: 18,
        overflow: "hidden",
        transition: "border-color 0.15s ease",
      }}
    >
      {previewImage ? (
        <div style={{ position: "relative", aspectRatio: "16 / 9", background: "var(--fill-subtle)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {hasYoutube && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.25)",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <Play size={22} fill="white" strokeWidth={0} style={{ marginLeft: 3 }} />
              </div>
            </div>
          )}
          {hasSpotify && !hasYoutube && (
            <div
              style={{
                position: "absolute",
                bottom: 10,
                right: 10,
                background: "rgba(0,0,0,0.7)",
                color: "#1ed760",
                borderRadius: 100,
                padding: "5px 10px",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <Music2 size={12} />
              Spotify
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            aspectRatio: "16 / 9",
            background: "linear-gradient(135deg, var(--accent-tint), var(--fill-subtle))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {EDITORIAL_CATEGORY_LABELS[pick.category]}
        </div>
      )}

      <div style={{ padding: "20px 22px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            {EDITORIAL_CATEGORY_LABELS[pick.category]}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(pick.publishedAt, locale)}</span>
        </div>

        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            margin: "0 0 8px 0",
            color: "var(--text)",
            lineHeight: 1.25,
          }}
        >
          {pick.title}
        </h2>

        {pick.subtitle && (
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 12px 0", lineHeight: 1.5 }}>
            {pick.subtitle}
          </p>
        )}

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: "var(--text-subtle)",
            margin: "0 0 14px 0",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {pick.excerpt}
        </p>

        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{t("editorial.readArticle")}</span>
      </div>
    </Link>
  );
}
