"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { ChartFMLogo } from "@/components/ui/ChartFMLogo";
import { useTranslations } from "@/hooks/useTranslations";

export function InstitutionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslations();

  const tabs = [
    { href: "/about", label: t("nav.about") },
    { href: "/guides", label: t("nav.guides") },
    { href: "/whats-new", label: t("nav.whatsNew") },
    { href: "/contact", label: t("nav.contact") },
    { href: "/support", label: t("nav.support") },
    { href: "/terms-of-use", label: t("nav.terms") },
    { href: "/privacy-policy", label: t("nav.privacy") },
  ];

  return (
    <Shell noPadding hideGlobalFooter>
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          borderBottom: "1px solid var(--divider)",
          background: "var(--surface)",
          position: "sticky",
          top: 0,
          zIndex: 40,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tabs.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href === "/guides" && pathname.startsWith("/guides/")) ||
            (tab.href === "/support" && pathname.startsWith("/support"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: "13px 18px",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--text)" : "var(--text-muted)",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: -1,
                whiteSpace: "nowrap",
                flexShrink: 0,
                letterSpacing: "-0.01em",
                textDecoration: "none",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div
        style={{
          padding: "40px 24px 80px",
        }}
      >
        {children}
      </div>

      <footer
        style={{
          borderTop: "1px solid var(--divider)",
          background: "var(--surface)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <ChartFMLogo size={18} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>ChartFM</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12, marginBottom: 0 }}>
          © {new Date().getFullYear()} ChartFM. Todos os direitos reservados.
        </p>
      </footer>
    </Shell>
  );
}
