import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Sobre | ChartFM",
  description: "Conheça o ChartFM, a rede social de paradas musicais semanais feita por fãs, para fãs. Saiba como funciona, o que você pode fazer e nossa história.",
};

export default function AboutPage() {
  return (
    <LegalPage
      title="Sobre o ChartFM"
      subtitle="Uma plataforma feita por fãs, para fãs."
      sections={[
        {
          title: "Nossa história",
          body: [
            "O ChartFM nasceu da paixão de fãs por música, cultura pop e pelas icônicas paradas musicais que marcaram gerações. Muito antes das redes sociais transformarem a forma como consumimos música, comunidades de fãs já criavam suas próprias \"personal charts\" semanalmente — listas pessoais que registravam os artistas, músicas e álbuns que mais fizeram parte de suas vidas em determinado momento.",
            "Essas paradas não eram apenas números. Elas funcionavam como um diário musical, refletindo emoções, fases da vida, descobertas e conexões criadas através da música. Em fóruns, blogs e comunidades online, fãs compartilhavam seus rankings semanais, comentavam subidas e quedas de posições, discutiam lançamentos e acompanhavam a evolução de seus artistas favoritos como se estivessem acompanhando charts oficiais da indústria musical.",
            "Foi dentro desse cenário que surgiu o ChartFM.",
            "A plataforma foi criada com o objetivo de transformar essa experiência em algo mais moderno, organizado e acessível. O que antes dependia de planilhas, imagens editadas manualmente e publicações espalhadas pela internet agora pode ser feito em um ambiente dedicado inteiramente à cultura das paradas musicais pessoais.",
            "Mais do que apenas criar rankings, o ChartFM busca conectar pessoas através da música. Aqui, cada usuário pode montar sua própria chart semanal, registrar os sons que marcaram seus dias, acompanhar a evolução de artistas e álbuns favoritos, descobrir novos lançamentos através das listas da comunidade e compartilhar seu gosto musical com pessoas do mundo inteiro.",
          ],
        },
        {
          title: "Uma comunidade movida pela música",
          body: [
            "O coração do ChartFM é sua comunidade. Todos os rankings publicados ajudam a construir um grande retrato coletivo do que os usuários estão ouvindo em tempo real. A plataforma reúne automaticamente as charts individuais para formar o Global 100, uma parada agregada que destaca as músicas, artistas e álbuns mais populares da semana dentro da comunidade.",
            "O resultado é uma experiência dinâmica e viva, onde hits globais convivem lado a lado com artistas independentes, descobertas inesperadas, clássicos revisitados e tendências que surgem organicamente entre os usuários. Cada atualização semanal conta uma nova história sobre o momento musical vivido pela comunidade.",
            "Além das charts pessoais e da parada global, o ChartFM também oferece ferramentas para explorar estatísticas, acompanhar históricos, comparar desempenho de músicas e visualizar a evolução de artistas ao longo do tempo — transformando a experiência de acompanhar música em algo mais interativo e envolvente.",
          ],
        },
        {
          title: "Reviews, notas e críticas musicais",
          body: [
            "A música também é sobre opinião, interpretação e troca de experiências. Por isso, o ChartFM conta com um espaço dedicado para avaliações e reviews de álbuns, singles e projetos musicais.",
            "Os usuários podem dar notas, escrever críticas, compartilhar análises e descobrir como a comunidade recebeu cada lançamento. Inspirado na cultura de crítica musical presente em revistas, sites especializados e fóruns de fãs, esse espaço permite que diferentes perspectivas convivam em um ambiente construído por pessoas apaixonadas por música.",
            "As avaliações coletivas ajudam a destacar os projetos mais aclamados da comunidade, incentivando discussões, recomendações e novas descobertas musicais diariamente.",
          ],
        },
        {
          title: "Nossa missão",
          body: [
            "O ChartFM é um espaço feito por fãs, para fãs.",
            "Nossa missão é preservar e modernizar a cultura das personal charts, criando uma plataforma onde música, memória e comunidade se encontram. Queremos oferecer um ambiente onde cada ranking tenha significado, cada review represente uma voz e cada usuário possa expressar sua identidade musical de forma livre e criativa.",
            "Acreditamos que a música conecta pessoas, cria lembranças e acompanha momentos importantes da vida. E, no ChartFM, cada parada semanal se torna parte dessa história.",
          ],
        },
      ]}
    />
  );
}
