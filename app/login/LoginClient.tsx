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
  GoogleLogo,
  AuthDivider,
} from "@/components/auth/AuthShell";
import { useTranslations } from "@/hooks/useTranslations";

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
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 32px 0", lineHeight: 1.5 }}>
        {t("login.formSubhead")}
      </p>

      {verified && <AuthSuccess message={t("login.emailVerified")} />}
      {authError && <AuthError message={authError} />}
      {emailNotVerified && email.trim() && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
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
              background: "var(--btn-dark-bg)",
              color: "var(--btn-dark-fg)",
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
            <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, background: "rgba(250,36,60,0.05)", borderRadius: 10, padding: "12px 14px" }}>
              {t("login.googleNotConfigured")}
            </p>
          )}

          <AuthDivider label={t("login.orEmail")} />
        </>
      )}

      <form onSubmit={handleEmailLogin}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
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

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
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

      <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "var(--text-muted)" }}>
        {t("login.noAccount")}{" "}
        <Link href="/signup" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
          {t("login.createAccount")}
        </Link>
      </div>

      <AuthTermsFooter />
    </AuthShell>
  );
}
