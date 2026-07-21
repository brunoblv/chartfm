import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.copaMetaTitle"),
    description: t("guides.copaMetaDescription"),
    alternates: { canonical: "/guides/como-funciona-a-copa" },
  };
}

export default async function GuideComoFuncionaACopa() {
  const { t } = await getServerTranslations();
  return (
    <LegalPage
      title={t("guides.copaTitle")}
      subtitle={t("guides.copaSubtitle")}
      sections={[
        {
          title: t("guides.copaSec1Title"),
          body: [t("guides.copaSec1Body1")],
        },
        {
          title: t("guides.copaSec2Title"),
          body: [
            t("guides.copaSec2Body1"),
            <>
              {t("guides.copaSec2Prefix")}{" "}
              <InstitutionalInlineLink href="/copa/ao-vivo">/copa/ao-vivo</InstitutionalInlineLink>
              {t("guides.copaSec2Suffix")}
            </>,
            t("guides.copaSec2Body3"),
          ],
        },
        {
          title: t("guides.copaSec3Title"),
          body: [
            <>
              {t("guides.copaSec3Prefix")}{" "}
              <InstitutionalInlineLink href="/copa/grupos">/copa/grupos</InstitutionalInlineLink>
              {t("guides.copaSec3Suffix")}
            </>,
            t("guides.copaSec3Body2"),
          ],
        },
        {
          title: t("guides.copaSec4Title"),
          body: [
            <>
              {t("guides.copaSec4Prefix")}{" "}
              <InstitutionalInlineLink href="/copa/chaveamento">/copa/chaveamento</InstitutionalInlineLink>
              {t("guides.copaSec4Suffix")}
            </>,
            t("guides.copaSec4Body2"),
          ],
        },
        {
          title: t("guides.copaSec5Title"),
          body: [
            t("guides.copaSec5Body1"),
            <>
              {t("guides.copaSec5Prefix")}{" "}
              <InstitutionalInlineLink href="/copa/regras">/copa/regras</InstitutionalInlineLink>
              {t("guides.copaSec5Suffix")}
            </>,
          ],
        },
      ]}
    />
  );
}
