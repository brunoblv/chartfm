"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  authInputStyle,
  authPrimaryButtonStyle,
  useCuratorCount,
} from "@/components/auth/AuthShell";
import { useTranslations } from "@/hooks/useTranslations";

export default function ForgotPasswordClient() {
  const { t } = useTranslations();
  const curatorCount = useCuratorCount();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    setLoading(false);

    if (!res.ok) {
      setError(t("forgotPassword.errGeneric"));
      return;
    }

    setSent(true);
  };

  return (
    <AuthShell curatorCount={curatorCount}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
        {t("forgotPassword.badge")}
      </div>
      <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 8px 0", lineHeight: 1.1 }}>
        {t("forgotPassword.headline")}
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 32px 0", lineHeight: 1.5 }}>
        {t("forgotPassword.subhead")}
      </p>

      {error && <AuthError message={error} />}
      {sent && <AuthSuccess message={t("forgotPassword.sent")} />}

      {!sent && (
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
            {t("login.email")}
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            style={authInputStyle}
          />

          <button
            type="submit"
            disabled={loading || !email.trim()}
            style={authPrimaryButtonStyle(loading || !email.trim())}
          >
            {loading ? t("forgotPassword.sending") : t("forgotPassword.submit")}
          </button>
        </form>
      )}

      <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "var(--text-muted)" }}>
        <Link href="/login" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
          {t("forgotPassword.backToLogin")}
        </Link>
      </div>
    </AuthShell>
  );
}
