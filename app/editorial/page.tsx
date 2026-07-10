import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalParagraph,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { EditorialPostPreviewCard } from "@/components/editorial/EditorialPostPreviewCard";
import { AdSlot } from "@/components/ui/AdSlot";
import { ADSENSE_SLOTS } from "@/lib/adsense-slots";
import { getEditorialPicksSorted } from "@/lib/editorial-picks";
import { resolveEditorialPreviewImages } from "@/lib/editorial-preview-image";

export const metadata: Metadata = {
  title: "Editorial | ChartFM",
  description:
    "Indicações de vídeos, clipes e playlists da equipe ChartFM. Textos editoriais sobre música, rankings e cultura de paradas pessoais.",
  alternates: { canonical: "/editorial" },
  openGraph: {
    title: "Editorial ChartFM",
    description:
      "Vídeos, clipes, playlists e leituras da equipe sobre o que a comunidade está ouvindo e votando.",
    url: "https://chartfm.com.br/editorial",
  },
};

export default async function EditorialPage() {
  const picks = await getEditorialPicksSorted();
  const previewImages = await resolveEditorialPreviewImages(picks);

  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle="Vídeos, clipes, playlists e textos da equipe ChartFM sobre música, rankings e cultura de paradas.">
        Editorial
      </InstitutionalTitle>

      <div style={{ maxWidth: 720, marginBottom: 36 }}>
        <InstitutionalParagraph>
          Esta seção reúne o trabalho editorial da casa: indicações de clipes e vídeos, playlists oficiais
          sincronizadas com o Global 100, a Copa e o Push, além de textos longos sobre artistas, álbuns e o
          funcionamento da plataforma. Tudo é público, não é preciso ter conta para ler ou ouvir.
        </InstitutionalParagraph>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-subtle)", margin: "14px 0 0 0" }}>
          Os artigos abaixo mostram uma prévia; clique em qualquer card para ver o texto completo, assistir ao
          vídeo incorporado ou abrir a playlist no player do Spotify. Quando há link do YouTube ou Spotify, a
          capa aparece automaticamente na prévia.
        </p>
      </div>

      <AdSlot slotId={ADSENSE_SLOTS.editorial} format="rectangle" style={{ margin: "0 0 36px 0" }} />

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
        Quer entender as regras da plataforma antes de mergulhar nos artigos? Comece pelos{" "}
        <InstitutionalInlineLink href="/guides">Guias</InstitutionalInlineLink>, pelo{" "}
        <InstitutionalInlineLink href="/global/100">Global 100 da semana</InstitutionalInlineLink> ou pelas{" "}
        <InstitutionalInlineLink href="/faq">Perguntas frequentes</InstitutionalInlineLink>.
      </InstitutionalMutedCallout>
    </InstitutionalLayout>
  );
}
