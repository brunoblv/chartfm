import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalCallout,
  InstitutionalDivider,
  InstitutionalInlineLink,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Sobre | ChartFM",
  description:
    "Conheça o ChartFM — plataforma para criar paradas musicais, acompanhar o que a comunidade ouve e descobrir músicas novas.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle updatedAt="junho de 2025">Sobre o ChartFM</InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <InstitutionalSection title="O que é o ChartFM">
          <InstitutionalParagraph>
            O ChartFM é uma plataforma para quem gosta de música e quer organizar o que está ouvindo. Aqui você
            cria suas próprias paradas musicais, acompanha o que outras pessoas estão escutando e descobre músicas
            novas por meio das listas compartilhadas pela comunidade.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="Como surgiu">
          <InstitutionalParagraph>
            A ideia veio de fãs de música que queriam uma forma simples de registrar e compartilhar suas preferências
            semanais — algo parecido com as paradas de rádio, mas feito por ouvintes comuns. O projeto começou pequeno
            e foi crescendo com o apoio da comunidade.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="Para quem é o ChartFM">
          <InstitutionalParagraph>
            Para qualquer pessoa que ouve música com regularidade e quer mais do que só playlists. Se você costuma
            pensar &quot;qual foi a melhor música desta semana?&quot; ou quer saber o que seus amigos estão ouvindo, o
            ChartFM foi feito para isso.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="Nossa missão">
          <InstitutionalParagraph>
            Dar às pessoas uma forma de registrar sua relação com a música ao longo do tempo. As paradas que você cria
            hoje viram um histórico de tudo que você ouviu, semana a semana.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalCallout>
          Tem dúvidas ou quer entrar em contato? Acesse a página{" "}
          <InstitutionalInlineLink href="/contact">Contato</InstitutionalInlineLink>.
        </InstitutionalCallout>
      </div>
    </InstitutionalLayout>
  );
}
