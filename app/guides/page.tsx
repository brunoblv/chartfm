import type { Metadata } from "next";
import {
  BarChart2,
  Calendar,
  Lock,
  Music,
  Search,
  Users,
} from "lucide-react";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalIconCard,
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Guias | ChartFM",
  description:
    "Aprenda a usar o ChartFM: criar paradas, seguir usuários, entender o feed e os rankings globais.",
  alternates: { canonical: "/guides" },
};

const GUIDES = [
  {
    icon: <Music size={20} />,
    title: "Como criar sua primeira parada",
    body: 'Clique em "Nova parada" no menu lateral ou na tela inicial. Dê um nome à sua parada, escolha um período e comece a adicionar músicas. Você pode adicionar até 100 faixas por parada.',
    href: "/guides/como-criar-sua-parada",
  },
  {
    icon: <Calendar size={20} />,
    title: "Paradas semanais e temporadas",
    body: "Cada parada está ligada a uma semana específica. Ao publicar, ela entra automaticamente na semana atual. Você pode criar paradas para semanas passadas como registro histórico.",
  },
  {
    icon: <Users size={20} />,
    title: "Seguir outros usuários",
    body: "Busque usuários pelo nome ou pelo @handle deles. Ao seguir alguém, as paradas que essa pessoa publicar aparecem no seu feed. Você pode deixar de seguir a qualquer momento.",
  },
  {
    icon: <Search size={20} />,
    title: "Como funciona o feed",
    body: "O feed mostra as paradas e atividades de quem você segue, ordenadas por data. Use as abas para filtrar por tipo de conteúdo: paradas, reviews ou indicações.",
  },
  {
    icon: <BarChart2 size={20} />,
    title: "Pontuação e rankings globais",
    body: "Cada vez que uma música aparece em uma parada publicada, ela acumula pontos no ranking global. Quanto mais alta a posição na parada, mais pontos. Os rankings são atualizados toda segunda-feira.",
    href: "/guides/como-funciona-o-global-100",
  },
  {
    icon: <Lock size={20} />,
    title: "Privacidade da conta",
    body: "Por padrão, seu perfil e suas paradas são visíveis para todos. Você pode tornar sua conta privada nas configurações — assim, apenas pessoas que você aprovar poderão ver seu conteúdo.",
  },
];

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
          Não encontrou o que procurava? Envie sua dúvida pela página{" "}
          <InstitutionalInlineLink href="/contact">Contato</InstitutionalInlineLink> e respondemos em até 2 dias úteis.
        </InstitutionalMutedCallout>
      </div>
    </InstitutionalLayout>
  );
}
