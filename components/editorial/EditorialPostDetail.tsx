import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Ad } from "@/components/ui/Ad";
import {
  EDITORIAL_CATEGORY_LABELS,
  type EditorialPick,
} from "@/lib/editorial-picks-data";
import { extractYouTubeId, youtubeEmbedUrl } from "@/lib/youtube-id";
import { spotifyEmbedUrl } from "@/lib/editorial-preview-image";
import { EditorialPostPreviewCard } from "@/components/editorial/EditorialPostPreviewCard";
import { getServerTranslations } from "@/lib/i18n/server-translations";

type Props = {
  pick: EditorialPick;
  previewImage: string | null;
  relatedPicks: { pick: EditorialPick; previewImage: string | null }[];
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function EditorialPostDetail({ pick, previewImage, relatedPicks }: Props) {
  const { t, locale } = await getServerTranslations();
  const youtubeId = pick.youtubeUrl ? extractYouTubeId(pick.youtubeUrl) : null;
  const spotifyEmbed = pick.spotifyUrl ? spotifyEmbedUrl(pick.spotifyUrl) : null;

  return (
    <article>
      <Link
        href="/editorial"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
          textDecoration: "none",
          marginBottom: 24,
        }}
      >
        {t("editorial.backToEditorial")}
      </Link>

      <header style={{ marginBottom: 32, maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            {EDITORIAL_CATEGORY_LABELS[pick.category]}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{formatDate(pick.publishedAt, locale)}</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>·</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{pick.author}</span>
        </div>

        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.15,
            margin: "0 0 12px 0",
            color: "var(--text)",
          }}
        >
          {pick.title}
        </h1>

        {pick.subtitle && (
          <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--text-muted)", margin: 0 }}>
            {pick.subtitle}
          </p>
        )}
      </header>

      {youtubeId && (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 820,
            aspectRatio: "16 / 9",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 32,
            background: "#000",
            border: "1px solid var(--divider)",
          }}
        >
          <iframe
            src={youtubeEmbedUrl(youtubeId)}
            title={pick.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      )}

      {!youtubeId && previewImage && (
        <div
          style={{
            maxWidth: 820,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 32,
            border: "1px solid var(--divider)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt=""
            style={{ width: "100%", display: "block", aspectRatio: "16 / 9", objectFit: "cover" }}
          />
        </div>
      )}

      <div style={{ maxWidth: 680, marginBottom: 28 }}>
        {pick.paragraphs.slice(0, 2).map((p) => (
          <p
            key={p.slice(0, 40)}
            style={{ fontSize: 16, lineHeight: 1.85, color: "var(--text-subtle)", margin: "0 0 18px 0" }}
          >
            {p}
          </p>
        ))}
      </div>

      <Ad placement="editorial" eligible format="rectangle" style={{ margin: "0 0 32px 0" }} />

      {spotifyEmbed && (
        <div style={{ maxWidth: 820, marginBottom: 32 }}>
          <iframe
            src={spotifyEmbed}
            title={`Spotify - ${pick.title}`}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{
              width: "100%",
              height: pick.spotifyUrl?.includes("/playlist/") ? 380 : 152,
              borderRadius: 14,
              border: 0,
            }}
          />
        </div>
      )}

      <div style={{ maxWidth: 680, marginBottom: 36 }}>
        {pick.paragraphs.slice(2).map((p) => (
          <p
            key={p.slice(0, 40)}
            style={{ fontSize: 16, lineHeight: 1.85, color: "var(--text-subtle)", margin: "0 0 18px 0" }}
          >
            {p}
          </p>
        ))}
      </div>

      {pick.tags && pick.tags.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28, maxWidth: 680 }}>
          {pick.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 100,
                background: "var(--fill-subtle)",
                color: "var(--text-muted)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {pick.relatedLinks && pick.relatedLinks.length > 0 && (
        <div
          style={{
            maxWidth: 680,
            padding: "22px 24px",
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 16,
            marginBottom: 40,
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              margin: "0 0 14px 0",
            }}
          >
            {t("editorial.readAlsoOnChartFM")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pick.relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--accent)",
                  textDecoration: "none",
                }}
              >
                {link.label}
                <ExternalLink size={14} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {(pick.youtubeUrl || pick.spotifyUrl) && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48, maxWidth: 680 }}>
          {pick.youtubeUrl && (
            <a
              href={pick.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "none",
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid var(--divider)",
                background: "var(--surface)",
              }}
            >
              {t("editorial.openYoutube")}
            </a>
          )}
          {pick.spotifyUrl && (
            <a
              href={pick.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "none",
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid var(--divider)",
                background: "var(--surface)",
              }}
            >
              {t("editorial.openSpotify")}
            </a>
          )}
        </div>
      )}

      {relatedPicks.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: 20,
              color: "var(--text)",
            }}
          >
            {t("editorial.moreFromEditorial")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {relatedPicks.map(({ pick: related, previewImage: img }) => (
              <EditorialPostPreviewCard key={related.slug} pick={related} previewImage={img} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
