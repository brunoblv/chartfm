import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.importarMetaTitle"),
    description: t("guides.importarMetaDescription"),
    alternates: { canonical: "/guides/como-importar-historico" },
  };
}

export default async function GuideImportarHistorico() {
  const { t } = await getServerTranslations();
  return (
    <LegalPage
      title={t("guides.importarTitle")}
      subtitle={t("guides.importarSubtitle")}
      sections={[
        {
          title: t("guides.importarSec1Title"),
          body: [t("guides.importarSec1Body1"), t("guides.importarSec1Body2")],
        },
        {
          title: t("guides.importarSec2Title"),
          body: [t("guides.importarSec2Body1"), t("guides.importarSec2Body2")],
        },
        {
          title: t("guides.importarSec3Title"),
          body: [
            t("guides.importarSec3Body1"),
            t("guides.importarSec3Body2"),
            t("guides.importarSec3Body3"),
            t("guides.importarSec3Body4"),
          ],
        },
        {
          title: t("guides.importarSec4Title"),
          body: [t("guides.importarSec4Body1"), t("guides.importarSec4Body2"), t("guides.importarSec4Body3")],
        },
        {
          title: t("guides.importarSec5Title"),
          body: [t("guides.importarSec5Body1"), t("guides.importarSec5Body2"), t("guides.importarSec5Body3")],
        },
        {
          title: t("guides.importarSec6Title"),
          body: [t("guides.importarSec6Body1"), t("guides.importarSec6Body2"), t("guides.importarSec6Body3")],
        },
        {
          title: t("guides.importarSec7Title"),
          body: [
            <>
              {t("guides.importarSec7Prefix")}{" "}
              <InstitutionalInlineLink href="/guides/como-criar-sua-parada">
                {t("guides.importarSec7Link")}
              </InstitutionalInlineLink>{" "}
              {t("guides.importarSec7Suffix")}
            </>,
          ],
        },
      ]}
    />
  );
}
