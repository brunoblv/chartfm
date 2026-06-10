export type ReleaseTag = "novo" | "melhoria" | "fix" | "design";

export type ReleaseEntry = {
  title: string;
  description: string;
  tag: ReleaseTag;
};

export type Release = {
  date: string;
  label: string;
  entries: ReleaseEntry[];
};

export const RELEASES: Release[] = [
  {
    date: "2026-06-09",
    label: "9 de junho de 2026",
    entries: [
      {
        title: "O que há de novo com categorias",
        tag: "design",
        description:
          "A página 'O que há de novo' ganhou abas para filtrar por categoria: Novas funções, Melhorias, Correções e Design. Cada aba mostra um contador com o total de itens naquela categoria.",
      },
      {
        title: "Atualização do snapshot da Parada Global",
        tag: "melhoria",
        description:
          "A lógica de geração do snapshot semanal da Parada Global foi aprimorada para garantir maior precisão e consistência nos dados históricos. O agendamento também foi revisado para reduzir janelas de inconsistência entre a publicação e o registro.",
      },
    ],
  },
  {
    date: "2026-06-07",
    label: "7 de junho de 2026",
    entries: [
      {
        title: "Lançamentos da Semana",
        tag: "novo",
        description:
          "O CriticsFM ganhou uma seção dedicada aos lançamentos musicais da semana. Um banner na página principal destaca os álbuns selecionados, e em /criticsfm/lancamentos você pode ouvir, avaliar rapidamente e acessar o Spotify de cada um. O histórico de semanas anteriores fica disponível em Lançamentos → Histórico.",
      },
      {
        title: "Pontuação da segunda parada ajustada",
        tag: "melhoria",
        description:
          "A pontuação máxima por posição na segunda parada foi reduzida de 20 para 10 pontos, alinhando melhor o peso dela em relação à parada principal. Textos e cálculos em todo o site foram atualizados para refletir a nova regra.",
      },
    ],
  },
  {
    date: "2026-06-02",
    label: "2 de junho de 2026",
    entries: [
      {
        title: "Site em inglês",
        tag: "novo",
        description:
          "O ChartFM agora está disponível em português e inglês. Use o seletor de idioma na barra lateral ou nas configurações para alternar — a preferência é salva no navegador e aplicada em todas as páginas, incluindo metadados e textos da interface.",
      },
    ],
  },
  {
    date: "2026-05-30",
    label: "30 de maio de 2026",
    entries: [
      {
        title: "Clube do Álbum",
        tag: "novo",
        description:
          "Uma rodada semanal de descoberta coletiva de álbuns no CriticsFM. A cada semana há um tema: os participantes indicam álbuns, votam na enquete e, depois do resultado, entram num período de escuta para avaliar o vencedor. Acesse em /criticsfm/clube; o histórico de rodadas anteriores fica em Clube → Histórico.",
      },
      {
        title: "Nova home do CriticsFM",
        tag: "design",
        description:
          "A página do CriticsFM foi reorganizada com seções mais claras: Top Álbuns (melhores notas da comunidade), banner do Clube do Álbum, Lançamentos da Semana e link dedicado para todas as reviews. Álbuns precisam de pelo menos duas avaliações para aparecer no catálogo.",
      },
    ],
  },
  {
    date: "2026-05-28",
    label: "28 de maio de 2026",
    entries: [
      {
        title: "Vídeo clipe nas páginas de música",
        tag: "novo",
        description:
          "Cada página de música ganhou a aba Vídeo Clipe. Você pode enviar uma captura do clipe, votar nas opções da comunidade e escolher qual aparece no topo da página e nas paradas no modo Vídeo Clipe. O clipe mais votado é usado como padrão quando ninguém fez uma escolha pessoal.",
      },
      {
        title: "Filtro por ano no perfil",
        tag: "novo",
        description:
          "Na aba Estatísticas do perfil, agora dá para alternar entre visão geral e um ano específico. Artistas e músicas mais presentes são recalculados com base apenas nas paradas daquele ano, facilitando revisitar temporadas passadas.",
      },
      {
        title: "Menu de perfil no celular",
        tag: "novo",
        description:
          "A barra de navegação inferior no mobile agora abre um menu ao tocar em Perfil, com atalho para a sua página e botão de sair da conta — sem precisar ir até as configurações.",
      },
      {
        title: "Layout mobile das paradas",
        tag: "design",
        description:
          "As visualizações Lista e Vídeo Clipe das paradas foram refinadas para telas pequenas: capas com tamanho consistente, badges de #1 pessoal e global nas entradas, e melhor uso do espaço vertical no modo clipe.",
      },
      {
        title: "Compressão automática de imagens",
        tag: "melhoria",
        description:
          "Uploads de logo da parada e capturas de vídeo clipe agora são comprimidos automaticamente antes do envio, reduzindo o tamanho do arquivo sem perder qualidade visível e acelerando o carregamento.",
      },
    ],
  },
  {
    date: "2026-05-26",
    label: "26 de maio de 2026",
    entries: [
      {
        title: "Segunda parada",
        tag: "novo",
        description:
          "Agora é possível ter até 2 paradas no ChartFM. A segunda parada pode ser criada nas configurações, na aba Parada. Ela funciona de forma independente — com nome, tamanho e gêneros próprios — mas conta menos pontos e não entra no ranking da Parada Global.",
      },
      {
        title: "Aba Saídas na Parada Global",
        tag: "novo",
        description:
          "A Parada Global ganhou uma terceira aba: Saídas. Ela lista todas as músicas que estavam no top 100 na semana passada e não aparecem mais esta semana, com a posição que ocupavam e um badge de destaque.",
      },
      {
        title: "Aba Saídas na parada pessoal",
        tag: "novo",
        description:
          "A página de cada parada pessoal também ganhou a aba Saídas, mostrando as músicas que caíram da lista desde a última publicação — com quantas semanas ficaram e a posição de pico que alcançaram.",
      },
      {
        title: "Respostas nos comentários",
        tag: "novo",
        description:
          "Agora é possível responder diretamente a um comentário na página da parada. Cada comentário exibe o número de respostas e um botão para expandir ou escrever uma reply, mantendo a conversa organizada por tópico.",
      },
    ],
  },
  {
    date: "2026-05-22",
    label: "22 de maio de 2026",
    entries: [
      {
        title: "CriticsFM adaptado para celular",
        tag: "design",
        description:
          "A página do CriticsFM agora funciona melhor em telas pequenas: busca e filtros ficam empilhados verticalmente, o campo de busca ocupa toda a largura, o botão de adicionar álbum fica ao lado do seletor de ordenação e a grade de álbuns passa a duas colunas no mobile. O painel de busca no Spotify também ganhou espaçamento correto em telas pequenas.",
      },
      {
        title: "Parada Global sempre atualizada",
        tag: "fix",
        description:
          "Corrigido um problema em que a Parada Global podia exibir dados em cache por até 1 hora. Agora os dados são sempre buscados em tempo real, garantindo que você veja as músicas mais recentes.",
      },
      {
        title: "Botão Limpar lista na criação e edição de paradas",
        tag: "novo",
        description:
          "Na página de criar e editar parada, um novo botão Limpar lista permite apagar todas as entradas de uma vez. O botão só aparece quando há pelo menos uma música na lista.",
      },
    ],
  },
  {
    date: "2026-05-17",
    label: "17 de maio de 2026",
    entries: [
      {
        title: "Modo Noturno",
        tag: "novo",
        description:
          "O ChartFM agora tem suporte a tema claro e escuro. O botão de alternância fica na barra lateral e o site respeita automaticamente a preferência do seu sistema operacional. A escolha é salva localmente e aplicada sem piscar ao carregar a página.",
      },
    ],
  },
  {
    date: "2026-05-15",
    label: "15 de maio de 2026",
    entries: [
      {
        title: "Feed com abas Amigos, Todos, Reviews e Notícias",
        tag: "novo",
        description:
          "A tela inicial agora tem quatro abas no feed: Amigos (paradas de quem você segue), Todos (paradas de todos os usuários), Reviews (últimas avaliações de álbuns da semana) e Notícias (novidades da plataforma).",
      },
      {
        title: "Parada Global e de Comunidade atualizam na terça às 6h",
        tag: "melhoria",
        description:
          "O horário de corte das paradas oficiais (Global 100 e comunidades) foi alterado para toda terça-feira às 6h da manhã (horário de Brasília), dando mais tempo para as submissões da semana anterior serem contabilizadas.",
      },
      {
        title: "Notificação quando a Parada Global é publicada",
        tag: "novo",
        description:
          "Toda vez que a Parada Global é atualizada com os resultados da semana, todos os usuários recebem uma notificação com link direto para a parada.",
      },
    ],
  },
  {
    date: "2026-05-12",
    label: "12 de maio de 2026",
    entries: [
      {
        title: "CriticsFM — avalie e descubra álbuns",
        tag: "novo",
        description:
          "Uma nova seção do site dedicada a álbuns. Você pode explorar o catálogo, ver a nota média de cada álbum com base nas avaliações dos usuários, escrever sua própria review e marcar reviews de outros como úteis. Acesse pelo menu lateral ou em /criticsfm.",
      },
      {
        title: "Reviews de álbuns no feed da tela inicial",
        tag: "novo",
        description:
          'A tela inicial ganhou uma segunda aba "Reviews" ao lado de "Paradas". Ela exibe as avaliações de álbuns mais recentes dos usuários do site, com nota, capa e trecho do texto — tudo sem sair da home.',
      },
      {
        title: "Logo e nome da parada aparecem no card",
        tag: "melhoria",
        description:
          'Os cards de parada no feed agora exibem o logo personalizado (quando definido) e o nome da parada em vez do genérico "Top X". O logo também aparece no cabeçalho do card ao lado do avatar do usuário.',
      },
      {
        title: "Redes sociais no perfil",
        tag: "novo",
        description:
          "Agora você pode vincular suas contas do X (Twitter) e Instagram ao seu perfil. Os links aparecem na página pública do perfil ao lado do Last.fm. Para adicionar, vá em Configurações → Perfil.",
      },
    ],
  },
  {
    date: "2026-05-11",
    label: "11 de maio de 2026",
    entries: [
      {
        title: "Upload de foto de perfil",
        tag: "novo",
        description:
          "Agora você pode adicionar ou trocar sua foto de perfil diretamente nas configurações, na aba Perfil. Aceita JPG, PNG e WebP até 5 MB. A foto substitui o avatar com as iniciais e aparece em todo o site.",
      },
      {
        title: "Logo personalizado da parada",
        tag: "novo",
        description:
          "A nova aba Parada nas configurações permite que você faça upload de um logo exclusivo para a sua parada. Quando definido, o logo aparece no lugar do mosaico das 4 capas na página de detalhes — tanto no desktop quanto no mobile. Se nenhum logo for enviado, o comportamento atual (4 capas em grade) é mantido.",
      },
      {
        title: 'Nova aba "Parada" nas configurações',
        tag: "design",
        description:
          "As configurações da parada (nome, tamanho e gêneros) foram agrupadas em uma aba dedicada, deixando a aba Perfil mais focada nos dados pessoais. O upload do logo também fica aqui.",
      },
    ],
  },
];

export const TAG_META: Record<ReleaseTag, { label: string; bg: string; color: string }> = {
  novo:     { label: "Novo",      bg: "rgba(34,197,94,0.1)",  color: "#16a34a" },
  melhoria: { label: "Melhoria",  bg: "rgba(59,130,246,0.1)", color: "#2563eb" },
  fix:      { label: "Fix",       bg: "rgba(245,158,11,0.1)", color: "#d97706" },
  design:   { label: "Design",    bg: "rgba(168,85,247,0.1)", color: "#9333ea" },
};
