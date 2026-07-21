import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { FAQ_ITEMS } from "@/lib/content/helpContent";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("faq.metaTitle"),
    description: t("faq.metaDescription"),
    alternates: { canonical: "/faq" },
  };
}

export default async function FaqPage() {
  const { t } = await getServerTranslations();

  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle={t("faq.subtitle")}>
        {t("faq.title")}
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {FAQ_ITEMS.map((item, index) => (
          <div key={item.questionKey} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {index > 0 && <InstitutionalDivider />}
            <InstitutionalSection title={t(item.questionKey)}>
              <InstitutionalParagraph>{t(item.answerKey)}</InstitutionalParagraph>
            </InstitutionalSection>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <InstitutionalMutedCallout>
          {t("faq.footerPrefix")}{" "}
          <InstitutionalInlineLink href="/guides">{t("faq.footerGuidesLink")}</InstitutionalInlineLink>{" "}
          {t("faq.footerMiddle")}{" "}
          <InstitutionalInlineLink href="/contact">{t("faq.footerContactLink")}</InstitutionalInlineLink>.
        </InstitutionalMutedCallout>
      </div>
    </InstitutionalLayout>
  );
}
