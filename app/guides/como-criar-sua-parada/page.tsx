import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Como criar sua parada semanal | Guias ChartFM",
  description:
    "Passo a passo para montar e publicar sua parada semanal no ChartFM.",
  alternates: { canonical: "/guides/como-criar-sua-parada" },
};

export default function GuideCrearParada() {
  return (
    <LegalPage
      title="Como criar sua parada semanal"
      subtitle="Guia completo para montar e publicar sua chart pessoal"
      sections={[
        {
          title: "O que é uma parada pessoal?",
          body: [
            "No ChartFM, uma parada pessoal é uma lista semanal com as músicas que mais marcaram sua semana. Funciona de forma parecida com as grandes charts musicais, só que em vez de contar reproduções de streaming, você decide conscientemente quais músicas merecem estar na lista e em qual posição.",
            "Cada parada pode ter até 100 posições. Você escolhe as músicas, define a ordem e publica. Não há regra sobre gênero, época ou idioma - a parada é completamente sua.",
            "As paradas semanais são cumulativas: toda semana você parte do zero e monta uma nova lista. Isso cria um histórico musical que registra como seu gosto evoluiu ao longo do tempo.",
          ],
        },
        {
          title: "Passo 1 - Acesse a criação de chart",
          body: [
            "Para criar sua parada, clique em 'Criar Chart' no menu lateral ou acesse diretamente a rota /create. Você precisa estar logado para publicar uma parada.",
            "Se for sua primeira vez, o ChartFM pode sugerir que você complete o processo de onboarding antes, onde define seu nome de usuário e preferências iniciais.",
          ],
        },
        {
          title: "Passo 2 - Busque e adicione músicas",
          body: [
            "No editor de chart existem dois campos de busca separados: 'Catálogo' e 'Spotify'. Comece sempre pelo campo Catálogo, ele busca entre as músicas que já existem na base do ChartFM e costuma trazer resultado mais rápido.",
            "Se a música que você procura não aparecer no Catálogo (campo mostra 'Nenhuma música no catálogo'), use o campo Spotify logo abaixo. Ele busca direto na base do Spotify e, ao clicar na música encontrada, ela é adicionada à sua parada e cadastrada automaticamente no catálogo do ChartFM, assim, da próxima vez, ela já vai aparecer na busca do Catálogo.",
            "Clique na música desejada para adicioná-la à sua parada. Você pode adicionar até 100 faixas por chart semanal. Não há limite mínimo - se você ouviu apenas 5 músicas que valeram destaque na semana, basta listar essas 5.",
          ],
        },
        {
          title: "Passo 3 - Ordene as posições",
          body: [
            "A ordem das músicas na sua parada importa. A música na 1ª posição é aquela que mais marcou a semana para você. O ranking global usa essas posições no cálculo de pontos - quanto mais alta a posição, mais pontos a música recebe para o ranking coletivo.",
            "Você pode arrastar e soltar as músicas para reorganizá-las, ou usar os controles de posição disponíveis no editor. Revise a lista antes de publicar para garantir que a ordem reflete exatamente o que você quer comunicar.",
          ],
        },
        {
          title: "Passo 4 - Publique sua chart",
          body: [
            "Quando estiver satisfeito com a lista, clique em 'Publicar'. Sua parada entra imediatamente no feed da comunidade e começa a contribuir para o Global 100 da semana.",
            "Depois de publicada, a chart fica visível no seu perfil e pode ser curtida, comentada e repostada por outros usuários. Você também pode editar a parada após a publicação, mas atenção: edições após a publicação podem afetar a contribuição ao ranking global.",
            "Cada semana tem um ciclo próprio. O ranking global fecha toda terça-feira à meia-noite (BRT) e o snapshot é processado horas depois; as paradas publicadas antes desse horário contam para a semana em andamento.",
          ],
        },
        {
          title: "Dicas para uma boa parada",
          body: [
            "Seja honesto: coloque as músicas que realmente fizeram parte da sua semana, não aquelas que você acha que deveria ouvir. Isso torna sua parada mais autêntica e interessante para quem te segue.",
            "Publique regularmente: usuários que publicam toda semana constroem um histórico mais rico e tendem a ganhar mais visibilidade dentro da comunidade.",
            "Varie os gêneros: não existe restrição de estilo. Uma semana pode ter só K-Pop, outra pode misturar sertanejo com indie. A diversidade do seu gosto é o que torna sua curadoria única.",
            "Adicione músicas menos óbvias: além dos hits do momento, inclua descobertas pessoais, álbuns que você revisitou ou faixas que outros usuários provavelmente não conhecem. Assim outros usuários encontram músicas que não chegariam até eles de outra forma.",
          ],
        },
        {
          title: "Leia também",
          body: [
            <>
              Comece agora em{" "}
              <InstitutionalInlineLink href="/create">/create</InstitutionalInlineLink>, entenda{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-o-global-100">
                como funciona o Global 100
              </InstitutionalInlineLink>{" "}
              e veja como{" "}
              <InstitutionalInlineLink href="/guides/como-importar-historico">
                importar seu histórico do Last.fm ou Spotify
              </InstitutionalInlineLink>{" "}
              para montar a lista mais rápido.
            </>,
          ],
        },
      ]}
    />
  );
}
