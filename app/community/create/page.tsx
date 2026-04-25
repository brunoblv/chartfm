"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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

export default function CreateCommunityPage() {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [icon, setIcon] = useState("🎵");
  const [palette, setPalette] = useState<[string, string]>(PALETTES[0]);
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [rules, setRules] = useState("");

  return (
    <Shell title="Criar comunidade">
      <div style={{ maxWidth: 1000 }}>
        <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 32 }}>
          <div style={{ flex: 1 }}>
            <Link href="/communities" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, textDecoration: "none", marginBottom: 12 }}>
              <ChevronLeft size={16} />
              Voltar
            </Link>
            <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em" }}>Criar comunidade</h1>
            <p style={{ fontSize: 15, color: "#86868B", marginTop: 8 }}>Crie um espaço para sua tribo musical</p>
          </div>
          <button style={{
            background: "#FA243C", color: "white", border: "none",
            padding: "12px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700,
            boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
          }}>
            Criar comunidade
          </button>
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

            {/* Icon */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "block" }}>Ícone</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    style={{
                      width: 44, height: 44, borderRadius: 10, border: "none",
                      background: icon === ic ? "#1D1D1F" : "rgba(0,0,0,0.05)",
                      fontSize: 22, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
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
              <div style={{ display: "flex", gap: 8 }}>
                {PALETTES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPalette(p)}
                    style={{
                      width: 52, height: 40, borderRadius: 8, border: "none",
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
                    onClick={() => setPrivacy(p)}
                    style={{
                      flex: 1, padding: "14px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
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

            {/* Rules */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>Regras da comunidade</label>
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="Descreva as regras de convivência..."
                rows={4}
                style={{ width: "100%", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          </div>

          {/* Preview */}
          <div style={{ position: "sticky", top: 100, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Community card preview */}
            <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{
                height: 120,
                background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: 56 }}>{icon}</div>
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
                  color: "white", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                }}>
                  0 membros
                </div>
              </div>
              <div style={{ padding: "16px 18px 18px" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{name || "Nome da comunidade"}</div>
                <div style={{ fontSize: 13, color: "#86868B", marginTop: 4, marginBottom: 14 }}>{tagline || "Descrição curta aqui"}</div>
                <button style={{ width: "100%", background: "#1D1D1F", color: "white", border: "none", padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
                  Participar
                </button>
              </div>
            </div>

            {/* How it works */}
            <div style={{
              background: "linear-gradient(135deg, rgba(250,36,60,0.08), rgba(255,88,88,0.04))",
              borderRadius: 18, border: "1px solid rgba(250,36,60,0.1)", padding: 20,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Como funciona a Parada Global</div>
              <ul style={{ fontSize: 13, color: "#6B6B70", lineHeight: 1.7, paddingLeft: 16 }}>
                <li>Membros publicam suas paradas semanais</li>
                <li>As paradas são agregadas automaticamente</li>
                <li>101 − posição = pontos por música</li>
                <li>A Parada da Comunidade é atualizada toda semana</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
