import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { FAQ_ITEMS } from "@/lib/content/helpContent";

export const metadata: Metadata = {
  title: "Perguntas frequentes | ChartFM",
  description:
    "Respostas para as dúvidas mais comuns sobre o ChartFM: paradas, pontuação do Global 100, Copa, privacidade, comunidades e suporte.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle="Respostas para as dúvidas mais comuns sobre o ChartFM.">
        Perguntas frequentes
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {FAQ_ITEMS.map((item, index) => (
          <div key={item.question} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {index > 0 && <InstitutionalDivider />}
            <InstitutionalSection title={item.question}>
              <InstitutionalParagraph>{item.answer}</InstitutionalParagraph>
            </InstitutionalSection>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <InstitutionalMutedCallout>
          Não encontrou o que procurava? Veja os{" "}
          <InstitutionalInlineLink href="/guides">Guias</InstitutionalInlineLink> ou fale com a gente pela página{" "}
          <InstitutionalInlineLink href="/contact">Contato</InstitutionalInlineLink>.
        </InstitutionalMutedCallout>
      </div>
    </InstitutionalLayout>
  );
}
