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

export const GUIDES = [
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

// question/answer vivem no catálogo i18n (namespace "faq"); aqui só ficam as chaves.
export const FAQ_ITEMS: { questionKey: string; answerKey: string }[] = [
  { questionKey: "faq.q1", answerKey: "faq.a1" },
  { questionKey: "faq.q2", answerKey: "faq.a2" },
  { questionKey: "faq.q3", answerKey: "faq.a3" },
  { questionKey: "faq.q4", answerKey: "faq.a4" },
  { questionKey: "faq.q5", answerKey: "faq.a5" },
  { questionKey: "faq.q6", answerKey: "faq.a6" },
  { questionKey: "faq.q7", answerKey: "faq.a7" },
  { questionKey: "faq.q8", answerKey: "faq.a8" },
  { questionKey: "faq.q9", answerKey: "faq.a9" },
  { questionKey: "faq.q10", answerKey: "faq.a10" },
  { questionKey: "faq.q11", answerKey: "faq.a11" },
  { questionKey: "faq.q12", answerKey: "faq.a12" },
];
