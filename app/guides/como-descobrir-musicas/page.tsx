import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.descobrirMetaTitle"),
    description: t("guides.descobrirMetaDescription"),
    alternates: { canonical: "/guides/como-descobrir-musicas" },
  };
}

export default async function GuideDescobrir() {
  const { t } = await getServerTranslations();
  return (
    <LegalPage
      title={t("guides.descobrirTitle")}
      subtitle={t("guides.descobrirSubtitle")}
      sections={[
        {
          title: t("guides.descobrirSec1Title"),
          body: [t("guides.descobrirSec1Body1"), t("guides.descobrirSec1Body2"), t("guides.descobrirSec1Body3")],
        },
        {
          title: t("guides.descobrirSec2Title"),
          body: [t("guides.descobrirSec2Body1"), t("guides.descobrirSec2Body2"), t("guides.descobrirSec2Body3")],
        },
        {
          title: t("guides.descobrirSec3Title"),
          body: [t("guides.descobrirSec3Body1"), t("guides.descobrirSec3Body2"), t("guides.descobrirSec3Body3")],
        },
        {
          title: t("guides.descobrirSec4Title"),
          body: [t("guides.descobrirSec4Body1"), t("guides.descobrirSec4Body2"), t("guides.descobrirSec4Body3")],
        },
        {
          title: t("guides.descobrirSec5Title"),
          body: [t("guides.descobrirSec5Body1"), t("guides.descobrirSec5Body2"), t("guides.descobrirSec5Body3")],
        },
        {
          title: t("guides.descobrirSec6Title"),
          body: [t("guides.descobrirSec6Body1"), t("guides.descobrirSec6Body2")],
        },
        {
          title: t("guides.descobrirSec7Title"),
          body: [
            <>
              {t("guides.descobrirSec7Prefix")}{" "}
              <InstitutionalInlineLink href="/discover">{t("guides.descobrirSec7Link1")}</InstitutionalInlineLink>
              {t("guides.descobrirSec7Mid1")}{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-o-global-100">
                {t("guides.descobrirSec7Link2")}
              </InstitutionalInlineLink>{" "}
              {t("guides.descobrirSec7Mid2")}{" "}
              <InstitutionalInlineLink href="/guides/como-participar-de-comunidades">
                {t("guides.descobrirSec7Link3")}
              </InstitutionalInlineLink>{" "}
              {t("guides.descobrirSec7Suffix")}
            </>,
          ],
        },
      ]}
    />
  );
}
