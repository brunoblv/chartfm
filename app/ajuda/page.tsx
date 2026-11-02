import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail } from "lucide-react";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import { GUIDES, FAQ_ITEMS } from "@/lib/content/helpContent";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { scoringDocParams } from "@/lib/scoring-docs";
import { HelpSearch } from "./HelpSearch";
import { AjudaTwoColumn } from "./AjudaTwoColumn";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("helpCenter.metaTitle"),
    description: t("helpCenter.metaDescription"),
    alternates: { canonical: "/ajuda" },
  };
}

function guideByHref(href: string) {
  const guide = GUIDES.find((g) => g.href === href);
  if (!guide) throw new Error(`Guia não encontrado: ${href}`);
  return guide;
}

export default async function AjudaPage() {
  const { t, locale } = await getServerTranslations();
  const docParams = scoringDocParams(locale);

  const QUICK_START = [
    {
      step: t("helpCenter.step1Label"),
      title: t("helpCenter.step1Title"),
      description: t("helpCenter.step1Desc"),
      href: "/signup",
      highlight: true,
    },
    {
      step: t("helpCenter.step2Label"),
      title: t("helpCenter.step2Title"),
      description: t("helpCenter.step2Desc"),
      href: "/settings",
      highlight: false,
    },
    {
      step: t("helpCenter.step3Label"),
      title: t("helpCenter.step3Title"),
      description: t("helpCenter.step3Desc"),
      href: "/create/start",
      highlight: false,
    },
  ];

  const GUIDE_CATEGORIES = [
    {
      label: t("helpCenter.categoryParadas"),
      hrefs: [
        "/guides/como-criar-sua-parada",
        "/guides/como-funciona-o-global-100",
        "/guides/como-funciona-a-pontuacao",
        "/guides/como-importar-historico",
      ],
    },
    {
      label: t("helpCenter.categoryComunidade"),
      hrefs: [
        "/guides/como-participar-de-comunidades",
        "/guides/como-funciona-a-copa",
        "/guides/como-descobrir-musicas",
        "/guides/como-avaliar-albuns",
      ],
    },
    {
      label: t("helpCenter.categoryReferencia"),
      hrefs: ["/guides/glossario"],
    },
  ].map((category) => ({ ...category, guides: category.hrefs.map((href) => guideByHref(href!)) }));

  const SEARCH_ITEMS = [
    ...GUIDE_CATEGORIES.flatMap((c) => c.guides.map((g) => ({ label: t(`guides.${g.key}Title`), href: g.href as string, type: "Guia" as const }))),
    ...FAQ_ITEMS.map((item) => ({ label: t(item.questionKey), href: "/faq", type: "FAQ" as const })),
  ];

  const previewFaq = FAQ_ITEMS.slice(0, 3);

  return (
    <InstitutionalLayout>
      {/* ===== HERO SEARCH ===== */}
      <div style={{ textAlign: "center", padding: "8px 0 40px" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          {t("helpCenter.eyebrow")}
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 10px 0", color: "var(--text)" }}>
          {t("helpCenter.heroTitle")}
        </h1>
        <p style={{ fontSize: 14.5, color: "var(--text-subtle)", margin: "0 0 24px 0" }}>
          {t("helpCenter.heroSubtitle")}
        </p>
        <HelpSearch items={SEARCH_ITEMS} />
      </div>

      {/* ===== PRIMEIROS PASSOS ===== */}
      <section style={{ marginBottom: 44 }}>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "var(--text)",
            margin: "0 0 16px 0",
          }}
        >
          {t("helpCenter.quickStartTitle")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {QUICK_START.map((step) => (
            <Link
              key={step.step}
              href={step.href}
              style={{
                textDecoration: "none",
                padding: 20,
                borderRadius: 14,
                border: `1px solid ${step.highlight ? "var(--accent-tint)" : "var(--divider)"}`,
                background: step.highlight ? "var(--accent-tint)" : "var(--surface)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 8,
                }}
              >
                {step.step}
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{step.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-subtle)", lineHeight: 1.5 }}>{step.description}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== GUIAS + FAQ/SUPORTE ===== */}
      <AjudaTwoColumn
        guides={
        <div>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "var(--text)",
              margin: "0 0 16px 0",
            }}
          >
            {t("helpCenter.guidesByTopicTitle")}
          </h2>
          {GUIDE_CATEGORIES.map((category) => (
            <div key={category.label} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "6px 0 2px",
                }}
              >
                {category.label}
              </div>
              {category.guides.map((guide) => (
                <Link
                  key={guide.href}
                  href={guide.href as string}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "13px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--divider)",
                    background: "var(--surface)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{t(`guides.${guide.key}Title`)}</span>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        }
        sidebar={
        <div>
          <h2
            id="faq"
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "var(--text)",
              margin: "0 0 16px 0",
              scrollMarginTop: 80,
            }}
          >
            {t("helpCenter.faqTitle")}
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              background: "var(--divider)",
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid var(--divider)",
              marginBottom: 28,
            }}
          >
            {previewFaq.map((item) => (
              <div key={item.questionKey} style={{ background: "var(--surface)", padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t(item.questionKey)}</div>
                <div style={{ fontSize: 13, color: "var(--text-subtle)", lineHeight: 1.55 }}>{t(item.answerKey, docParams)}</div>
              </div>
            ))}
            <Link
              href="/faq"
              style={{
                background: "var(--fill-subtle)",
                padding: "14px 16px",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--accent)",
                textDecoration: "none",
              }}
            >
              {t("helpCenter.faqViewAll")}
            </Link>
          </div>

          <h2
            id="suporte"
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "var(--text)",
              margin: "0 0 16px 0",
              scrollMarginTop: 80,
            }}
          >
            {t("helpCenter.talkTitle")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link
              href="/support"
              style={{
                textDecoration: "none",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: 16,
                borderRadius: 12,
                border: "1px solid var(--divider)",
                background: "var(--surface)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: "var(--accent-tint)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--accent)",
                  flexShrink: 0,
                }}
              >
                <LifeBuoy size={17} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("helpCenter.supportCardTitle")}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("helpCenter.supportCardDesc")}</div>
              </div>
            </Link>
            <Link
              href="/contact"
              style={{
                textDecoration: "none",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: 16,
                borderRadius: 12,
                border: "1px solid var(--divider)",
                background: "var(--surface)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: "var(--accent-tint)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--accent)",
                  flexShrink: 0,
                }}
              >
                <Mail size={17} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("helpCenter.contactCardTitle")}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("helpCenter.contactCardDesc")}</div>
              </div>
            </Link>
          </div>
        </div>
        }
      />
    </InstitutionalLayout>
  );
}
