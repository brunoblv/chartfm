import Link from "next/link";
import { Play, Music2 } from "lucide-react";
import {
  EDITORIAL_CATEGORY_LABELS,
  type EditorialPick,
} from "@/lib/editorial-picks-data";

type Props = {
  pick: EditorialPick;
  previewImage: string | null;
  /** "compact": versão menor para o feed misto (thumb lateral, sem excerpt). */
  variant?: "full" | "compact";
};

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function EditorialPostPreviewCard({ pick, previewImage, variant = "full" }: Props) {
  const hasYoutube = Boolean(pick.youtubeUrl);
  const hasSpotify = Boolean(pick.spotifyUrl);

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
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(pick.publishedAt)}</span>
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

          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Ler artigo completo →</span>
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
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(pick.publishedAt)}</span>
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

        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>Ler artigo completo →</span>
      </div>
    </Link>
  );
}
