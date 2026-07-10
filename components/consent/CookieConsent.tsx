"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Cookie } from "lucide-react";
import {
  CONSENT_STORAGE_KEY,
  readStoredConsent,
  writeStoredConsent,
} from "@/lib/consent";

type ConfirmState = { message: string } | null;

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  useEffect(() => {
    setVisible(readStoredConsent() === null);
  }, []);

  function finish(message: string, value: string) {
    writeStoredConsent(value);
    setVisible(false);
    setShowOptions(false);
    setConfirm({ message });
    window.setTimeout(() => setConfirm(null), 3000);
  }

  function handleAccept() {
    finish("Preferências salvas. Obrigado!", "all");
  }

  function handleDecline() {
    finish("Apenas cookies funcionais serão usados.", "functional");
  }

  function handleSaveOptions() {
    const value = adsEnabled
      ? "all"
      : `custom:${JSON.stringify({ functional: true, ads: false })}`;
    finish("Preferências salvas.", value);
  }

  return (
    <>
      {visible && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            padding: "12px 16px",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              pointerEvents: "all",
              background: "var(--surface-elevated)",
              border: "1px solid var(--divider-strong)",
              borderRadius: 18,
              padding: "20px 22px",
              boxShadow: "0 8px 32px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1, minWidth: 240 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "var(--accent-tint)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--accent)",
                  }}
                >
                  <Cookie size={20} strokeWidth={2} />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 4,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Usamos cookies
                  </p>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-muted)" }}>
                    O ChartFM usa cookies para manter sua sessão e exibir anúncios relevantes via Google
                    AdSense. Veja nossa{" "}
                    <Link
                      href="/privacy-policy"
                      style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
                    >
                      Política de Privacidade
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                  alignSelf: "center",
                }}
              >
                <button
                  type="button"
                  onClick={handleDecline}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    background: "var(--fill-subtle)",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                    background: "var(--accent)",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(250,36,60,.28)",
                  }}
                >
                  Aceitar cookies
                </button>
              </div>
            </div>

            {showOptions ? (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px solid var(--divider)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default" }}>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "#fff",
                    }}
                  >
                    <Check size={11} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Cookies <strong style={{ color: "var(--text)" }}>funcionais</strong> - necessários
                  </span>
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  onClick={() => setAdsEnabled((v) => !v)}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: adsEnabled ? "var(--accent)" : "var(--fill-subtle)",
                      border: adsEnabled ? "none" : "1px solid var(--divider-strong)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "#fff",
                      transition: "background .15s",
                    }}
                  >
                    {adsEnabled && <Check size={11} strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Cookies de <strong style={{ color: "var(--text)" }}>publicidade</strong> - Google
                    AdSense
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleSaveOptions}
                  style={{
                    marginLeft: "auto",
                    padding: "6px 14px",
                    borderRadius: 100,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--accent)",
                    background: "var(--accent-tint)",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Salvar preferências
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowOptions(true)}
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: 0,
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  Personalizar preferências
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirm && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "var(--surface-elevated)",
            border: "1px solid var(--divider)",
            borderRadius: 100,
            padding: "10px 20px",
            boxShadow: "0 4px 16px rgba(0,0,0,.12)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          <Check size={16} style={{ color: "var(--up-fg, #0F9D58)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{confirm.message}</span>
        </div>
      )}
    </>
  );
}
