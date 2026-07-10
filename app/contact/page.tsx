import type { Metadata } from "next";
import {
  Briefcase,
  Bug,
  Mail,
  Shield,
} from "lucide-react";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalIconCard,
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Contato | ChartFM",
  description: "Entre em contato com a equipe do ChartFM para suporte, privacidade, parcerias e imprensa.",
  alternates: { canonical: "/contact" },
};

const CONTACT_ITEMS = [
  {
    icon: <Mail size={20} />,
    title: "E-mail geral",
    description: "Para dúvidas sobre a plataforma, sua conta ou qualquer outra questão.",
  },
  {
    icon: <Shield size={20} />,
    title: "Privacidade e dados",
    description:
      "Para solicitações de exclusão de dados, siga as instruções na página de exclusão. Para acesso a informações pessoais ou outras dúvidas sobre privacidade, entre em contato por e-mail.",
    href: "/data-deletion",
  },
  {
    icon: <Bug size={20} />,
    title: "Reportar problema",
    description:
      "Encontrou um erro ou algo não está funcionando como esperado? Nos avise para que possamos corrigir.",
  },
  {
    icon: <Briefcase size={20} />,
    title: "Parcerias e imprensa",
    description: "Para propostas de parceria, cobertura jornalística ou outros assuntos comerciais.",
  },
];

export default function ContactPage() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle="Entre em contato com a equipe do ChartFM.">
        Contato
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
        {CONTACT_ITEMS.map((item) => (
          <InstitutionalIconCard
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
            href={"href" in item ? item.href : undefined}
            email={"href" in item ? undefined : "contato@chartfm.com.br"}
          />
        ))}
      </div>

      <InstitutionalMutedCallout>
        O tempo médio de resposta é de <strong style={{ color: "var(--text)" }}>2 dias úteis</strong>. Para dúvidas
        rápidas, consulte primeiro os <InstitutionalInlineLink href="/guides">Guias</InstitutionalInlineLink> - a
        maioria das perguntas frequentes já está respondida lá.
      </InstitutionalMutedCallout>
    </InstitutionalLayout>
  );
}
