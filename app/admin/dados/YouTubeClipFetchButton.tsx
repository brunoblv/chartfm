"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Youtube } from "lucide-react";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; found: boolean; videoId?: string; title?: string; link?: string; message: string }
  | { status: "error"; message: string };

const chipStyle: CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text-muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.04em",
  cursor: "pointer",
  lineHeight: 1.4,
  display: "flex",
  alignItems: "center",
  gap: 4,
};

export function YouTubeClipFetchButton({
  songId,
  title,
  artist,
  inline = false,
}: {
  songId: string;
  title: string;
  artist: string;
  /** Sem margem superior — para ficar na mesma linha de Ver/Editar. */
  inline?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<FetchState>({ status: "idle" });

  async function run() {
    if (state.status === "loading") return;
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/admin/songs/${songId}/youtube-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        found?: boolean;
        videoId?: string;
        title?: string;
        publishedAt?: string | null;
        message?: string;
        error?: string;
        needsManualReview?: boolean;
      };

      if (!res.ok || !data.ok) {
        setState({ status: "error", message: data.error ?? "erro na busca" });
        return;
      }

      const youtubeLink = data.videoId ? `https://youtu.be/${data.videoId}` : undefined;
      const publishedLabel =
        typeof data.publishedAt === "string" && data.publishedAt
          ? data.publishedAt.slice(0, 10)
          : undefined;
      setState({
        status: "done",
        found: data.found ?? false,
        videoId: data.videoId,
        title: data.title,
        link: youtubeLink,
        message: publishedLabel
          ? `${data.message ?? ""} · postado ${publishedLabel}`.trim()
          : data.message ?? "",
      });
      if (data.found) router.refresh();
    } catch {
      setState({ status: "error", message: "erro de rede" });
    }
  }

  const feedback =
    state.status === "done" ? (
      <div style={{ marginTop: inline ? 0 : 4, fontSize: 11, lineHeight: 1.5, maxWidth: 300, flexBasis: "100%" }}>
        {state.found ? (
          <>
            <span style={{ color: "#2D7A32", fontWeight: 700 }}>✓ Clipe encontrado:</span>{" "}
            <span style={{ color: "var(--text)" }}>{state.title}</span>
            {state.link && (
              <>
                {" "}
                <a href={state.link} target="_blank" rel="noreferrer" style={{ color: "#FF0000", fontWeight: 700 }}>
                  youtube ↗
                </a>
              </>
            )}
            {state.message?.includes("postado") || state.message?.includes("Data de postagem") ? (
              <>
                <br />
                <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{state.message}</span>
              </>
            ) : null}
          </>
        ) : (
          <>
            <span style={{ color: "var(--text-muted)" }}>Nenhum clipe encontrado.</span>
            <br />
            <span style={{ color: "var(--text-muted)", fontSize: 10 }}>Marcado para revisão manual.</span>
          </>
        )}
      </div>
    ) : state.status === "error" ? (
      <div style={{ marginTop: inline ? 0 : 4, fontSize: 11, color: "#C41E3A", maxWidth: 300, flexBasis: "100%" }}>
        YouTube CLIP: {state.message}
      </div>
    ) : null;

  if (inline) {
    return (
      <>
        <button
          type="button"
          title={`Buscar video clipe no YouTube para "${title}" por ${artist}`}
          onClick={() => run()}
          disabled={state.status === "loading"}
          style={{
            ...chipStyle,
            ...(state.status === "loading" ? { color: "#FF0000", borderColor: "rgba(255,0,0,0.4)" } : null),
          }}
        >
          {state.status === "loading" ? "…" : <><Youtube size={10} /> YT</>}
        </button>
        {feedback}
      </>
    );
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <button
          type="button"
          title={`Buscar video clipe no YouTube para "${title}" por ${artist}`}
          onClick={() => run()}
          disabled={state.status === "loading"}
          style={{
            ...chipStyle,
            ...(state.status === "loading" ? { color: "#FF0000", borderColor: "rgba(255,0,0,0.4)" } : null),
          }}
        >
          {state.status === "loading" ? "…" : <><Youtube size={10} /> YT CLIP</>}
        </button>
      </div>
      {feedback}
    </div>
  );
}
