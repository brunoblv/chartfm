import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalCallout,
  InstitutionalDivider,
  InstitutionalInlineLink,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("about.metaTitle"),
    description: t("about.metaDescription"),
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const { t, locale } = await getServerTranslations();

  return (
    <InstitutionalLayout>
      <InstitutionalTitle updatedAt={locale === "en" ? "November 2026" : "novembro de 2026"}>{t("about.title")}</InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <InstitutionalSection title={t("about.whatIsTitle")}>
          <InstitutionalParagraph>{t("about.whatIsBody")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("about.howTitle")}>
          <InstitutionalParagraph>{t("about.howBody1")}</InstitutionalParagraph>
          <InstitutionalParagraph>{t("about.howBody2")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("about.forWhoTitle")}>
          <InstitutionalParagraph>{t("about.forWhoBody")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("about.missionTitle")}>
          <InstitutionalParagraph>{t("about.missionBody")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("about.operatorTitle")}>
          <InstitutionalParagraph>{t("about.operatorBody")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("about.methodologyTitle")}>
          <InstitutionalParagraph>{t("about.methodologyBody1")}</InstitutionalParagraph>
          <InstitutionalParagraph>{t("about.methodologyBody2")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("about.sourcesTitle")}>
          <InstitutionalParagraph>{t("about.sourcesBody")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("about.curationTitle")}>
          <InstitutionalParagraph>{t("about.curationBody")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("about.moderationTitle")}>
          <InstitutionalParagraph>{t("about.moderationBody")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("about.correctionsTitle")}>
          <InstitutionalParagraph>{t("about.correctionsBody")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalCallout>
          {t("about.calloutPrefix")}{" "}
          <InstitutionalInlineLink href="/contact">{t("about.calloutLinkText")}</InstitutionalInlineLink>.
        </InstitutionalCallout>
      </div>
    </InstitutionalLayout>
  );
}
