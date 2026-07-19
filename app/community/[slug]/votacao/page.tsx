import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCommunityBySlug } from "@/lib/community-auth";
import { VotacaoDaSemanaClient } from "@/app/votacao-da-semana/VotacaoDaSemanaClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) return { title: "Votação | ChartFM" };
  return {
    title: `Votação · ${community.name} | ChartFM`,
    description: `Vote na Melhor da Semana e no Flashback da Semana em ${community.name}. Só membros podem participar.`,
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
