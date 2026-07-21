import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.comunidadesMetaTitle"),
    description: t("guides.comunidadesMetaDescription"),
    alternates: { canonical: "/guides/como-participar-de-comunidades" },
  };
}

export default async function GuideComunidades() {
  const { t } = await getServerTranslations();
  return (
    <LegalPage
      title={t("guides.comunidadesTitle")}
      subtitle={t("guides.comunidadesSubtitle")}
      sections={[
        {
          title: t("guides.comunidadesSec1Title"),
          body: [
            t("guides.comunidadesSec1Body1"),
            t("guides.comunidadesSec1Body2"),
            t("guides.comunidadesSec1Body3"),
          ],
        },
        {
          title: t("guides.comunidadesSec2Title"),
          body: [
            t("guides.comunidadesSec2Body1"),
            t("guides.comunidadesSec2Body2"),
            t("guides.comunidadesSec2Body3"),
          ],
        },
        {
          title: t("guides.comunidadesSec3Title"),
          body: [
            t("guides.comunidadesSec3Body1"),
            t("guides.comunidadesSec3Body2"),
            t("guides.comunidadesSec3Body3"),
          ],
        },
        {
          title: t("guides.comunidadesSec4Title"),
          body: [
            t("guides.comunidadesSec4Body1"),
            t("guides.comunidadesSec4Body2"),
            t("guides.comunidadesSec4Body3"),
          ],
        },
        {
          title: t("guides.comunidadesSec5Title"),
          body: [
            t("guides.comunidadesSec5Body1"),
            t("guides.comunidadesSec5Body2"),
            t("guides.comunidadesSec5Body3"),
            t("guides.comunidadesSec5Body4"),
          ],
        },
        {
          title: t("guides.comunidadesSec6Title"),
          body: [
            <>
              {t("guides.comunidadesSec6Prefix")}{" "}
              <InstitutionalInlineLink href="/communities">/communities</InstitutionalInlineLink>
              {t("guides.comunidadesSec6Mid1")}{" "}
              <InstitutionalInlineLink href="/guides/como-criar-sua-parada">
                {t("guides.comunidadesSec6Link1")}
              </InstitutionalInlineLink>{" "}
              {t("guides.comunidadesSec6Mid2")}{" "}
              <InstitutionalInlineLink href="/guides/glossario">{t("guides.comunidadesSec6Link2")}</InstitutionalInlineLink>{" "}
              {t("guides.comunidadesSec6Suffix")}
            </>,
          ],
        },
      ]}
    />
  );
}
