"use client";

import { youtubeEmbedUrl } from "@/lib/youtube-id";

type YouTubeEmbedProps = {
  videoId: string;
  title?: string | null;
  maxWidth?: number;
};

export function YouTubeEmbed({ videoId, title, maxWidth = 480 }: YouTubeEmbedProps) {
  return (
    <div
      style={{
        marginTop: 10,
        width: "100%",
        maxWidth,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--divider)",
        background: "#000",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#0a0a0a",
        }}
      >
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={title?.trim() || "Vídeo do YouTube"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      </div>
      {title ? (
        <div style={{ padding: "10px 12px", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 600 }}>
          {title}
        </div>
      ) : null}
    </div>
  );
}
