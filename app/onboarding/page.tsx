"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const ALL_GENRES = [
  "Pop", "Indie", "Rock", "R&B", "Hip Hop",
  "Eletrônica", "Sertanejo", "Funk BR", "MPB", "Jazz",
  "Clássica", "Latina", "K-Pop", "Country", "Metal", "Reggae",
];

function GoogleLogo({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2s-1 3-3 5-3 4-3 7a6 6 0 0 0 12 0c0-2-1-4-2-5-1 1-2 1-2 0 0-2 1-4-2-7z" />
    </svg>
  );
}

function StepDone() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(["Pop", "Indie", "Rock", "R&B", "Hip Hop"]);
  const [saving, setSaving] = useState(false);

  const toggle = (g: string) => {
    setSelected((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/genres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genres: selected }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setSaving(false);
      return;
    }
    router.push("/");
  };

  const firstName = session?.user?.name?.split(" ")[0] ?? "você";
  const email = session?.user?.email ?? "";
  const initial = firstName[0]?.toUpperCase() ?? "U";

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#FBFBFD", display: "flex", flexDirection: "column", fontFamily: "inherit", overflow: "auto" }}>

      {/* Top bar with progress */}
      <div style={{ padding: "24px 48px", display: "flex", alignItems: "center", gap: 18, borderBottom: "1px solid rgba(0,0,0,0.06)", background: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FA243C", display: "grid", placeItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round">
              <line x1="6" y1="20" x2="6" y2="14" />
              <line x1="12" y1="20" x2="12" y2="8" />
              <line x1="18" y1="20" x2="18" y2="4" />
            </svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.025em" }}>Chartify</div>
        </div>

        {/* Step indicators */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: s <= 2 ? "#FA243C" : "rgba(0,0,0,0.08)",
                color: s <= 2 ? "white" : "#86868B",
                display: "grid", placeItems: "center",
                fontSize: 12, fontWeight: 700,
              }}>
                {s === 1 ? <StepDone /> : s}
              </div>
              {s < 3 && <div style={{ width: 60, height: 2, background: s < 2 ? "#FA243C" : "rgba(0,0,0,0.08)" }} />}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, color: "#86868B" }}>Etapa 2 de 3</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, padding: "56px 80px", alignItems: "center" }}>

        {/* Left: copy + Google account card */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Quase lá
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 14px 0", lineHeight: 1.05 }}>
            Conectado como<br />{firstName}.
          </h1>
          <p style={{ fontSize: 16, color: "#6B6B70", lineHeight: 1.55, marginBottom: 24, maxWidth: 440 }}>
            Importamos seu nome e foto do Google. Agora me conta: o que você curte ouvir? Vamos usar isso pra montar seu feed.
          </p>

          {/* Google account card */}
          <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", padding: 14, display: "flex", alignItems: "center", gap: 12, maxWidth: 380 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #FA243C, #FF5858)", display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
              {session?.user?.image
                ? <img src={session.user.image} alt={firstName} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                : initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{session?.user?.name ?? firstName}</div>
              <div style={{ fontSize: 12, color: "#86868B", display: "flex", alignItems: "center", gap: 5 }}>
                <GoogleLogo size={11} /> {email}
              </div>
            </div>
            <button
              onClick={() => router.push("/login")}
              style={{ background: "none", border: "1px solid rgba(0,0,0,0.1)", padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Trocar
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 32 }}>
            <button
              onClick={() => router.back()}
              style={{ padding: "12px 24px", background: "white", color: "#1D1D1F", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Voltar
            </button>
            <button
              onClick={handleContinue}
              disabled={selected.length < 1 || saving}
              style={{
                padding: "12px 28px",
                background: "#FA243C",
                color: "white",
                border: "none",
                borderRadius: 100,
                fontSize: 14,
                fontWeight: 700,
                cursor: selected.length < 1 || saving ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 12px rgba(250,36,60,0.25)",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Salvando…" : "Continuar"}
              {!saving && <ChevronRight />}
            </button>
          </div>
        </div>

        {/* Right: genre picker */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#86868B", marginBottom: 4 }}>
            SEUS GÊNEROS · {selected.length}/5+ selecionados
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 18 }}>
            Escolha pelo menos 5 que combinam com você
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ALL_GENRES.map((g) => {
              const active = selected.includes(g);
              return (
                <button
                  key={g}
                  onClick={() => toggle(g)}
                  style={{
                    padding: "10px 18px",
                    background: active ? "#1D1D1F" : "white",
                    color: active ? "white" : "#1D1D1F",
                    border: active ? "1px solid #1D1D1F" : "1px solid rgba(0,0,0,0.1)",
                    borderRadius: 100,
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 120ms",
                  }}
                >
                  {active && <CheckIcon />}
                  {g}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 32, padding: 18, background: "linear-gradient(135deg, #FFF4F5, white)", borderRadius: 14, border: "1px solid rgba(250,36,60,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#1D1D1F", marginBottom: 6 }}>
              <span style={{ color: "#FA243C" }}><FlameIcon /></span>
              Próxima etapa
            </div>
            <div style={{ fontSize: 13, color: "#6B6B70", lineHeight: 1.5 }}>
              Vamos te apresentar 12 curadores com gosto parecido com o seu pra você seguir e ver as paradas deles.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
