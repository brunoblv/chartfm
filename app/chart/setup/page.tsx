"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function ParadaSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSecondSlot = searchParams.get("slot") === "2";
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    const trimmed = nome.trim();
    if (trimmed.length < 2) {
      setError("O nome precisa ter pelo menos 2 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isSecondSlot) {
        const res = await fetch("/api/user/paradas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Erro ao criar segunda parada.");
          return;
        }
        const data = (await res.json()) as { parada?: { id: string } };
        router.push(data.parada?.id ? `/create?paradaId=${data.parada.id}` : "/create");
        return;
      }

      const res = await fetch("/api/user/chart-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paradaNome: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao salvar.");
        return;
      }
      router.push("/create");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ width: "100%", minHeight: "100svh", background: "#FBFBFD", display: "flex", flexDirection: "column", fontFamily: "inherit" }}>

      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "white" }}>
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
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 0 32px" }}>
        <div style={{ width: "100%", maxWidth: 480, padding: "0 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            {isSecondSlot ? "Segunda parada" : "Primeira vez aqui"}
          </div>
          <h1 style={{ fontSize: "clamp(28px, 8vw, 42px)", fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 12px 0", lineHeight: 1.05 }}>
            {isSecondSlot ? (
              <>Nome da sua<br />2ª parada</>
            ) : (
              <>Como vai se chamar<br />a sua parada?</>
            )}
          </h1>
          <p style={{ fontSize: 15, color: "#6B6B70", lineHeight: 1.55, marginBottom: 28, maxWidth: 400 }}>
            {isSecondSlot
              ? "Use um tema ou gênero diferente da parada principal. Não entra no ranking global."
              : "Esse é o nome que aparece nas suas publicações semanais. Pode ser algo pessoal, criativo — o que quiser."}
          </p>

          <input
            value={nome}
            onChange={(e) => { setNome(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            placeholder={isSecondSlot ? "Ex: Parada K-Pop, Top Rock…" : "Ex: Parada do João, Top da Semana…"}
            maxLength={60}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: error ? "1.5px solid #FA243C" : "1.5px solid rgba(0,0,0,0.12)",
              fontSize: 16,
              fontFamily: "inherit",
              outline: "none",
              marginBottom: 8,
              background: "white",
              color: "#1D1D1F",
              boxSizing: "border-box",
            }}
          />

          {error && (
            <div style={{ fontSize: 13, color: "#B91C1C", marginBottom: 16 }}>{error}</div>
          )}
          {!error && <div style={{ height: 24 }} />}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => router.back()}
              style={{ padding: "12px 24px", background: "white", color: "#1D1D1F", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Voltar
            </button>
            <button
              onClick={handleContinue}
              disabled={nome.trim().length < 2 || saving}
              style={{
                padding: "12px 28px",
                background: "#FA243C",
                color: "white",
                border: "none",
                borderRadius: 100,
                fontSize: 14,
                fontWeight: 700,
                cursor: nome.trim().length < 2 || saving ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 12px rgba(250,36,60,0.25)",
                opacity: nome.trim().length < 2 || saving ? 0.5 : 1,
              }}
            >
              {saving ? "Salvando…" : isSecondSlot ? "Criar 2ª parada" : "Criar parada"}
              {!saving && <ChevronRight />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
