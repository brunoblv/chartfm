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
