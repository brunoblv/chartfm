import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalIconCard,
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { GUIDES } from "@/lib/content/helpContent";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.indexMetaTitle"),
    description: t("guides.indexMetaDescription"),
    alternates: { canonical: "/guides" },
  };
}

export default async function GuidesPage() {
  const { t } = await getServerTranslations();

  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle={t("guides.indexSubtitle")}>{t("guides.indexTitle")}</InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {GUIDES.map((guide) => (
          <InstitutionalIconCard
            key={guide.key}
            icon={guide.icon}
            title={t(`guides.${guide.key}Title`)}
            description={t(`guides.${guide.key}Body`)}
            href={guide.href}
          />
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <InstitutionalMutedCallout>
          {t("guides.indexCalloutPrefix")}{" "}
          <InstitutionalInlineLink href="/faq">{t("guides.indexCalloutFaqLink")}</InstitutionalInlineLink>{" "}
          {t("guides.indexCalloutMiddle")}{" "}
          <InstitutionalInlineLink href="/contact">{t("guides.indexCalloutContactLink")}</InstitutionalInlineLink>{" "}
          {t("guides.indexCalloutSuffix")}
        </InstitutionalMutedCallout>
      </div>
    </InstitutionalLayout>
  );
}
