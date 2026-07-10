import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Como funciona o Global 100 | Guias ChartFM",
  description:
    "Entenda como o ranking Global 100 do ChartFM é calculado, como os pontos são atribuídos, por que músicas sobem e caem e como sua parada pessoal influencia o ranking coletivo.",
  alternates: { canonical: "/guides/como-funciona-o-global-100" },
};

export default function GuideGlobal100() {
  return (
    <LegalPage
      title="Como funciona o Global 100"
      subtitle="Entenda o cálculo por trás do ranking coletivo do ChartFM"
      sections={[
        {
          title: "O que é o Global 100?",
          body: [
            "O Global 100 é a parada musical coletiva do ChartFM. Diferente dos rankings de streaming, que contam reproduções automáticas e passivas, o Global 100 é construído a partir das escolhas deliberadas dos usuários: cada posição no ranking coletivo reflete o quanto uma música foi valorizada pelas pessoas que curaram suas listas pessoais naquela semana.",
            "O resultado é uma parada que representa o gosto real da comunidade — não o que um algoritmo recomendou ou o que tocou mais vezes em modo aleatório, mas o que os usuários conscientemente escolheram como as músicas mais importantes de suas semanas.",
          ],
        },
        {
          title: "Como os pontos são calculados",
          body: [
            "O sistema de pontuação do ChartFM usa uma curva geométrica: a música na 1ª posição de uma parada vale 1.000 pontos, e cada posição abaixo vale 95% da posição anterior. Assim, a 2ª posição vale 950 pontos, a 5ª vale 815, a 10ª vale 630, a 50ª vale 81, e a 100ª (última posição possível) vale 6.",
            "Essa curva foi escolhida de propósito: ela valoriza mais o topo das paradas pessoais do que o volume. Uma música que aparece em poucas paradas, mas sempre nas primeiras posições, pontua mais do que uma música que aparece em muitas paradas só nas posições finais.",
            "Esses pontos são somados de todas as paradas publicadas na semana. Isso premia músicas que os usuários realmente colocam em destaque, não apenas as mais mencionadas.",
          ],
        },
        {
          title: "O papel de cada fã de música",
          body: [
            "Cada usuário que publica uma parada semanal contribui igualmente para o Global 100. Não existe peso diferente por número de seguidores, tempo de plataforma ou histórico. Um usuário novo tem o mesmo impacto que alguém que usa o ChartFM há dois anos.",
            "Isso é de propósito: o ranking deve refletir toda a comunidade, não só os perfis com mais seguidores. Isso cria condições para que artistas independentes e descobertas pessoais apareçam no ranking quando são genuinamente valorizados por vários fãs de música ao mesmo tempo.",
          ],
        },
        {
          title: "Movimentações: subidas, quedas e estreias",
          body: [
            "A cada semana, o ranking global é recalculado do zero. Uma música que liderou o ranking por três semanas consecutivas pode sair completamente se nenhum usuário a incluir na nova semana.",
            "O sistema identifica automaticamente três tipos de movimentação: estreia (a música aparece no ranking pela primeira vez), retorno (volta ao ranking depois de ter ficado fora) e movimento (subida ou queda em relação à semana anterior).",
            "Com algumas semanas de histórico dá para ver o comportamento de cada música: lançamentos entram alto e caem rápido; clássicos ficam semanas no meio da tabela; músicas de artistas menores sobem aos poucos, conforme mais gente as descobre.",
          ],
        },
        {
          title: "Quando o ranking é atualizado",
          body: [
            "A semana do Global 100 fecha toda terça-feira à meia-noite (horário de Brasília): paradas publicadas até esse horário contam para a semana que está terminando. Pouco depois, por volta das 6h de terça, o snapshot da semana é processado e vira um registro permanente, preservando o histórico completo de todos os rankings anteriores.",
            "Paradas publicadas depois da meia-noite de terça contam para a semana seguinte, não para a que acabou de fechar. Se você publicar na terça-feira de manhã, sua chart contribui para o ranking que só será consolidado na terça seguinte.",
            "O histórico completo de semanas anteriores está disponível na página do Global 100. É possível navegar entre semanas e ver como o ranking evoluiu ao longo do tempo.",
          ],
        },
        {
          title: "Por que o Global 100 é diferente das charts de streaming",
          body: [
            "Nas grandes plataformas de streaming, uma música sobe no ranking quando é reproduzida — independente de ter sido escolhida conscientemente ou tocado no modo aleatório. Isso favorece músicas promovidas algoritmicamente e cria rankings que muitas vezes não refletem o que as pessoas realmente gostam.",
            "No ChartFM, cada posição exige uma decisão intencional do usuário. Ninguém entra em uma parada por acidente. Isso torna o Global 100 um retrato mais próximo do que as pessoas de fato gostam, especialmente para artistas independentes que têm bases de fãs leais mas menos investimento em promoção algorítmica.",
          ],
        },
        {
          title: "Leia também",
          body: [
            <>
              Veja o ranking ao vivo em{" "}
              <InstitutionalInlineLink href="/global/100">/global/100</InstitutionalInlineLink>, entenda o
              detalhe da{" "}
              <InstitutionalInlineLink href="/guides/como-funciona-a-pontuacao">
                fórmula de pontuação
              </InstitutionalInlineLink>{" "}
              e aprenda a{" "}
              <InstitutionalInlineLink href="/guides/como-criar-sua-parada">
                criar sua parada semanal
              </InstitutionalInlineLink>
              .
            </>,
          ],
        },
      ]}
    />
  );
}
