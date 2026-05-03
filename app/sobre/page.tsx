import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Sobre | Chartify",
  description: "Conheça o Chartify, uma rede social de paradas musicais semanais.",
};

export default function AboutPage() {
  return (
    <LegalPage
      title="Sobre"
      subtitle="Uma rede social para transformar gosto musical em parada semanal."
      sections={[
        {
          title: "O que é o Chartify",
          body: [
            "O Chartify é uma rede social de paradas musicais semanais. A ideia é simples: você monta seu ranking, acompanha a trajetória das músicas, descobre curadores e participa de comunidades com gostos parecidos.",
            "As paradas públicas ajudam a formar rankings globais e de comunidades, dando contexto para o que pessoas reais estão ouvindo e defendendo naquela semana.",
          ],
        },
        {
          title: "Nossa proposta",
          body: [
            "Queremos que charts pessoais sejam mais do que uma lista solta: eles podem ser memória, curadoria, conversa e descoberta.",
            "O produto foi pensado para fãs de música, criadores de playlist, comunidades de artistas, nostálgicos de paradas e qualquer pessoa que goste de acompanhar movimentos semanais.",
          ],
        },
        {
          title: "Privacidade",
          body: [
            "Como o Chartify envolve perfis, interações e preferências musicais, levamos privacidade a sério. Mantemos páginas dedicadas para explicar termos, coleta de dados, cookies e formas de contato.",
          ],
        },
      ]}
    />
  );
}
