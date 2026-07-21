import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.glossarioMetaTitle"),
    description: t("guides.glossarioMetaDescription"),
    alternates: { canonical: "/guides/glossario" },
  };
}

export default async function GuideGlossario() {
  const { t } = await getServerTranslations();
  return (
    <LegalPage
      title={t("guides.glossarioTitle")}
      subtitle={t("guides.glossarioSubtitle")}
      sections={[
        {
          title: t("guides.glossarioSec1Title"),
          body: [t("guides.glossarioSec1Body1"), t("guides.glossarioSec1Body2")],
        },
        {
          title: t("guides.glossarioSec2Title"),
          body: [t("guides.glossarioSec2Body1"), t("guides.glossarioSec2Body2")],
        },
        {
          title: t("guides.glossarioSec3Title"),
          body: [t("guides.glossarioSec3Body1"), t("guides.glossarioSec3Body2")],
        },
        {
          title: t("guides.glossarioSec4Title"),
          body: [t("guides.glossarioSec4Body1"), t("guides.glossarioSec4Body2")],
        },
        {
          title: t("guides.glossarioSec5Title"),
          body: [
            t("guides.glossarioSec5Body1"),
            <>
              {t("guides.glossarioSec5Prefix")}{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-a-pontuacao">
                {t("guides.glossarioSec5Link1")}
              </InstitutionalInlineLink>
              {t("guides.glossarioSec5Mid")}{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-o-global-100">
                {t("guides.glossarioSec5Link2")}
              </InstitutionalInlineLink>
              .
            </>,
          ],
        },
        {
          title: t("guides.glossarioSec6Title"),
          body: [
            t("guides.glossarioSec6Body1"),
            <>
              {t("guides.glossarioSec6Prefix")} <InstitutionalInlineLink href="/copa">/copa</InstitutionalInlineLink>{" "}
              {t("guides.glossarioSec6Mid")}{" "}
              <InstitutionalInlineLink href="/copa/regras">/copa/regras</InstitutionalInlineLink>.{" "}
              {t("guides.glossarioSec6Suffix")}
            </>,
          ],
        },
        {
          title: t("guides.glossarioSec7Title"),
          body: [
            <>
              {t("guides.glossarioSec7Prefix")}{" "}
              <InstitutionalInlineLink href="/guides">{t("guides.glossarioSec7Link1")}</InstitutionalInlineLink>{" "}
              {t("guides.glossarioSec7Mid")}{" "}
              <InstitutionalInlineLink href="/global/100">{t("guides.glossarioSec7Link2")}</InstitutionalInlineLink>{" "}
              {t("guides.glossarioSec7Suffix")}
            </>,
          ],
        },
      ]}
    />
  );
}
