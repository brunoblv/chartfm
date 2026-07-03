import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalInlineLink,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Como funciona a pontuação | Guias ChartFM",
  description:
    "A fórmula geométrica por trás dos pontos de cada posição na parada: como é calculada, tabela completa de posição por pontos e exemplos.",
  alternates: { canonical: "/guides/como-funciona-a-pontuacao" },
};

const TOP_POINTS = 1000;
const DECAY_RATIO = 0.95;

function pointsForPosition(position: number): number {
  return Math.round(TOP_POINTS * Math.pow(DECAY_RATIO, position - 1));
}

const TABLE_POSITIONS = [1, 2, 3, 4, 5, 10, 15, 20, 30, 50, 75, 100];

export default function GuideComoFuncionaAPontuacao() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle="A fórmula por trás dos pontos de cada posição na sua parada">
        Como funciona a pontuação
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <InstitutionalSection title="A fórmula">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InstitutionalParagraph>
              Cada posição da sua parada pessoal vale uma quantidade de pontos para o Global 100. A 1ª posição
              sempre vale 1.000 pontos. A partir daí, cada posição seguinte vale 95% dos pontos da posição
              anterior — não um valor fixo a menos, mas uma porcentagem da posição de cima. Isso forma uma
              curva geométrica: os pontos caem rápido logo no início da parada e cada vez mais devagar conforme
              a posição avança.
            </InstitutionalParagraph>
            <InstitutionalParagraph>
              Em fórmula: pontos da posição N = 1.000 × 0,95 elevado a (N − 1), arredondado para o inteiro mais
              próximo. Esse cálculo vale para as 100 posições possíveis em uma parada.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="Tabela de posição por pontos">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InstitutionalParagraph>
              Alguns pontos de referência da curva, da 1ª à 100ª posição:
            </InstitutionalParagraph>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--divider)",
                        color: "var(--text)",
                        fontWeight: 700,
                      }}
                    >
                      Posição
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--divider)",
                        color: "var(--text)",
                        fontWeight: 700,
                      }}
                    >
                      Pontos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE_POSITIONS.map((position) => (
                    <tr key={position}>
                      <td
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--divider)",
                          color: "var(--text-subtle)",
                        }}
                      >
                        {position}ª
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--divider)",
                          color: "var(--text-subtle)",
                        }}
                      >
                        {pointsForPosition(position).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="Exemplos práticos">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InstitutionalParagraph>
              Se uma música aparece na 1ª posição de 3 paradas diferentes na mesma semana, ela soma 3 × 1.000 =
              3.000 pontos para o Global 100 daquela semana.
            </InstitutionalParagraph>
            <InstitutionalParagraph>
              Se uma música aparece na 1ª posição de uma parada e na 10ª posição de outra parada, na mesma
              semana, ela soma 1.000 + 630 = 1.630 pontos.
            </InstitutionalParagraph>
            <InstitutionalParagraph>
              Já uma música que aparece só na 50ª posição de uma única parada soma apenas 81 pontos com essa
              parada — bem menos do que uma música que aparece uma única vez na 1ª posição de qualquer parada.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="Por que essa curva">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InstitutionalParagraph>
              A curva geométrica foi escolhida de propósito: ela premia conviction — estar bem colocado — mais
              do que volume — aparecer em muitas paradas em posições baixas. Uma música na 1ª posição de 5
              paradas diferentes soma 5 × 1.000 = 5.000 pontos.
            </InstitutionalParagraph>
            <InstitutionalParagraph>
              Para uma música na 20ª posição (377 pontos por parada) alcançar essa mesma soma, ela precisaria
              aparecer em pelo menos 14 paradas diferentes (14 × 377 = 5.278). É esse desenho que faz o Global
              100 valorizar mais quem coloca uma música no topo da própria parada do que quem só a menciona em
              posições finais, mesmo que com mais frequência.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>
      </div>

      <div style={{ marginTop: 32 }}>
        <InstitutionalParagraph>
          Veja também: <InstitutionalInlineLink href="/guides/como-funciona-o-global-100">Como funciona o Global 100</InstitutionalInlineLink>
          {" · "}
          <InstitutionalInlineLink href="/guides/glossario">Glossário do ChartFM</InstitutionalInlineLink>
          {" · "}
          <InstitutionalInlineLink href="/guides">Guias</InstitutionalInlineLink>
        </InstitutionalParagraph>
      </div>
    </InstitutionalLayout>
  );
}
