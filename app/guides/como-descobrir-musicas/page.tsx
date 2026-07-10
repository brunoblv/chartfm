import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Como descobrir músicas no ChartFM | Guias ChartFM",
  description:
    "Use o Discover do ChartFM para encontrar novos artistas, seguir fãs de música com gosto parecido e explorar charts por gênero. Guia completo para descoberta musical.",
  alternates: { canonical: "/guides/como-descobrir-musicas" },
};

export default function GuideDescobrir() {
  return (
    <LegalPage
      title="Como descobrir músicas no ChartFM"
      subtitle="Encontre novos artistas, fãs de música e tendências musicais"
      sections={[
        {
          title: "Por que descobrir música pelo ChartFM?",
          body: [
            "Plataformas de streaming recomendam músicas com base em algoritmos que analisam seu histórico de reprodução. O resultado é muitas vezes uma câmara de eco: você descobre mais do mesmo, raramente algo que verdadeiramente surpreende.",
            "O ChartFM oferece uma alternativa baseada em pessoas reais. Ao seguir fãs de música com gosto musical parecido com o seu, você descobre músicas através de alguém que deliberadamente escolheu incluí-las em sua lista da semana, não porque um algoritmo as recomendou, mas porque genuinamente as valorizou.",
            "Essa forma de descoberta é mais lenta, mas mais rica. As músicas que você encontra pelo ChartFM tendem a ser escolhas com mais contexto e significado por trás.",
          ],
        },
        {
          title: "Usando a página Discover",
          body: [
            "A página Discover é o ponto central de descoberta do ChartFM. Acesse pelo menu lateral para ver fãs de música em destaque da semana, rankings de artistas e músicas mais chartadas, e atalhos para explorar por gênero musical.",
            "Os rankings exibidos no Discover são atualizados semanalmente e refletem as paradas publicadas pela comunidade naquele período. Artistas que aparecem em múltiplas charts de usuários diferentes sobem naturalmente no ranking.",
            "Explore as abas disponíveis: a aba de Artistas mostra quem está crescendo mais rápido dentro da plataforma. A aba de Músicas mostra as faixas com mais presença nas charts da semana.",
          ],
        },
        {
          title: "Seguindo fãs de música",
          body: [
            "A forma mais eficiente de descobrir música no ChartFM é seguir fãs de música cujo gosto você já admira. Quando eles publicam novas paradas semanais, você recebe essas atualizações no seu feed.",
            "Para encontrar bons fãs de música, explore o Discover e veja quem está em destaque. Clique no perfil de um fã de música para ver seu histórico de charts, que artistas ele mais defende e como seu gosto se compara ao seu.",
            "Também é possível descobrir fãs de música através das comunidades. Membros ativos de comunidades que você frequenta costumam ter gostos alinhados com o seu, tornando-os candidatos naturais para seguir.",
          ],
        },
        {
          title: "Explorando por gênero",
          body: [
            "No Discover, você pode filtrar artistas e músicas por gênero musical. Os gêneros disponíveis incluem Pop, Hip-Hop/Rap, Sertanejo, R&B/Soul, Indie/Alt, Funk, Eletrônica e K-Pop, entre outros.",
            "Cada página de gênero exibe os artistas e músicas mais chartados dentro daquele estilo por usuários do ChartFM. É uma forma de ver o que está em alta dentro de um nicho específico, sem ser influenciado pelo que domina o ranking geral.",
            "Se você é fã de um estilo mais específico, as páginas de gênero são especialmente úteis para descobrir artistas que a mídia mainstream raramente destaca mas que têm uma base de fãs dedicada dentro da plataforma.",
          ],
        },
        {
          title: "Usando o Global 100 como ferramenta de descoberta",
          body: [
            "O Global 100 não serve apenas para acompanhar o ranking, é também uma excelente ferramenta de descoberta. Músicas que aparecem no ranking foram colocadas ali por múltiplos usuários diferentes, o que indica relevância genuína.",
            "Preste atenção especialmente nas entradas marcadas como 'nova' ou 'retorno'. Estreias no ranking muitas vezes indicam artistas ou músicas que estão ganhando força rapidamente dentro da comunidade, potenciais descobertas antes que se tornem amplamente conhecidas.",
            "Navegue também pelo histórico de semanas anteriores. Acompanhar como um artista cresceu no ranking ao longo de meses revela trajetórias interessantes e ajuda a entender quais artistas têm bases de fãs sólidas versus aqueles que tiveram apenas um momento viral.",
          ],
        },
        {
          title: "Dica: explore o perfil dos artistas",
          body: [
            "Cada artista no ChartFM tem uma página de perfil com informações sobre sua discografia, histórico de aparições no ranking global e avaliações de álbuns feitas pela comunidade. Visitar o perfil de um artista que você acabou de descobrir é um bom jeito de entender rapidamente como a comunidade o percebe.",
            "A página de perfil também mostra quais usuários mais chartaram aquele artista, o que pode ajudar a encontrar fãs de música com gosto parecido com o seu para seguir.",
          ],
        },
        {
          title: "Leia também",
          body: [
            <>
              Explore o{" "}
              <InstitutionalInlineLink href="/discover">Discover</InstitutionalInlineLink>, entenda{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-o-global-100">como funciona o Global 100</InstitutionalInlineLink>{" "}
              e veja como{" "}
              <InstitutionalInlineLink href="/guides/como-participar-de-comunidades">participar de comunidades</InstitutionalInlineLink>{" "}
              para descobrir fãs de música com gosto parecido com o seu.
            </>,
          ],
        },
      ]}
    />
  );
}
