import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.avaliarMetaTitle"),
    description: t("guides.avaliarMetaDescription"),
    alternates: { canonical: "/guides/como-avaliar-albuns" },
  };
}

export default async function GuideAvaliarAlbuns() {
  const { t } = await getServerTranslations();
  return (
    <LegalPage
      title={t("guides.avaliarTitle")}
      subtitle={t("guides.avaliarSubtitle")}
      sections={[
        {
          title: t("guides.avaliarSec1Title"),
          body: [t("guides.avaliarSec1Body1"), t("guides.avaliarSec1Body2"), t("guides.avaliarSec1Body3")],
        },
        {
          title: t("guides.avaliarSec2Title"),
          body: [
            t("guides.avaliarSec2Body1"),
            t("guides.avaliarSec2Body2"),
            t("guides.avaliarSec2Body3"),
            t("guides.avaliarSec2Body4"),
          ],
        },
        {
          title: t("guides.avaliarSec3Title"),
          body: [t("guides.avaliarSec3Body1"), t("guides.avaliarSec3Body2"), t("guides.avaliarSec3Body3")],
        },
        {
          title: t("guides.avaliarSec4Title"),
          body: [t("guides.avaliarSec4Body1"), t("guides.avaliarSec4Body2"), t("guides.avaliarSec4Body3")],
        },
        {
          title: t("guides.avaliarSec5Title"),
          body: [t("guides.avaliarSec5Body1"), t("guides.avaliarSec5Body2"), t("guides.avaliarSec5Body3")],
        },
        {
          title: t("guides.avaliarSec6Title"),
          body: [
            <>
              {t("guides.avaliarSec6Prefix")}{" "}
              <InstitutionalInlineLink href="/criticsfm">{t("guides.avaliarSec6Link1")}</InstitutionalInlineLink>{" "}
              {t("guides.avaliarSec6Mid1")}{" "}
              <InstitutionalInlineLink href="/discover">{t("guides.avaliarSec6Link2")}</InstitutionalInlineLink>{" "}
              {t("guides.avaliarSec6Mid2")}{" "}
              <InstitutionalInlineLink href="/guides/glossario">{t("guides.avaliarSec6Link3")}</InstitutionalInlineLink>{" "}
              {t("guides.avaliarSec6Suffix")}
            </>,
          ],
        },
      ]}
    />
  );
}
