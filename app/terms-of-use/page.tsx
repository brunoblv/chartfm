import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalInlineLink,
  InstitutionalList,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("termsOfUse.metaTitle"),
    description: t("termsOfUse.metaDescription"),
    alternates: { canonical: "/terms-of-use" },
  };
}

export default async function TermsPage() {
  const { t } = await getServerTranslations();

  return (
    <InstitutionalLayout>
      <InstitutionalTitle updatedAt="julho de 2026">{t("termsOfUse.title")}</InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)" }}>
        <InstitutionalSection title={t("termsOfUse.section1Title")}>
          <InstitutionalParagraph>{t("termsOfUse.section1Body")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("termsOfUse.section2Title")}>
          <InstitutionalParagraph>{t("termsOfUse.section2Intro")}</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                t("termsOfUse.section2Item1"),
                t("termsOfUse.section2Item2"),
                t("termsOfUse.section2Item3"),
                t("termsOfUse.section2Item4"),
              ]}
            />
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("termsOfUse.section3Title")}>
          <InstitutionalList
            items={[
              t("termsOfUse.section3Item1"),
              t("termsOfUse.section3Item2"),
              t("termsOfUse.section3Item3"),
              t("termsOfUse.section3Item4"),
              t("termsOfUse.section3Item5"),
            ]}
          />
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("termsOfUse.section4Title")}>
          <InstitutionalParagraph>{t("termsOfUse.section4Body")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("termsOfUse.section5Title")}>
          <InstitutionalParagraph>{t("termsOfUse.section5Body")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("termsOfUse.section6Title")}>
          <InstitutionalParagraph>{t("termsOfUse.section6Body")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("termsOfUse.section7Title")}>
          <InstitutionalParagraph>
            {t("termsOfUse.section7Prefix")}{" "}
            <InstitutionalInlineLink href="/privacy-policy">{t("termsOfUse.section7LinkText")}</InstitutionalInlineLink>.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("termsOfUse.section8Title")}>
          <InstitutionalParagraph>{t("termsOfUse.section8Body")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("termsOfUse.section9Title")}>
          <InstitutionalParagraph>
            {t("termsOfUse.section9Prefix")}{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>.
          </InstitutionalParagraph>
        </InstitutionalSection>
      </div>
    </InstitutionalLayout>
  );
}
