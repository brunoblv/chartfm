import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalIconCard,
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { GUIDES } from "@/lib/content/helpContent";

export const metadata: Metadata = {
  title: "Guias | ChartFM",
  description:
    "Aprenda a usar o ChartFM: criar paradas, seguir usuários, entender o feed e os rankings globais.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle="Aprenda a usar o ChartFM do zero ou tire dúvidas específicas.">
        Guias
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {GUIDES.map((guide) => (
          <InstitutionalIconCard
            key={guide.title}
            icon={guide.icon}
            title={guide.title}
            description={guide.body}
            href={guide.href}
          />
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <InstitutionalMutedCallout>
          Não encontrou o que procurava? Veja também as{" "}
          <InstitutionalInlineLink href="/faq">Perguntas frequentes</InstitutionalInlineLink> ou envie sua dúvida pela
          página <InstitutionalInlineLink href="/contact">Contato</InstitutionalInlineLink> - respondemos em até 2 dias
          úteis.
        </InstitutionalMutedCallout>
      </div>
    </InstitutionalLayout>
  );
}
