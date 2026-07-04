"use client";

import { useEffect, useState } from "react";
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

export default function VerifyEmailClient() {
  const { t } = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const curatorCount = useCuratorCount();

  const token = searchParams.get("token") ?? "";
  const initialEmail = searchParams.get("email") ?? "";
  const sendFailed = searchParams.get("sent") === "0";

  const [email, setEmail] = useState(initialEmail);
  const [verifying, setVerifying] = useState(Boolean(token));
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    (async () => {
      setVerifying(true);
      setError(null);

      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (cancelled) return;

      setVerifying(false);

      if (!res.ok) {
        setError(t("verifyEmail.errInvalidToken"));
        return;
      }

      setVerified(true);
      window.setTimeout(() => router.push("/login?verified=1"), 2500);
    })();

    return () => {
      cancelled = true;
    };
  }, [token, t, router]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setResending(true);
    setError(null);
    setResent(false);

    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    setResending(false);

    if (!res.ok) {
      setError(t("verifyEmail.errResend"));
      return;
    }

    setResent(true);
  };

  if (token) {
    return (
      <AuthShell curatorCount={curatorCount}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          {t("verifyEmail.badge")}
        </div>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 8px 0", lineHeight: 1.1 }}>
          {t("verifyEmail.confirmHeadline")}
        </h2>

        {error && <AuthError message={error} />}
        {verified && <AuthSuccess message={t("verifyEmail.success")} />}
        {verifying && !error && !verified && (
          <p style={{ fontSize: 14, color: "#86868B", margin: "16px 0 0 0", lineHeight: 1.5 }}>
            {t("verifyEmail.verifying")}
          </p>
        )}

        {error && (
          <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "#86868B" }}>
            <Link href={`/verify-email${email ? `?email=${encodeURIComponent(email)}` : ""}`} style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
              {t("verifyEmail.requestNew")}
            </Link>
          </div>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell curatorCount={curatorCount}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
        {t("verifyEmail.badge")}
      </div>
      <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 8px 0", lineHeight: 1.1 }}>
        {t("verifyEmail.headline")}
      </h2>
      <p style={{ fontSize: 14, color: "#86868B", margin: "0 0 32px 0", lineHeight: 1.5 }}>
        {t("verifyEmail.subhead")}
      </p>

      {sendFailed && !resent && <AuthError message={t("verifyEmail.sendFailed")} />}
      {error && <AuthError message={error} />}
      {resent && <AuthSuccess message={t("verifyEmail.resent")} />}

      <form onSubmit={handleResend}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 6 }}>
          {t("login.email")}
        </label>
        <input
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={resending}
          required
          style={authInputStyle}
        />

        <button
          type="submit"
          disabled={resending || !email.trim()}
          style={authPrimaryButtonStyle(resending || !email.trim())}
        >
          {resending ? t("verifyEmail.resending") : t("verifyEmail.resend")}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "#86868B" }}>
        <Link href="/login" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
          {t("verifyEmail.backToLogin")}
        </Link>
      </div>
    </AuthShell>
  );
}
