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
            "O ChartFM nasceu da paixão de fãs por música, cultura pop e pelas icônicas paradas musicais da MTV. Durante anos, pessoas ao redor da internet criaram suas próprias \"personal charts\" semanalmente — listas que representam os artistas, álbuns e músicas que mais marcaram seus dias. O que começou como uma tradição entre pequenos grupos de fãs se transformou em uma verdadeira comunidade.",
            "Dentro desse cenário surgiu o ChartFM: uma plataforma criada para automatizar, organizar e compartilhar paradas pessoais de forma simples, moderna e divertida, conectando pessoas que enxergam a música como parte da própria identidade.",
          ],
        },
        {
          title: "O que você pode fazer",
          body: [
            "Aqui, cada usuário pode montar sua própria chart semanal, acompanhar a evolução de artistas e álbuns favoritos, descobrir novos sons através das listas da comunidade e compartilhar seu gosto musical com o mundo.",
          ],
        },
        {
          title: "Mas o ChartFM vai além das paradas individuais",
          body: [
            "Toda semana, a plataforma reúne todas as charts dos usuários para criar o Global 100, uma parada coletiva que representa o que a comunidade está ouvindo em tempo real. O resultado é um retrato vivo dos artistas, músicas e álbuns mais amados da semana dentro da plataforma.",
          ],
        },
        {
          title: "Reviews e avaliações",
          body: [
            "Além disso, o site também conta com um espaço dedicado para avaliações e reviews de álbuns, onde usuários podem dar notas, escrever análises, compartilhar opiniões e descobrir como a comunidade recebeu cada lançamento — criando um ambiente inspirado na cultura de crítica musical e discussão entre fãs.",
          ],
        },
        {
          title: "Nossa missão",
          body: [
            "O ChartFM é um espaço feito por fãs, para fãs. Uma plataforma onde números contam histórias, rankings criam memórias e a música conecta pessoas.",
          ],
        },
      ]}
    />
  );
}
