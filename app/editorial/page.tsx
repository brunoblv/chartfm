import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalParagraph,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { EditorialPostPreviewCard } from "@/components/editorial/EditorialPostPreviewCard";
import { Ad } from "@/components/ui/Ad";
import { getEditorialPicksSorted } from "@/lib/editorial-picks";
import { resolveEditorialPreviewImages } from "@/lib/editorial-preview-image";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("editorial.metaTitle"),
    description: t("editorial.metaDescription"),
    alternates: { canonical: "/editorial" },
    openGraph: {
      title: t("editorial.ogTitle"),
      description: t("editorial.ogDescription"),
      url: "https://chartfm.com.br/editorial",
    },
  };
}

export default async function EditorialPage() {
  const { t } = await getServerTranslations();
  const picks = await getEditorialPicksSorted();
  const previewImages = await resolveEditorialPreviewImages(picks);

  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle={t("editorial.subtitle")}>{t("editorial.title")}</InstitutionalTitle>

      <div style={{ maxWidth: 720, marginBottom: 36 }}>
        <InstitutionalParagraph>{t("editorial.intro1")}</InstitutionalParagraph>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-subtle)", margin: "14px 0 0 0" }}>
          {t("editorial.intro2")}
        </p>
      </div>

      <Ad placement="editorial" format="rectangle" style={{ margin: "0 0 36px 0" }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 20,
          marginBottom: 40,
        }}
      >
        {picks.map((pick) => (
          <EditorialPostPreviewCard
            key={pick.slug}
            pick={pick}
            previewImage={previewImages.get(pick.slug) ?? null}
          />
        ))}
      </div>

      <InstitutionalMutedCallout>
        {t("editorial.calloutPrefix")}{" "}
        <InstitutionalInlineLink href="/guides">{t("editorial.calloutGuidesLink")}</InstitutionalInlineLink>{" "}
        {t("editorial.calloutMid1")}{" "}
        <InstitutionalInlineLink href="/global/100">{t("editorial.calloutGlobal100Link")}</InstitutionalInlineLink>{" "}
        {t("editorial.calloutMid2")}{" "}
        <InstitutionalInlineLink href="/faq">{t("editorial.calloutFaqLink")}</InstitutionalInlineLink>.
      </InstitutionalMutedCallout>
    </InstitutionalLayout>
  );
}
