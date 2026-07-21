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
  const { t } = await getServerTranslations();

  return (
    <InstitutionalLayout>
      <InstitutionalTitle updatedAt="julho de 2026">{t("about.title")}</InstitutionalTitle>

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

        <InstitutionalCallout>
          {t("about.calloutPrefix")}{" "}
          <InstitutionalInlineLink href="/contact">{t("about.calloutLinkText")}</InstitutionalInlineLink>.
        </InstitutionalCallout>
      </div>
    </InstitutionalLayout>
  );
}
