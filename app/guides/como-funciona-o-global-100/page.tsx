import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.global100MetaTitle"),
    description: t("guides.global100MetaDescription"),
    alternates: { canonical: "/guides/como-funciona-o-global-100" },
  };
}

export default async function GuideGlobal100() {
  const { t } = await getServerTranslations();
  return (
    <LegalPage
      title={t("guides.global100Title")}
      subtitle={t("guides.global100Subtitle")}
      sections={[
        {
          title: t("guides.global100Sec1Title"),
          body: [t("guides.global100Sec1Body1"), t("guides.global100Sec1Body2")],
        },
        {
          title: t("guides.global100Sec2Title"),
          body: [t("guides.global100Sec2Body1"), t("guides.global100Sec2Body2"), t("guides.global100Sec2Body3")],
        },
        {
          title: t("guides.global100Sec3Title"),
          body: [t("guides.global100Sec3Body1"), t("guides.global100Sec3Body2")],
        },
        {
          title: t("guides.global100Sec4Title"),
          body: [t("guides.global100Sec4Body1"), t("guides.global100Sec4Body2"), t("guides.global100Sec4Body3")],
        },
        {
          title: t("guides.global100Sec5Title"),
          body: [t("guides.global100Sec5Body1"), t("guides.global100Sec5Body2"), t("guides.global100Sec5Body3")],
        },
        {
          title: t("guides.global100Sec6Title"),
          body: [t("guides.global100Sec6Body1"), t("guides.global100Sec6Body2")],
        },
        {
          title: t("guides.global100Sec7Title"),
          body: [
            <>
              {t("guides.global100Sec7Prefix")}{" "}
              <InstitutionalInlineLink href="/global/100">/global/100</InstitutionalInlineLink>
              {t("guides.global100Sec7Mid1")}{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-a-pontuacao">
                {t("guides.global100Sec7Link1")}
              </InstitutionalInlineLink>{" "}
              {t("guides.global100Sec7Mid2")}{" "}
              <InstitutionalInlineLink href="/guides/como-criar-sua-parada">
                {t("guides.global100Sec7Link2")}
              </InstitutionalInlineLink>
              .
            </>,
          ],
        },
      ]}
    />
  );
}
