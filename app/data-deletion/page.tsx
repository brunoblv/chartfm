import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalCallout,
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
    title: t("dataDeletion.metaTitle"),
    description: t("dataDeletion.metaDescription"),
    alternates: { canonical: "/data-deletion" },
  };
}

export default async function DataDeletionPage() {
  const { t } = await getServerTranslations();

  const DELETED_DATA = [
    t("dataDeletion.deletedData1"),
    t("dataDeletion.deletedData2"),
    t("dataDeletion.deletedData3"),
    t("dataDeletion.deletedData4"),
    t("dataDeletion.deletedData5"),
  ];

  return (
    <InstitutionalLayout>
      <InstitutionalTitle
        updatedAt="julho de 2026"
        subtitle={t("dataDeletion.subtitle")}
      >
        {t("dataDeletion.title")}
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)" }}>
        <InstitutionalSection title={t("dataDeletion.section1Title")}>
          <InstitutionalParagraph>{t("dataDeletion.section1Body")}</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>
              {t("dataDeletion.section1LinkPrefix")}{" "}
              <InstitutionalInlineLink href="/privacy-policy">{t("dataDeletion.section1LinkText")}</InstitutionalInlineLink>.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("dataDeletion.section2Title")}>
          <InstitutionalParagraph>{t("dataDeletion.section2Intro")}</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                t("dataDeletion.section2Step1"),
                t("dataDeletion.section2Step2"),
                t("dataDeletion.section2Step3"),
                t("dataDeletion.section2Step4"),
                t("dataDeletion.section2Step5"),
              ]}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <InstitutionalCallout>{t("dataDeletion.section2Callout")}</InstitutionalCallout>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("dataDeletion.section3Title")}>
          <InstitutionalParagraph>
            {t("dataDeletion.section3Prefix")}{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span> {t("dataDeletion.section3Middle")}{" "}
            <strong style={{ color: "var(--text)" }}>{t("dataDeletion.section3SubjectBold")}</strong> {t("dataDeletion.section3Suffix")}
          </InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                t("dataDeletion.section3Item1"),
                t("dataDeletion.section3Item2"),
                t("dataDeletion.section3Item3"),
              ]}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>{t("dataDeletion.section3Outro")}</InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("dataDeletion.section4Title")}>
          <InstitutionalParagraph>{t("dataDeletion.section4Intro")}</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList items={DELETED_DATA} />
          </div>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>{t("dataDeletion.section4Outro")}</InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("dataDeletion.section5Title")}>
          <InstitutionalParagraph>
            {t("dataDeletion.section5Prefix")}{" "}
            <strong style={{ color: "var(--text)" }}>{t("dataDeletion.section5Bold")}</strong>
            {t("dataDeletion.section5Suffix")}
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("dataDeletion.section6Title")}>
          <InstitutionalParagraph>
            {t("dataDeletion.section6Body")}{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("dataDeletion.section7Title")}>
          <InstitutionalParagraph>
            {t("dataDeletion.section7Prefix")}{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>
          </InstitutionalParagraph>
        </InstitutionalSection>
      </div>
    </InstitutionalLayout>
  );
}
