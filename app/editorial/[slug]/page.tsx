import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import { EditorialPostDetail } from "@/components/editorial/EditorialPostDetail";
import { getEditorialPick, getEditorialPicksSorted } from "@/lib/editorial-picks";
import {
  resolveEditorialPreviewImage,
  resolveEditorialPreviewImages,
} from "@/lib/editorial-preview-image";
import { getServerTranslations } from "@/lib/i18n/server-translations";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const picks = await getEditorialPicksSorted();
  return picks.map((pick) => ({ slug: pick.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pick = await getEditorialPick(slug);
  const { t } = await getServerTranslations();
  if (!pick) return { title: t("editorial.notFoundTitle") };

  return {
    title: `${pick.title} | Editorial ChartFM`,
    description: pick.excerpt,
    alternates: { canonical: `/editorial/${pick.slug}` },
    openGraph: {
      title: pick.title,
      description: pick.excerpt,
      url: `https://chartfm.com.br/editorial/${pick.slug}`,
      type: "article",
      publishedTime: pick.publishedAt,
      authors: [pick.author],
    },
  };
}

export default async function EditorialPostPage({ params }: Props) {
  const { slug } = await params;
  const pick = await getEditorialPick(slug);
  if (!pick) notFound();

  const previewImage = await resolveEditorialPreviewImage(pick);

  const related = (await getEditorialPicksSorted())
    .filter((p) => p.slug !== pick.slug)
    .slice(0, 3);
  const relatedImages = await resolveEditorialPreviewImages(related);
  const relatedPicks = related.map((p) => ({
    pick: p,
    previewImage: relatedImages.get(p.slug) ?? null,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: pick.title,
    description: pick.excerpt,
    datePublished: pick.publishedAt,
    author: { "@type": "Organization", name: pick.author },
    publisher: {
      "@type": "Organization",
      name: "ChartFM",
      url: "https://chartfm.com.br",
    },
    mainEntityOfPage: `https://chartfm.com.br/editorial/${pick.slug}`,
  };

  return (
    <InstitutionalLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EditorialPostDetail pick={pick} previewImage={previewImage} relatedPicks={relatedPicks} />
    </InstitutionalLayout>
  );
}
