import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Como funciona a Copa ChartFM | Guias ChartFM",
  description:
    "Guia rápido para participar da Copa ChartFM: como votar nas partidas, acompanhar o chaveamento e ver os grupos.",
  alternates: { canonical: "/guides/como-funciona-a-copa" },
};

export default function GuideComoFuncionaACopa() {
  return (
    <LegalPage
      title="Como funciona a Copa ChartFM"
      subtitle="Guia rápido para participar do torneio de artistas"
      sections={[
        {
          title: "O que é a Copa",
          body: [
            "A Copa ChartFM é um torneio de artistas disputado pela comunidade. Cada artista tem um representante que escala 8 músicas antes do início da competição, e essas músicas se enfrentam em partidas contra outros artistas ao longo de uma fase de grupos e depois de um mata-mata. Quem decide o resultado de cada partida é o voto dos usuários.",
          ],
        },
        {
          title: "Como participar votando",
          body: [
            "Você participa da Copa votando nas partidas em andamento. Cada partida coloca uma música de um artista contra uma música de outro artista, e você escolhe a que prefere. A música com mais votos vence a partida.",
            "As partidas de cada dia ficam disponíveis em /copa/ao-vivo, junto com o placar em tempo real de quem está na frente.",
            "Não é preciso torcer para os mesmos artistas o torneio inteiro — você pode votar partida por partida, conforme as músicas em disputa.",
          ],
        },
        {
          title: "Acompanhar os grupos",
          body: [
            "Na fase inicial, os artistas são divididos em grupos. Para ver a composição de cada grupo e a tabela de pontos atualizada, acesse /copa/grupos.",
            "Os dois primeiros colocados de cada grupo avançam para a fase eliminatória.",
          ],
        },
        {
          title: "Acompanhar o chaveamento",
          body: [
            "Depois da fase de grupos, a competição vira mata-mata. Para ver o chaveamento completo — quem enfrenta quem em cada fase, até a final — acesse /copa/chaveamento.",
            "O chaveamento é atualizado conforme os resultados das partidas saem, então dá para acompanhar a trajetória de um artista específico até onde ele for.",
          ],
        },
        {
          title: "Formato resumido e regras completas",
          body: [
            "Em resumo: são 64 artistas divididos em 16 grupos de 4, com 12 dias de competição. Cada artista enfrenta os outros três do seu grupo; os dois melhores de cada grupo avançam a um mata-mata de 32 artistas até a final. Empates no mata-mata são decididos, em ordem, por gols, depois por votos (prorrogação) e por fim pela pontuação do Global 100 das músicas (pênaltis).",
            "Esse resumo cobre o essencial para acompanhar e votar. Para o regulamento oficial completo, com todos os critérios de desempate e detalhes da escalação, veja /copa/regras.",
          ],
        },
      ]}
    />
  );
}
