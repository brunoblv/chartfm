import type { Metadata } from "next";
import {
  BarChart2,
  BookOpen,
  Calculator,
  Calendar,
  Compass,
  Download,
  Lock,
  Music,
  Search,
  Star,
  Trophy,
  Users,
  Users2,
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
    body: "Cada vez que uma música aparece em uma parada publicada, ela acumula pontos no ranking global. Quanto mais alta a posição na parada, mais pontos. Os rankings fecham toda terça-feira à meia-noite (BRT).",
    href: "/guides/como-funciona-o-global-100",
  },
  {
    icon: <Lock size={20} />,
    title: "Privacidade da conta",
    body: "Por padrão, seu perfil e suas paradas são visíveis para todos. Você pode tornar sua conta privada nas configurações, assim, apenas pessoas que você aprovar poderão ver seu conteúdo.",
  },
  {
    icon: <Users2 size={20} />,
    title: "Como participar de comunidades",
    body: "Entre em comunidades com o mesmo gosto musical que o seu, contribua com paradas coletivas e acompanhe o ranking formado só pelos votos dos membros do grupo.",
    href: "/guides/como-participar-de-comunidades",
  },
  {
    icon: <Compass size={20} />,
    title: "Como descobrir músicas",
    body: "Use o Discover para encontrar novos artistas, seguir fãs de música com gosto parecido e explorar paradas por gênero.",
    href: "/guides/como-descobrir-musicas",
  },
  {
    icon: <Star size={20} />,
    title: "Como avaliar álbuns",
    body: "Dê uma nota de 0 a 100 para os álbuns que você ouviu e escreva reviews no CriticsFM, o módulo de críticas musicais do ChartFM.",
    href: "/guides/como-avaliar-albuns",
  },
  {
    icon: <Download size={20} />,
    title: "Importar do Last.fm ou Spotify",
    body: "Conecte sua conta do Last.fm ou Spotify para montar suas paradas a partir do seu histórico real de audições, em vez de adicionar música por música.",
    href: "/guides/como-importar-historico",
  },
  {
    icon: <Trophy size={20} />,
    title: "Como funciona a Copa",
    body: "64 artistas, fase de grupos e mata-mata por votos da comunidade. Veja como participar, votar e acompanhar o chaveamento.",
    href: "/guides/como-funciona-a-copa",
  },
  {
    icon: <Calculator size={20} />,
    title: "Como funciona a pontuação",
    body: "A fórmula completa por trás dos pontos de cada posição, com tabela e exemplos calculados.",
    href: "/guides/como-funciona-a-pontuacao",
  },
  {
    icon: <BookOpen size={20} />,
    title: "Glossário do ChartFM",
    body: "Parada, estreia, retorno, pico, snapshot, Global 100, Copa - o significado de cada termo usado na plataforma.",
    href: "/guides/glossario",
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
          Não encontrou o que procurava? Veja também as{" "}
          <InstitutionalInlineLink href="/faq">Perguntas frequentes</InstitutionalInlineLink> ou envie sua dúvida pela
          página <InstitutionalInlineLink href="/contact">Contato</InstitutionalInlineLink> - respondemos em até 2 dias
          úteis.
        </InstitutionalMutedCallout>
      </div>
    </InstitutionalLayout>
  );
}
