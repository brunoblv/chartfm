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

export const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "O que é o ChartFM?",
    answer:
      "O ChartFM é uma rede social para quem gosta de música e quer organizar o que está ouvindo. Cada usuário monta paradas semanais pessoais com as músicas que mais marcaram a semana, e a soma de todas as paradas publicadas forma o Global 100, o ranking coletivo da comunidade.",
  },
  {
    question: "Como eu crio minha primeira parada?",
    answer:
      "Clique em 'Criar Chart' no menu lateral ou acesse a página /create. Busque as músicas pelo nome da faixa ou do artista, adicione até 100 delas à sua lista, defina a ordem das posições e publique. O passo a passo completo está no guia Como criar sua parada semanal.",
  },
  {
    question: "Preciso pagar para usar o ChartFM?",
    answer:
      "Não. Criar conta, publicar paradas, seguir outros usuários e participar de comunidades e da Copa não têm custo no ChartFM.",
  },
  {
    question: "Como funciona a pontuação do Global 100?",
    answer:
      "Cada posição da sua parada pessoal vale pontos para o Global 100, numa curva geométrica: a 1ª posição vale 1.000 pontos e cada posição seguinte vale 95% da posição anterior. Os pontos de todas as paradas publicadas na semana são somados por música para formar o ranking. A fórmula completa e a tabela de posição por pontos estão no guia Como funciona a pontuação.",
  },
  {
    question: "Posso editar uma parada depois de publicada?",
    answer:
      "Sim. Mas a semana do Global 100 fecha toda segunda-feira às 17:00 (horário de Brasília) e o snapshot daquela semana é processado poucas horas depois. Depois que o snapshot é gerado, ele fica congelado, edições feitas após o fechamento não mudam mais o histórico da semana já fechada.",
  },
  {
    question: "Minha parada pode ter qualquer gênero musical?",
    answer:
      "Sim. Não existe restrição de gênero, época ou idioma nas paradas pessoais. Você pode misturar estilos livremente (de sertanejo a K-pop na mesma lista) porque cada usuário decide sozinho o que entra na própria parada.",
  },
  {
    question: "O que é a Copa do ChartFM?",
    answer:
      "A Copa é o torneio eliminatório entre artistas do ChartFM, disputado em formato de chaveamento e movido a votos da comunidade em cada confronto, uma competição paralela ao Global 100. As regras completas, com grupos, fases e critérios de desempate, estão em /copa/regras.",
  },
  {
    question: "Como faço para importar meu histórico do Last.fm ou Spotify?",
    answer:
      "Na tela de criação de parada (/create), use o botão de importação do Last.fm ou do Spotify para preencher sua lista automaticamente com as músicas mais ouvidas nessas contas. Antes de importar, é preciso ter um usuário do Last.fm configurado em /settings ou ter conectado sua conta Spotify. A importação só preenche a lista, você ainda revisa e publica manualmente. O passo a passo está no guia Como importar seu histórico do Last.fm ou Spotify.",
  },
  {
    question: "Minhas paradas ficam públicas para todo mundo?",
    answer:
      "Por padrão, sim: seu perfil e suas paradas ficam visíveis para qualquer pessoa no ChartFM. Se preferir mais privacidade, você pode tornar sua conta privada nas configurações, a partir daí, só quem você aprovar consegue ver seu conteúdo.",
  },
  {
    question: "Como funcionam as comunidades?",
    answer:
      "Comunidades são grupos temáticos onde usuários com gostos parecidos se reúnem. Cada comunidade tem seu próprio feed e sua própria parada coletiva, formada automaticamente pela soma das paradas pessoais dos membros naquela semana. Você pode participar de quantas comunidades quiser, e qualquer usuário pode criar uma nova comunidade.",
  },
  {
    question: "Existe um limite de quantas paradas posso publicar por semana?",
    answer:
      "Sim, uma parada semanal por período: o sistema bloqueia uma segunda publicação para a mesma semana ('Você já publicou esta parada nesta semana'). A semana fecha toda terça-feira à meia-noite (horário de Brasília). Também é possível criar a parada de uma semana passada, como registro histórico.",
  },
  {
    question: "Como entro em contato com o suporte?",
    answer:
      "Pela página /support, onde você pode abrir tickets de bugs e sugestões diretamente para a equipe do ChartFM. Para parcerias, imprensa ou dúvidas gerais, use a página /contact.",
  },
];
