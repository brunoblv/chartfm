import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.criarParadaMetaTitle"),
    description: t("guides.criarParadaMetaDescription"),
    alternates: { canonical: "/guides/como-criar-sua-parada" },
  };
}

export default async function GuideCrearParada() {
  const { t } = await getServerTranslations();
  return (
    <LegalPage
      title={t("guides.criarParadaTitle")}
      subtitle={t("guides.criarParadaSubtitle")}
      sections={[
        {
          title: t("guides.criarParadaSec1Title"),
          body: [
            t("guides.criarParadaSec1Body1"),
            t("guides.criarParadaSec1Body2"),
            t("guides.criarParadaSec1Body3"),
          ],
        },
        {
          title: t("guides.criarParadaSec2Title"),
          body: [t("guides.criarParadaSec2Body1"), t("guides.criarParadaSec2Body2")],
        },
        {
          title: t("guides.criarParadaSec3Title"),
          body: [
            t("guides.criarParadaSec3Body1"),
            t("guides.criarParadaSec3Body2"),
            t("guides.criarParadaSec3Body3"),
          ],
        },
        {
          title: t("guides.criarParadaSec4Title"),
          body: [t("guides.criarParadaSec4Body1"), t("guides.criarParadaSec4Body2")],
        },
        {
          title: t("guides.criarParadaSec5Title"),
          body: [
            t("guides.criarParadaSec5Body1"),
            t("guides.criarParadaSec5Body2"),
            t("guides.criarParadaSec5Body3"),
          ],
        },
        {
          title: t("guides.criarParadaSec6Title"),
          body: [
            t("guides.criarParadaSec6Body1"),
            t("guides.criarParadaSec6Body2"),
            t("guides.criarParadaSec6Body3"),
            t("guides.criarParadaSec6Body4"),
          ],
        },
        {
          title: t("guides.criarParadaSec7Title"),
          body: [
            <>
              {t("guides.criarParadaSec7Prefix")} <InstitutionalInlineLink href="/create">/create</InstitutionalInlineLink>
              {t("guides.criarParadaSec7Mid1")}{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-o-global-100">
                {t("guides.criarParadaSec7Link1")}
              </InstitutionalInlineLink>{" "}
              {t("guides.criarParadaSec7Mid2")}{" "}
              <InstitutionalInlineLink href="/guides/como-importar-historico">
                {t("guides.criarParadaSec7Link2")}
              </InstitutionalInlineLink>{" "}
              {t("guides.criarParadaSec7Suffix")}
            </>,
          ],
        },
      ]}
    />
  );
}
