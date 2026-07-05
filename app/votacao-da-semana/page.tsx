import type { Metadata } from "next";
import { VotacaoDaSemanaClient } from "./VotacaoDaSemanaClient";

export const metadata: Metadata = {
  title: "Votação da Semana | ChartFM",
  description:
    "Vote na Melhor da Semana e no Flashback da Semana entre as músicas indicadas pelas paradas pessoais da comunidade.",
  alternates: { canonical: "/votacao-da-semana" },
};

export default function VotacaoDaSemanaPage() {
  return <VotacaoDaSemanaClient />;
}
