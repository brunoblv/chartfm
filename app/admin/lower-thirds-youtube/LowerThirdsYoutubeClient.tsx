"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Download, ImageDown } from "lucide-react";
import {
  LowerThirdBar,
  type LowerThirdEntry,
  type LowerThirdVideoFormat,
} from "@/components/lower-third/LowerThirdBar";

export type { LowerThirdEntry };

type VideoFormat = LowerThirdVideoFormat;

const FORMATS: {
  id: VideoFormat;
  label: string;
  ratio: string;
  sub: string;
  previewW: number;
  previewH: number;
  previewScale: number;
  exportWrapW?: number;
}[] = [
  { id: "landscape", label: "16:9", ratio: "16:9", sub: "YouTube · paisagem", previewW: 960, previewH: 540, previewScale: 1 },
  { id: "portrait", label: "9:16", ratio: "9:16", sub: "YouTube · Shorts", previewW: 360, previewH: 640, previewScale: 0.34, exportWrapW: 1000 },
];

async function captureNode(node: HTMLDivElement): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: null,
    logging: false,
    useCORS: true,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Falha ao gerar PNG."));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

type Props = {
  entries: LowerThirdEntry[];
  weekLabel: string;
  dateRange: string;
};

export default function LowerThirdsYoutubeClient({ entries, weekLabel, dateRange }: Props) {
  const [format, setFormat] = useState<VideoFormat>("landscape");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const exportRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const fmt = FORMATS.find((f) => f.id === format)!;

  function refKey(position: number) {
    return `${format}-${position}`;
  }

  function setExportRef(position: number, el: HTMLDivElement | null) {
    const key = refKey(position);
    if (el) exportRefs.current.set(key, el);
    else exportRefs.current.delete(key);
  }

  async function exportOne(position: number) {
    const node = exportRefs.current.get(refKey(position));
    if (!node || busy) return;
    setBusy(true);
    setBusyLabel(`Posição ${position}`);
    try {
      const blob = await captureNode(node);
      downloadBlob(blob, `chartfm-lower-third-pos${position}-${format === "landscape" ? "16x9" : "9x16"}.png`);
    } catch (e) {
      alert("Erro ao exportar: " + (e as Error).message);
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function exportAll() {
    if (busy || entries.length === 0) return;
    setBusy(true);
    setBusyLabel("Todas as posições");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const suffix = format === "landscape" ? "16x9" : "9x16";

      for (const entry of entries) {
        const node = exportRefs.current.get(refKey(entry.position));
        if (!node) continue;
        const blob = await captureNode(node);
        zip.file(`pos${entry.position}-${suffix}.png`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safeWeek = weekLabel.replace(/[^\w\d-]+/g, "-").toLowerCase();
      downloadBlob(zipBlob, `chartfm-lower-thirds-top5-${suffix}-${safeWeek}.zip`);
    } catch (e) {
      alert("Erro ao exportar: " + (e as Error).message);
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  const btnStyle = (disabled: boolean, primary = false): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: 10,
    border: primary ? "none" : "1px solid var(--divider)",
    background: disabled ? "var(--fill)" : primary ? "#FA243C" : "var(--surface)",
    color: disabled ? "var(--text-muted)" : primary ? "#fff" : "var(--text)",
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  });

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 0 48px" }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
          Lower thirds — Top 5 Global
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Cards com dados da Parada Global ({weekLabel}
          {dateRange ? ` · ${dateRange}` : ""}). A prévia simula o vídeo; a exportação gera só a barra inferior com fundo transparente.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 28,
          padding: "16px 18px",
          borderRadius: 14,
          border: "1px solid var(--divider)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: `1px solid ${format === f.id ? "#FA243C" : "var(--divider)"}`,
                background: format === f.id ? "rgba(250,36,60,0.12)" : "transparent",
                color: format === f.id ? "#FA243C" : "var(--text)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {f.label}
              <span style={{ display: "block", fontSize: 10, fontWeight: 600, opacity: 0.7, marginTop: 2 }}>{f.sub}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button type="button" style={btnStyle(busy, true)} disabled={busy || entries.length === 0} onClick={exportAll}>
          <Download size={16} />
          {busy && busyLabel === "Todas as posições" ? "Gerando ZIP…" : "Exportar todas (ZIP)"}
        </button>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            padding: 32,
            borderRadius: 14,
            border: "1px dashed var(--divider)",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          Nenhuma música no Top 5 da Parada Global desta semana.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {entries.map((entry) => (
            <div key={entry.position} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", maxWidth: fmt.previewW }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    background: "var(--fill)",
                    padding: "4px 10px",
                    borderRadius: 6,
                  }}
                >
                  Posição {entry.position}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  style={btnStyle(busy)}
                  disabled={busy}
                  onClick={() => exportOne(entry.position)}
                >
                  <ImageDown size={15} />
                  {busy && busyLabel === `Posição ${entry.position}` ? "Exportando…" : "Exportar PNG"}
                </button>
              </div>

              <div
                style={{
                  width: fmt.previewW,
                  height: fmt.previewH,
                  borderRadius: 12,
                  overflow: "hidden",
                  position: "relative",
                  background: "linear-gradient(145deg,#1c1c1f,#08080a)",
                  boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.16)",
                    }}
                  >
                    Vídeo do youtuber (placeholder)
                  </span>
                </div>

                <div
                  style={{
                    position: "absolute",
                    left: format === "landscape" ? 36 : 20,
                    right: format === "portrait" ? 20 : undefined,
                    bottom: format === "landscape" ? 36 : 28,
                    transform: fmt.previewScale < 1 ? `scale(${fmt.previewScale})` : undefined,
                    transformOrigin: "bottom left",
                  }}
                >
                  <LowerThirdBar entry={entry} weekLabel={weekLabel} format={format} />
                </div>
              </div>

              {/* Nó oculto para exportação — só a barra, fundo transparente */}
              <div
                aria-hidden
                style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }}
              >
                <div
                  ref={(el) => setExportRef(entry.position, el)}
                  style={fmt.exportWrapW ? { width: fmt.exportWrapW } : undefined}
                >
                  <LowerThirdBar entry={entry} weekLabel={weekLabel} format={format} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
