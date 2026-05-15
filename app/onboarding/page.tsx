"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useIsMobile } from "@/hooks/useIsMobile";

const ALL_GENRES = [
  "Pop", "Indie", "Rock", "R&B", "Hip Hop",
  "Eletrônica", "Sertanejo", "Funk BR", "MPB", "Jazz",
  "Clássica", "Latina", "K-Pop", "Country", "Metal", "Reggae",
];

const HANDLE_RE = /^[a-z0-9][a-z0-9_]{2,27}$/;

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 28);
}

function makeSuggestions(name: string | null | undefined, email: string | null | undefined): string[] {
  const results: string[] = [];
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = slugify(parts[0] ?? "");
    const last = slugify(parts[parts.length - 1] ?? "");
    if (first.length >= 3) results.push(first);
    if (last.length >= 3 && last !== first) results.push(last);
    if (first.length >= 2 && last.length >= 2 && first !== last) {
      const combo = `${first}${last}`.slice(0, 28);
      if (combo.length >= 3) results.push(combo);
    }
  }
  if (email) {
    const local = slugify(email.split("@")[0] ?? "");
    if (local.length >= 3 && !results.includes(local)) results.push(local);
  }
  return results.slice(0, 4);
}

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

function CheckIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
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

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" style={{ animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); transform-origin: 12px 12px; } }`}</style>
    </svg>
  );
}

type HandleStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const isMobile = useIsMobile();

  const isNewUser = session?.user?.needsHandle !== false;
  const [step, setStep] = useState<1 | 2>(isNewUser ? 1 : 2);

  // Step 1 — handle
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [savingHandle, setSavingHandle] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — genres
  const [selected, setSelected] = useState<string[]>(["Pop", "Indie", "Rock", "R&B", "Hip Hop"]);
  const [savingGenres, setSavingGenres] = useState(false);

  const firstName = session?.user?.name?.split(" ")[0] ?? "você";
  const email = session?.user?.email ?? "";
  const initial = firstName[0]?.toUpperCase() ?? "U";
  const suggestions = makeSuggestions(session?.user?.name, email);

  // Sync step when session loads
  useEffect(() => {
    if (session) {
      setStep(session.user?.needsHandle !== false ? 1 : 2);
    }
  }, [session?.user?.needsHandle]);

  // Debounced handle availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const h = handle.toLowerCase().trim();

    if (!h) {
      setHandleStatus("idle");
      return;
    }

    if (!HANDLE_RE.test(h)) {
      setHandleStatus("invalid");
      return;
    }

    setHandleStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/user/handle?h=${encodeURIComponent(h)}`);
        const data = await res.json();
        setHandleStatus(data.available ? "available" : "taken");
      } catch {
        setHandleStatus("idle");
      }
    }, 420);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [handle]);

  const handleSaveHandle = async () => {
    if (handleStatus !== "available" || savingHandle) return;
    setSavingHandle(true);
    try {
      const res = await fetch("/api/user/handle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.toLowerCase().trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error === "Já em uso") setHandleStatus("taken");
        setSavingHandle(false);
        return;
      }
      await update();
      setStep(2);
    } catch {
      setSavingHandle(false);
    }
  };

  const toggleGenre = (g: string) => {
    setSelected((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const handleSaveGenres = async () => {
    setSavingGenres(true);
    try {
      const res = await fetch("/api/user/genres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genres: selected }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setSavingGenres(false);
      return;
    }
    router.push("/");
  };

  const handleStatusColor = handleStatus === "available" ? "#06D6A0"
    : handleStatus === "taken" || handleStatus === "invalid" ? "#FA243C"
    : "#86868B";

  const handleStatusText =
    handleStatus === "available" ? "Disponível"
    : handleStatus === "taken" ? "Já em uso"
    : handleStatus === "invalid" ? "Use letras, números ou _ (mín. 3 caracteres)"
    : handleStatus === "checking" ? "Verificando…"
    : "";

  const canContinueHandle = handleStatus === "available" && !savingHandle;

  // Step indicator helper
  const stepState = (s: number) => {
    if (step === 1) return s === 1 ? "active" : "inactive";
    if (step === 2) return s === 1 ? "done" : s === 2 ? "active" : "inactive";
    return "inactive";
  };

  const stepBg = (s: number) => {
    const st = stepState(s);
    if (st === "done" || st === "active") return "#FA243C";
    return "rgba(0,0,0,0.08)";
  };

  const stepColor = (s: number) => {
    const st = stepState(s);
    return st === "done" || st === "active" ? "white" : "#86868B";
  };

  const connectorBg = (afterStep: number) => {
    if (step === 1) return afterStep < 1 ? "#FA243C" : "rgba(0,0,0,0.08)";
    if (step === 2) return afterStep < 2 ? "#FA243C" : "rgba(0,0,0,0.08)";
    return "rgba(0,0,0,0.08)";
  };

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#FBFBFD", display: "flex", flexDirection: "column", fontFamily: "inherit", overflow: "auto" }}>

      {/* Top bar */}
      <div style={{ padding: isMobile ? "16px 20px" : "24px 48px", display: "flex", alignItems: "center", gap: 18, borderBottom: "1px solid rgba(0,0,0,0.06)", background: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FA243C", display: "grid", placeItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round">
              <line x1="6" y1="20" x2="6" y2="14" />
              <line x1="12" y1="20" x2="12" y2="8" />
              <line x1="18" y1="20" x2="18" y2="4" />
            </svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.025em" }}>ChartFM</div>
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: stepBg(s),
                color: stepColor(s),
                display: "grid", placeItems: "center",
                fontSize: 12, fontWeight: 700,
              }}>
                {stepState(s) === "done" ? <StepDone /> : s}
              </div>
              {s < 3 && <div style={{ width: 60, height: 2, background: connectorBg(s) }} />}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, color: "#86868B" }}>Etapa {step} de 3</div>
      </div>

      {/* ── STEP 1: Handle picker ── */}
      {step === 1 && (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 32 : 48, padding: isMobile ? "32px 20px 48px 20px" : "56px 80px", alignItems: isMobile ? "start" : "center" }}>

          {/* Left */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              Bem-vindo ao ChartFM
            </div>
            <h1 style={{ fontSize: isMobile ? 32 : 46, fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 14px 0", lineHeight: 1.05 }}>
              Escolha seu<br />@handle.
            </h1>
            <p style={{ fontSize: 16, color: "#6B6B70", lineHeight: 1.55, marginBottom: 24, maxWidth: 440 }}>
              É com esse nome que os outros curadores vão te encontrar e seguir. Você pode mudar depois nas configurações.
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
            </div>

          </div>

          {/* Right: handle input */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#86868B", marginBottom: 4 }}>
              SEU HANDLE
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 18 }}>
              Como quer ser chamado?
            </div>

            {/* Input */}
            <div style={{ position: "relative", marginBottom: 8 }}>
              <div style={{
                position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                fontSize: 17, fontWeight: 700, color: "#86868B", userSelect: "none",
              }}>@</div>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="seuhandle"
                maxLength={28}
                autoFocus
                style={{
                  width: "100%",
                  padding: "14px 48px 14px 34px",
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  borderRadius: 12,
                  border: `2px solid ${
                    handleStatus === "available" ? "#06D6A0"
                    : handleStatus === "taken" || handleStatus === "invalid" ? "#FA243C"
                    : "rgba(0,0,0,0.12)"
                  }`,
                  outline: "none",
                  fontFamily: "inherit",
                  background: "white",
                  boxSizing: "border-box",
                  transition: "border-color 150ms",
                }}
              />
              <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
                {handleStatus === "checking" && <Spinner />}
                {handleStatus === "available" && (
                  <div style={{ color: "#06D6A0" }}><CheckIcon size={16} /></div>
                )}
                {(handleStatus === "taken" || handleStatus === "invalid") && (
                  <div style={{ color: "#FA243C", fontWeight: 700, fontSize: 15 }}>✕</div>
                )}
              </div>
            </div>

            {/* Status text */}
            <div style={{ fontSize: 12, fontWeight: 500, color: handleStatusColor, minHeight: 18, marginBottom: 20, paddingLeft: 2 }}>
              {handleStatusText}
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 10 }}>
                  SUGESTÕES
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setHandle(s)}
                      style={{
                        padding: "8px 16px",
                        background: handle === s ? "#1D1D1F" : "white",
                        color: handle === s ? "white" : "#1D1D1F",
                        border: "1px solid rgba(0,0,0,0.1)",
                        borderRadius: 100,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      @{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 28, padding: 18, background: "linear-gradient(135deg, #FFF4F5, white)", borderRadius: 14, border: "1px solid rgba(250,36,60,0.15)" }}>
              <div style={{ fontSize: 13, color: "#6B6B70", lineHeight: 1.5 }}>
                Letras minúsculas, números e _ · Mínimo 3 caracteres · Máximo 28
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button
                onClick={handleSaveHandle}
                disabled={!canContinueHandle}
                style={{
                  padding: "12px 28px",
                  background: "#FA243C",
                  color: "white",
                  border: "none",
                  borderRadius: 100,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: canContinueHandle ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 2px 12px rgba(250,36,60,0.25)",
                  opacity: canContinueHandle ? 1 : 0.55,
                }}
              >
                {savingHandle ? "Salvando…" : "Continuar"}
                {!savingHandle && <ChevronRight />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Genre picker ── */}
      {step === 2 && (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 32 : 48, padding: isMobile ? "32px 20px 48px 20px" : "56px 80px", alignItems: isMobile ? "start" : "center" }}>

          {/* Left */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              Quase lá
            </div>
            <h1 style={{ fontSize: isMobile ? 32 : 46, fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 14px 0", lineHeight: 1.05 }}>
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
                    onClick={() => toggleGenre(g)}
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

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button
                onClick={handleSaveGenres}
                disabled={selected.length < 1 || savingGenres}
                style={{
                  padding: "12px 28px",
                  background: "#FA243C",
                  color: "white",
                  border: "none",
                  borderRadius: 100,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: selected.length < 1 || savingGenres ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 2px 12px rgba(250,36,60,0.25)",
                  opacity: savingGenres ? 0.7 : 1,
                }}
              >
                {savingGenres ? "Salvando…" : "Continuar"}
                {!savingGenres && <ChevronRight />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
