"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  AuthShell,
  AuthError,
  AuthTermsFooter,
  authInputStyle,
  authPrimaryButtonStyle,
  useCuratorCount,
} from "@/components/auth/AuthShell";
import { useTranslations } from "@/hooks/useTranslations";

function registerErrorMessage(code: string, t: (k: string) => string): string {
  switch (code) {
    case "email_taken":
      return t("signup.errEmailTaken");
    case "google_account":
      return t("signup.errGoogleAccount");
    case "weak_password":
      return t("signup.errWeakPassword");
    default:
      return t("signup.errGeneric");
  }
}

export default function SignupClient() {
  const { t } = useTranslations();
  const router = useRouter();
  const curatorCount = useCuratorCount();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("signup.errPasswordMismatch"));
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, name: name.trim() || undefined }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(registerErrorMessage(data.error ?? "generic", t));
      return;
    }

    const signInResult = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
      callbackUrl: "/onboarding",
    });

    setLoading(false);

    if (signInResult?.error) {
      router.push("/login?from=/onboarding");
      return;
    }

    router.push(signInResult?.url ?? "/onboarding");
  };

  const canSubmit = email.trim() && password && confirmPassword && !loading;

  return (
    <AuthShell curatorCount={curatorCount}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
        {t("signup.badge")}
      </div>
      <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 8px 0", lineHeight: 1.1 }}>
        {t("signup.headline")}
      </h2>
      <p style={{ fontSize: 14, color: "#86868B", margin: "0 0 32px 0", lineHeight: 1.5 }}>
        {t("signup.subhead")}
      </p>

      {error && <AuthError message={error} />}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 6 }}>
          {t("signup.name")}
        </label>
        <input
          type="text"
          autoComplete="name"
          placeholder={t("signup.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          style={authInputStyle}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 6 }}>
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

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 6 }}>
          {t("login.password")}
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

        <p style={{ fontSize: 11, color: "#86868B", margin: "0 0 4px 0" }}>{t("signup.passwordHint")}</p>

        <button type="submit" disabled={!canSubmit} style={authPrimaryButtonStyle(!canSubmit)}>
          {loading ? t("signup.creating") : t("signup.submit")}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "#86868B" }}>
        {t("signup.hasAccount")}{" "}
        <Link href="/login" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
          {t("nav.signIn")}
        </Link>
      </div>

      <AuthTermsFooter />
    </AuthShell>
  );
}
