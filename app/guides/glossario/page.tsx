import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Glossário do ChartFM | Guias ChartFM",
  description:
    "Entenda os termos usados no ChartFM: parada, chart, estreia, retorno, pico, semanas no ranking, snapshot, Global 100 e Copa.",
  alternates: { canonical: "/guides/glossario" },
};

export default function GuideGlossario() {
  return (
    <LegalPage
      title="Glossário do ChartFM"
      subtitle="O que significa cada termo usado na plataforma"
      sections={[
        {
          title: "Parada e chart",
          body: [
            "Parada é a lista pessoal semanal de um usuário, com até 100 músicas escolhidas e ordenadas por ele. Cada parada é publicada uma vez por semana e fica associada ao perfil de quem a criou. É a partir da soma de todas as paradas publicadas que o Global 100 é calculado.",
            "Chart é o termo usado em outras partes do ChartFM como sinônimo de parada, por exemplo, o botão de criação em /create se chama 'Criar Chart'. Os dois termos descrevem a mesma coisa: sua lista semanal pessoal de músicas. Não há diferença de significado dentro da plataforma; use o que preferir.",
          ],
        },
        {
          title: "Estreia e retorno",
          body: [
            "Estreia é quando uma música aparece no Global 100 pela primeira vez. Isso acontece quando usuários suficientes incluem essa música em suas paradas da semana para que ela entre no ranking coletivo. Uma estreia não precisa ser um lançamento recente - pode ser uma música antiga que só agora ganhou força na comunidade.",
            "Retorno é quando uma música volta a aparecer no Global 100 depois de ter ficado pelo menos uma semana fora do ranking. Diferente da estreia, o retorno indica que a música já tinha aparecido antes, saiu, e está sendo valorizada pelos usuários de novo. O sistema identifica esse status automaticamente comparando a semana atual com o histórico da música.",
          ],
        },
        {
          title: "Pico e semanas no ranking",
          body: [
            "Pico (ou peak) é a melhor posição que uma música já alcançou no Global 100, considerando todo o seu histórico. Uma música que chegou à 3ª posição em uma semana e depois caiu para a 40ª mantém o pico registrado como 3, mesmo que nunca mais volte a esse patamar.",
            "Semanas no ranking é o total de vezes que uma música apareceu em qualquer posição do Global 100, somando todas as semanas desde que passou a ser calculada, não precisa ser consecutivo. Uma música pode ter muitas semanas no ranking sem nunca ter chegado perto do topo; são duas métricas independentes.",
          ],
        },
        {
          title: "Snapshot",
          body: [
            "Snapshot é o registro congelado do Global 100 de uma semana específica, gerado quando a semana fecha. Depois de criado, um snapshot não muda mais - mesmo que paradas sejam editadas depois, o histórico daquela semana permanece exatamente como foi calculado no momento do fechamento.",
            "É isso que garante que o histórico de rankings anteriores do ChartFM esteja sempre disponível para consulta, semana a semana, sem risco de ser reescrito.",
          ],
        },
        {
          title: "Global 100",
          body: [
            "Global 100 é o ranking coletivo do ChartFM, calculado a partir da soma dos pontos de todas as paradas publicadas pelos usuários durante a semana. Cada posição em cada parada pessoal vale uma quantidade de pontos, e a soma por música determina o ranking final.",
            <>
              A semana fecha toda terça-feira à meia-noite (horário de Brasília) e o snapshot correspondente é
              processado poucas horas depois. Para entender a fórmula por trás dos pontos, veja o guia{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-a-pontuacao">
                como funciona a pontuação
              </InstitutionalInlineLink>
              ; para entender o ranking como um todo, veja{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-o-global-100">
                como funciona o Global 100
              </InstitutionalInlineLink>
              .
            </>,
          ],
        },
        {
          title: "Copa",
          body: [
            "Copa é o torneio eliminatório entre artistas do ChartFM, disputado em formato de chaveamento, parecido com uma copa de futebol. É uma competição paralela ao Global 100, movida a votos da comunidade em cada confronto, em vez de pontos de parada.",
            <>
              Os detalhes completos de formato, grupos, fases e critérios de desempate estão nas páginas{" "}
              <InstitutionalInlineLink href="/copa">/copa</InstitutionalInlineLink> e{" "}
              <InstitutionalInlineLink href="/copa/regras">/copa/regras</InstitutionalInlineLink>. Este glossário não
              repete essas regras, é só um ponteiro para onde encontrá-las.
            </>,
          ],
        },
        {
          title: "Leia também",
          body: [
            <>
              Veja o índice completo de{" "}
              <InstitutionalInlineLink href="/guides">guias do ChartFM</InstitutionalInlineLink> ou confira o{" "}
              <InstitutionalInlineLink href="/global/100">Global 100</InstitutionalInlineLink> ao vivo.
            </>,
          ],
        },
      ]}
    />
  );
}
