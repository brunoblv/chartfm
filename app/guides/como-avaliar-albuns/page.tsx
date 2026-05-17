import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Como avaliar álbuns no CriticsFM | Guias ChartFM",
  description:
    "Aprenda a avaliar álbuns, escrever reviews e explorar críticas da comunidade no CriticsFM. Guia completo sobre o módulo de reviews musicais do ChartFM.",
  alternates: { canonical: "/guides/como-avaliar-albuns" },
};

export default function GuideAvaliarAlbuns() {
  return (
    <LegalPage
      title="Como avaliar álbuns no CriticsFM"
      subtitle="Guia para reviews, notas e críticas musicais"
      sections={[
        {
          title: "O que é o CriticsFM?",
          body: [
            "O CriticsFM é o módulo de reviews musicais do ChartFM. Nele, usuários podem avaliar álbuns, EPs, mixtapes e projetos musicais com notas e críticas escritas. A proposta é criar um espaço de crítica musical gerada pela própria comunidade — não por jornalistas de plantão, mas por pessoas que realmente ouvem e sentem a música.",
            "O nome é uma homenagem à cultura de crítica musical que sempre existiu entre fãs: em fóruns, blogs pessoais, grupos de discussão e zines caseiros. O CriticsFM formaliza esse espaço dentro do ChartFM, dando visibilidade às opiniões da comunidade.",
            "Avaliações do CriticsFM são independentes das paradas semanais. Você pode avaliar um álbum lançado em qualquer época, não apenas os da semana atual.",
          ],
        },
        {
          title: "Como avaliar um álbum",
          body: [
            "Acesse a página do CriticsFM pelo menu lateral ou visite diretamente a rota /criticsfm. Na página de um álbum específico, você encontra o botão de avaliação.",
            "A nota vai de 0 a 10, com incrementos de 0.5. Isso oferece granularidade suficiente para distinguir entre um álbum que você considera 7.5 (bom, mas com falhas) de um 8.0 (muito bom, recomendado).",
            "Além da nota, você pode escrever uma review textual. Não há limite mínimo de caracteres — uma frase já é válida. Mas reviews mais elaboradas tendem a gerar mais interação e discussão com outros usuários.",
          ],
        },
        {
          title: "O que considerar ao avaliar",
          body: [
            "Não existe forma correta de avaliar um álbum. O que importa é que sua nota e review reflitam genuinamente sua experiência com aquele trabalho. Alguns critérios que usuários costumam levar em conta: consistência das faixas, coerência artística, originalidade, produção, letras, impacto emocional e relevância dentro da discografia do artista.",
            "Evite avaliar com base em expectativa excessiva ou hype. Um álbum que é exatamente o que prometeu ser merece crédito por isso, mesmo que não tenha rompido barreiras. Avalie o que está na música, não o que você esperava encontrar.",
            "Reviews que explicam o raciocínio por trás da nota — mesmo que discordantes da maioria — tendem a ser mais valiosas para a comunidade do que simples classificações sem contexto.",
          ],
        },
        {
          title: "Explorar avaliações da comunidade",
          body: [
            "No CriticsFM, você pode ver a nota média de cada álbum calculada a partir de todas as avaliações enviadas pela comunidade. Isso cria um consenso coletivo que muitas vezes difere das notas de críticos profissionais — e isso é parte do valor da plataforma.",
            "Você pode navegar pelos álbuns mais bem avaliados, pelos mais controversos (onde as notas ficam muito divididas) e pelos mais recentes. Isso ajuda a descobrir projetos que a comunidade considera imperdíveis, mesmo que não tenham recebido atenção da mídia especializada.",
            "Também é possível ver o histórico de avaliações de outros usuários, o que ajuda a identificar curadores cujo gosto musical se parece com o seu — e potencialmente seguir essas pessoas para descobrir novos álbuns.",
          ],
        },
        {
          title: "Como encontrar álbuns para avaliar",
          body: [
            "Use a busca dentro do CriticsFM para encontrar um álbum específico pelo nome ou pelo artista. Se o álbum não existir na base de dados, você pode sugeri-lo para inclusão.",
            "A página inicial do CriticsFM exibe lançamentos recentes, álbuns em tendência e projetos com muitas avaliações novas — o que facilita descobrir o que a comunidade está discutindo naquele momento.",
            "Você também pode chegar a um álbum através do perfil de um artista, onde todos os projetos cadastrados ficam listados. Isso é especialmente útil para quem quer avaliar toda a discografia de um artista favorito.",
          ],
        },
      ]}
    />
  );
}
