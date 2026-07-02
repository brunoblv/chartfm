"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import {
  AuthShell,
  AuthError,
  AuthSuccess,
  AuthTermsFooter,
  authInputStyle,
  authPrimaryButtonStyle,
  useCuratorCount,
} from "@/components/auth/AuthShell";
import { useTranslations } from "@/hooks/useTranslations";

function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

function authErrorMessage(code: string | null, t: (k: string) => string): string | null {
  if (!code) return null;
  switch (code) {
    case "Configuration":
      return t("login.errConfiguration");
    case "AccessDenied":
      return t("login.errAccessDenied");
    case "CredentialsSignin":
      return t("login.errCredentials");
    case "EmailNotVerified":
      return t("login.errEmailNotVerified");
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
      return t("login.errOAuth");
    default:
      return t("login.errGeneric").replace("{code}", code);
  }
}

export default function LoginClient({ googleConfigured }: { googleConfigured: boolean }) {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const curatorCount = useCuratorCount();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [googleReady, setGoogleReady] = useState(googleConfigured);
  const [authError, setAuthError] = useState<string | null>(
    authErrorMessage(searchParams.get("error"), t),
  );
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const verified = searchParams.get("verified") === "1";

  const callbackUrl = (() => {
    const from = searchParams.get("from");
    if (from && from.startsWith("/") && !from.startsWith("//")) return from;
    return "/";
  })();

  useEffect(() => {
    if (!googleConfigured) return;
    getProviders()
      .then((p) => setGoogleReady(Boolean(p?.google) || googleConfigured))
      .catch(() => setGoogleReady(googleConfigured));
  }, [googleConfigured]);

  const handleGoogle = () => {
    setLoadingGoogle(true);
    setAuthError(null);
    signIn("google", { callbackUrl }).catch(() => {
      setLoadingGoogle(false);
      setAuthError(t("login.errGoogleStart"));
    });
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoadingEmail(true);
    setAuthError(null);
    setEmailNotVerified(false);

    const checkRes = await fetch("/api/auth/check-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const checkData = await checkRes.json().catch(() => ({}));

    if (checkData.error === "email_not_verified") {
      setLoadingEmail(false);
      setEmailNotVerified(true);
      setAuthError(t("login.errEmailNotVerified"));
      return;
    }

    if (!checkRes.ok) {
      setLoadingEmail(false);
      setAuthError(t("login.errCredentials"));
      return;
    }

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
      callbackUrl,
    });

    setLoadingEmail(false);

    if (result?.error) {
      setAuthError(t("login.errCredentials"));
      return;
    }

    // Navegação completa (não router.push): o middleware pula requisições RSC,
    // então só um page load garante o redirect de needsHandle -> /onboarding.
    window.location.href = result?.url ?? callbackUrl;
  };

  const busy = loadingGoogle || loadingEmail;

  return (
    <AuthShell curatorCount={curatorCount}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
        {t("login.welcome")}
      </div>
      <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 8px 0", lineHeight: 1.1 }}>
        {t("login.formHeadline")}
      </h2>
      <p style={{ fontSize: 14, color: "#86868B", margin: "0 0 32px 0", lineHeight: 1.5 }}>
        {t("login.formSubhead")}
      </p>

      {verified && <AuthSuccess message={t("login.emailVerified")} />}
      {authError && <AuthError message={authError} />}
      {emailNotVerified && email.trim() && (
        <p style={{ fontSize: 13, color: "#86868B", margin: "0 0 16px 0", lineHeight: 1.5 }}>
          <Link
            href={`/verify-email?email=${encodeURIComponent(email.trim())}`}
            style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}
          >
            {t("login.resendVerification")}
          </Link>
        </p>
      )}

      {googleConfigured && (
        <>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy || !googleReady}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "14px 18px",
              background: "#1D1D1F",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              cursor: busy || !googleReady ? "not-allowed" : "pointer",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              opacity: !googleReady ? 0.55 : 1,
            }}
          >
            <span style={{ background: "white", padding: 4, borderRadius: 6, display: "grid", placeItems: "center" }}>
              <GoogleLogo size={16} />
            </span>
            {loadingGoogle ? t("login.redirecting") : t("login.continueGoogle")}
          </button>

          {!googleReady && (
            <p style={{ marginTop: 12, fontSize: 12, color: "#86868B", lineHeight: 1.5, background: "rgba(250,36,60,0.05)", borderRadius: 10, padding: "12px 14px" }}>
              {t("login.googleNotConfigured")}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 22px 0", color: "#86868B", fontSize: 12, fontWeight: 500 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
            {t("login.orEmail")}
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
          </div>
        </>
      )}

      <form onSubmit={handleEmailLogin}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 6 }}>
          {t("login.email")}
        </label>
        <input
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          required
          style={authInputStyle}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 6 }}>
          {t("login.password")}
        </label>
        <div style={{ position: "relative" }}>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
            style={{ ...authInputStyle, marginBottom: 0, paddingRight: 88 }}
          />
          <Link
            href="/forgot-password"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              fontSize: 11,
              color: "#FA243C",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("login.forgot")}
          </Link>
        </div>

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          style={authPrimaryButtonStyle(busy || !email.trim() || !password)}
        >
          {loadingEmail ? t("login.signingIn") : t("nav.signIn")}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "#86868B" }}>
        {t("login.noAccount")}{" "}
        <Link href="/signup" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
          {t("login.createAccount")}
        </Link>
      </div>

      <AuthTermsFooter />
    </AuthShell>
  );
}
