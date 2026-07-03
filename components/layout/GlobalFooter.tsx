"use client";

import Link from "next/link";
import { ChartFMLogo } from "@/components/ui/ChartFMLogo";
import { SocialFooterBadges } from "@/components/ui/SocialFooterBadges";
import { useTranslations } from "@/hooks/useTranslations";

type LinkItem = { label: string; href: string };

const linkStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-subtle)",
  textDecoration: "none",
  display: "block",
};

const bottomLinkStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  textDecoration: "none",
};

const columnTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-muted)",
  marginBottom: 2,
};

function FooterColumn({ title, links }: { title: string; links: LinkItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={columnTitleStyle}>{title}</div>
      {links.map((item) => (
        <Link key={item.href + item.label} href={item.href} style={linkStyle}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}

type GlobalFooterProps = {
  isMobile?: boolean;
};

export function GlobalFooter({ isMobile = false }: GlobalFooterProps) {
  const { t } = useTranslations();
  const year = new Date().getFullYear();

  const productLinks: LinkItem[] = [
    { label: t("nav.global"), href: "/global" },
    { label: t("nav.discover"), href: "/discover" },
    { label: t("nav.criticsfm"), href: "/criticsfm" },
    { label: t("nav.communities"), href: "/communities" },
  ];

  const communityLinks: LinkItem[] = [
    { label: t("nav.whatsNew"), href: "/whats-new" },
    { label: t("nav.guides"), href: "/guides" },
    { label: t("nav.contact"), href: "/contact" },
    { label: t("nav.support"), href: "/support" },
  ];

  const legalLinks: LinkItem[] = [
    { label: t("globalFooter.aboutChartfm"), href: "/about" },
    { label: t("landing.footerTerms"), href: "/terms-of-use" },
    { label: t("landing.footerPrivacy"), href: "/privacy-policy" },
    { label: t("globalFooter.cookies"), href: "/privacy-policy#cookies" },
  ];

  const bottomLinks: LinkItem[] = [
    { label: t("nav.privacy"), href: "/privacy-policy" },
    { label: t("nav.terms"), href: "/terms-of-use" },
    { label: t("nav.contact"), href: "/contact" },
  ];

  return (
    <footer
      style={{
        marginTop: isMobile ? 40 : 0,
        borderTop: "1px solid var(--divider)",
        background: "var(--surface)",
        paddingBottom: isMobile ? 88 : 0,
      }}
    >
      <div
        style={{
          padding: isMobile ? "32px 16px 24px" : "40px 40px 32px",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr",
          gap: isMobile ? 28 : 32,
        }}
      >
        <div
          style={{
            gridColumn: isMobile ? "1 / -1" : undefined,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ChartFMLogo size={22} />
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text)",
              }}
            >
              ChartFM
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-muted)", margin: 0 }}>
            {t("globalFooter.tagline")}
          </p>
          <SocialFooterBadges />
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>© {year} ChartFM</div>
        </div>

        <FooterColumn title={t("landing.footerProduct")} links={productLinks} />
        <FooterColumn title={t("globalFooter.community")} links={communityLinks} />
        <FooterColumn title={t("landing.footerLegal")} links={legalLinks} />
      </div>

      <div style={{ height: 1, background: "var(--divider)" }} />

      <div
        style={{
          padding: isMobile ? "14px 16px" : "16px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("globalFooter.madeWith")}</span>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {bottomLinks.map((item) => (
            <Link key={item.href} href={item.href} style={bottomLinkStyle}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
