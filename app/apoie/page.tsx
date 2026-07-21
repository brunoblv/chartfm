import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalCallout,
  InstitutionalDivider,
  InstitutionalList,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

const DONATE_URL = "https://mepagaumcafe.com.br/p/chartfm/";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("apoie.metaTitle"),
    description: t("apoie.metaDescription"),
    alternates: { canonical: "/apoie" },
  };
}

export default async function ApoiePage() {
  const { t } = await getServerTranslations();

  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle={t("apoie.subtitle")}>
        {t("apoie.title")}
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 16,
            padding: "28px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "var(--accent-tint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-subtle)", margin: 0, maxWidth: 480 }}>
            {t("apoie.cardBody")}
          </p>
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--accent)",
              color: "var(--btn-dark-fg, #fff)",
              fontSize: 15,
              fontWeight: 700,
              padding: "13px 26px",
              borderRadius: 999,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            {t("apoie.ctaText")}
          </a>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t("apoie.redirectHint")}
          </span>
        </div>

        <InstitutionalDivider />

        <InstitutionalSection title={t("apoie.whereGoesTitle")}>
          <InstitutionalList
            items={[
              t("apoie.whereGoesItem1"),
              t("apoie.whereGoesItem2"),
              t("apoie.whereGoesItem3"),
            ]}
          />
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("apoie.otherWaysTitle")}>
          <InstitutionalParagraph>{t("apoie.otherWaysBody")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalCallout>
          {t("apoie.thanksCallout")}
        </InstitutionalCallout>
      </div>
    </InstitutionalLayout>
  );
}
