"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ImagePlus, X } from "lucide-react";
import { Shell } from "@/components/layout/Shell";

const ICONS = ["🎵", "🎸", "🎤", "🎹", "🥁", "🎺", "🎻", "🎷", "🎧", "🔥", "👑", "💿"];
const PALETTES: [string, string][] = [
  ["#FA243C", "#FF5858"],
  ["#1A1A2E", "#E94560"],
  ["#EF476F", "#FFD166"],
  ["#8338EC", "#3A86FF"],
  ["#E36414", "#FFD166"],
  ["#06D6A0", "#073B4C"],
];

const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export default function CreateCommunityPage() {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [icon, setIcon] = useState("🎵");
  const [palette, setPalette] = useState<[string, string]>(PALETTES[0]);
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function clearLogo() {
    setLogoError(null);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Envie um arquivo de imagem (JPG, PNG ou WebP).");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  return (
    <Shell title="" subtitle="">
      <div style={{ maxWidth: 1000 }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/communities" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, textDecoration: "none", marginBottom: 12 }}>
            <ChevronLeft size={16} />
            Voltar para comunidades
          </Link>
          <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em", margin: 0, lineHeight: 1.05 }}>Criar comunidade</h1>
          <p style={{ fontSize: 15, color: "#86868B", marginTop: 8, marginBottom: 0 }}>Monte um espaço para sua tribo musical</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Form */}
          <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Name */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>Nome da comunidade</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Indie BR, Pop 2000s..."
                style={{ width: "100%", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none" }}
              />
            </div>

            {/* Tagline */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>
                Descrição curta
                <span style={{ fontSize: 12, color: "#86868B", fontWeight: 400, marginLeft: 6 }}>máx 80 chars</span>
              </label>
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value.slice(0, 80))}
                placeholder="Uma frase sobre sua comunidade..."
                style={{ width: "100%", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none" }}
              />
              <div style={{ fontSize: 11, color: "#86868B", textAlign: "right", marginTop: 4 }}>{tagline.length}/80</div>
            </div>

            {/* Logo (square photo) */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>Logo da comunidade</label>
              <p style={{ fontSize: 12, color: "#86868B", margin: "0 0 10px 0", lineHeight: 1.5 }}>
                Envie uma foto quadrada (recomendado 512×512 px ou maior). Ela aparecerá como identidade visual da comunidade.
              </p>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onLogoFileChange} style={{ display: "none" }} />
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 16,
                    border: "2px dashed rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    flexShrink: 0,
                    background: "rgba(0,0,0,0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Prévia do logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <ImagePlus size={28} color="#86868B" strokeWidth={1.5} />
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      alignSelf: "flex-start",
                      background: "#1D1D1F",
                      color: "white",
                      border: "none",
                      padding: "10px 16px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Escolher imagem
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={clearLogo}
                      style={{
                        alignSelf: "flex-start",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        color: "#86868B",
                        border: "1px solid rgba(0,0,0,0.12)",
                        padding: "8px 12px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <X size={14} />
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
              {logoError && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>{logoError}</div>}
            </div>

            {/* Icon fallback when no logo */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Ícone alternativo</label>
              <p style={{ fontSize: 12, color: "#86868B", margin: "0 0 10px 0" }}>Usado na prévia se você não enviar uma foto de logo.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: "none",
                      background: icon === ic ? "#1D1D1F" : "rgba(0,0,0,0.05)",
                      fontSize: 22,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Cover color */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "block" }}>Cor de capa</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PALETTES.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPalette(p)}
                    style={{
                      width: 52,
                      height: 40,
                      borderRadius: 8,
                      border: "none",
                      background: `linear-gradient(135deg, ${p[0]}, ${p[1]})`,
                      cursor: "pointer",
                      outline: JSON.stringify(palette) === JSON.stringify(p) ? "3px solid #1D1D1F" : "none",
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Privacy */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "block" }}>Privacidade</label>
              <div style={{ display: "flex", gap: 12 }}>
                {(["public", "private"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrivacy(p)}
                    style={{
                      flex: 1,
                      padding: "14px 16px",
                      borderRadius: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      border: `2px solid ${privacy === p ? "#FA243C" : "rgba(0,0,0,0.1)"}`,
                      background: privacy === p ? "rgba(250,36,60,0.04)" : "white",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p === "public" ? "🌍 Pública" : "🔒 Privada"}</div>
                    <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>
                      {p === "public" ? "Qualquer pessoa pode entrar" : "Apenas por convite"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              style={{
                width: "100%",
                marginTop: 8,
                background: "#FA243C",
                color: "white",
                border: "none",
                padding: "14px 20px",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
                cursor: "pointer",
              }}
            >
              Publicar comunidade
            </button>
          </div>

          {/* Preview */}
          <div style={{ position: "sticky", top: 100, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div
                style={{
                  height: 120,
                  background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt=""
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 20,
                      objectFit: "cover",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                      border: "3px solid rgba(255,255,255,0.9)",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 56 }}>{icon}</div>
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
                  0 membros
                </div>
              </div>
              <div style={{ padding: "16px 18px 18px" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{name || "Nome da comunidade"}</div>
                <div style={{ fontSize: 13, color: "#86868B", marginTop: 4, marginBottom: 14 }}>{tagline || "Descrição curta aqui"}</div>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    background: "#1D1D1F",
                    color: "white",
                    border: "none",
                    padding: "10px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "default",
                  }}
                >
                  Participar
                </button>
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, rgba(250,36,60,0.08), rgba(255,88,88,0.04))",
                borderRadius: 18,
                border: "1px solid rgba(250,36,60,0.1)",
                padding: 20,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Como funciona a Parada Global</div>
              <ul style={{ fontSize: 13, color: "#6B6B70", lineHeight: 1.7, paddingLeft: 16, margin: 0 }}>
                <li>Membros publicam suas paradas semanais</li>
                <li>As paradas são agregadas automaticamente</li>
                <li>A Parada da Comunidade é atualizada toda semana</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
