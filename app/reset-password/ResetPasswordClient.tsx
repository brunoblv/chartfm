"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  authInputStyle,
  authPrimaryButtonStyle,
  useCuratorCount,
} from "@/components/auth/AuthShell";
import { useTranslations } from "@/hooks/useTranslations";

export default function ResetPasswordClient() {
  const { t } = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const curatorCount = useCuratorCount();

  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(t("resetPassword.errInvalidToken"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("signup.errPasswordMismatch"));
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      if (data.error === "weak_password") {
        setError(t("signup.errWeakPassword"));
      } else {
        setError(t("resetPassword.errInvalidToken"));
      }
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  };

  if (!token) {
    return (
      <AuthShell curatorCount={curatorCount}>
        <AuthError message={t("resetPassword.errInvalidToken")} />
        <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "#86868B" }}>
          <Link href="/forgot-password" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            {t("resetPassword.requestNew")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell curatorCount={curatorCount}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
        {t("resetPassword.badge")}
      </div>
      <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 8px 0", lineHeight: 1.1 }}>
        {t("resetPassword.headline")}
      </h2>
      <p style={{ fontSize: 14, color: "#86868B", margin: "0 0 32px 0", lineHeight: 1.5 }}>
        {t("resetPassword.subhead")}
      </p>

      {error && <AuthError message={error} />}
      {done && <AuthSuccess message={t("resetPassword.success")} />}

      {!done && (
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 6 }}>
            {t("resetPassword.newPassword")}
          </label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            minLength={8}
            style={authInputStyle}
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 6 }}>
            {t("signup.confirmPassword")}
          </label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            required
            minLength={8}
            style={authInputStyle}
          />

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            style={authPrimaryButtonStyle(loading || !password || !confirmPassword)}
          >
            {loading ? t("resetPassword.saving") : t("resetPassword.submit")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
