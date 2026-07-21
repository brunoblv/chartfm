import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCommunityBySlug } from "@/lib/community-auth";
import { VotacaoDaSemanaClient } from "@/app/votacao-da-semana/VotacaoDaSemanaClient";
import { getServerTranslations } from "@/lib/i18n/server-translations";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await getServerTranslations();
  const community = await getCommunityBySlug(slug);
  if (!community) return { title: t("communities.votacaoMetaTitleDefault") };
  return {
    title: t("communities.votacaoMetaTitle", { name: community.name }),
    description: t("communities.votacaoMetaDescription", { name: community.name }),
    alternates: { canonical: `/community/${encodeURIComponent(community.slug)}/votacao` },
  };
}

export default async function CommunityVotacaoPage({ params }: Props) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) notFound();

  return (
    <VotacaoDaSemanaClient
      scope="community"
      communitySlug={community.slug}
      communityName={community.name}
    />
  );
}
