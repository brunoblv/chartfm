"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "chartfm_cookie_consent";

type ConsentValue = "accepted" | "essential";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!localStorage.getItem(STORAGE_KEY));
  }, []);

  const saveConsent = (value: ConsentValue) => {
    localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent("chartfm-cookie-consent", { detail: value }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 300,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "min(100%, 840px)",
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 14,
          boxShadow: "0 18px 50px rgba(0,0,0,0.16)",
          padding: 16,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 16,
          alignItems: "center",
          pointerEvents: "auto",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "#1D1D1F", marginBottom: 4 }}>
            Usamos cookies
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.45, color: "#6B6B70", margin: 0 }}>
            O ChartFM usa cookies essenciais para login e segurança. Com sua permissão, também podemos usar cookies de
            medição e anúncios, inclusive de parceiros como Google AdSense. Veja a{" "}
            <Link href="/politica-de-privacidade" style={{ color: "#FA243C", fontWeight: 600 }}>
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => saveConsent("essential")}
            style={{
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              color: "#1D1D1F",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Apenas essenciais
          </button>
          <button
            type="button"
            onClick={() => saveConsent("accepted")}
            style={{
              border: "none",
              background: "#1D1D1F",
              color: "white",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Aceitar cookies
          </button>
        </div>
      </div>
    </div>
  );
}
