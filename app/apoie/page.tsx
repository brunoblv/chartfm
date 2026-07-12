import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalCallout,
  InstitutionalDivider,
  InstitutionalList,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

const DONATE_URL = "https://mepagaumcafe.com.br/p/chartfm/";

export const metadata: Metadata = {
  title: "Apoie o ChartFM | ChartFM",
  description:
    "Ajude a manter o ChartFM no ar. Apoie o projeto com uma contribuição via Me Pague um Café.",
  alternates: { canonical: "/apoie" },
};

export default function ApoiePage() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle="O ChartFM é mantido de forma independente. Se a plataforma faz parte da sua rotina musical, considere apoiar o projeto.">
        Apoie o ChartFM
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 16,
            padding: "28px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "var(--accent-tint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-subtle)", margin: 0, maxWidth: 480 }}>
            Manter o ChartFM no ar envolve custos de servidor, APIs de música e tempo dedicado a
            construir novas funcionalidades. Qualquer contribuição, do tamanho que for, ajuda
            bastante.
          </p>
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--accent)",
              color: "var(--btn-dark-fg, #fff)",
              fontSize: 15,
              fontWeight: 700,
              padding: "13px 26px",
              borderRadius: 999,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            Me pague um café ☕
          </a>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Você será redirecionado para mepagaumcafe.com.br
          </span>
        </div>

        <InstitutionalDivider />

        <InstitutionalSection title="Para onde vai o apoio">
          <InstitutionalList
            items={[
              "Custos de servidor e infraestrutura da plataforma",
              "APIs de música usadas para buscar faixas, álbuns e artistas",
              "Tempo dedicado à manutenção e a novas funcionalidades",
            ]}
          />
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="Outras formas de ajudar">
          <InstitutionalParagraph>
            Nem todo apoio precisa ser financeiro. Usar o ChartFM com frequência, criar suas
            paradas semanais e indicar a plataforma para outras pessoas que gostam de música
            também faz muita diferença.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalCallout>
          Obrigado por fazer parte do ChartFM. 💛
        </InstitutionalCallout>
      </div>
    </InstitutionalLayout>
  );
}
