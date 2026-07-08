export type EditorialPickCategory =
  | "video"
  | "clipe"
  | "playlist"
  | "album"
  | "artista"
  | "editorial";

export type EditorialPick = {
  slug: string;
  title: string;
  subtitle?: string;
  category: EditorialPickCategory;
  publishedAt: string;
  author: string;
  excerpt: string;
  paragraphs: string[];
  youtubeUrl?: string;
  spotifyUrl?: string;
  previewImage?: string;
  tags?: string[];
  relatedLinks?: { label: string; href: string }[];
};

export const EDITORIAL_PICKS: EditorialPick[] = [
  {
    slug: "playlist-global-100-da-semana",
    title: "Playlist Global 100 da semana",
    subtitle: "As 100 faixas mais votadas pela comunidade, em ordem de ranking",
    category: "playlist",
    publishedAt: "2026-07-01",
    author: "Equipe ChartFM",
    excerpt:
      "Toda terça-feira publicamos a playlist oficial do Global 100 no Spotify — as músicas que a comunidade mais colocou nas paradas pessoais, ranqueadas por pontos acumulados.",
    spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    tags: ["Global 100", "Spotify", "playlist"],
    relatedLinks: [
      { label: "Ver o Global 100 completo", href: "/global/100" },
      { label: "Arquivo de semanas anteriores", href: "/global/100/arquivo" },
    ],
    paragraphs: [
      "O Global 100 é o ranking semanal do ChartFM: cada música que aparece em uma parada publicada acumula pontos conforme a posição — quanto mais alta na lista de um usuário, mais pontos ela ganha. Na terça-feira à meia-noite (horário de Brasília), a semana fecha e a nova parada é publicada.",
      "A playlist no Spotify reproduz exatamente essa ordem. Não é uma seleção editorial separada: é o reflexo direto do que milhares de paradas pessoais disseram naquela semana. Se uma faixa subiu dez posições no ranking, ela sobe na playlist também.",
      "Para quem quer ouvir o recorte da semana sem abrir faixa por faixa no site, a playlist é o atalho mais prático. Funciona bem como trilha de descoberta — muitas estreias e retornos aparecem antes de viralizar em outras plataformas, porque aqui o voto é intencional: o usuário escolheu colocar aquela música na parada dele.",
      "Atualizamos a playlist sempre que a semana fecha. O nome segue o padrão ChartFM · Global 100 · [intervalo da semana]. Você pode seguir a conta no Spotify para receber a nova edição no feed toda terça.",
      "Se quiser entender como os pontos são calculados — tabela de posição, bônus de estreia, diferença entre paradas pessoais e comunidades — temos um guia dedicado. O importante para esta playlist é: o que você ouve aqui é o que a comunidade votou, sem filtro algorítmico por trás.",
    ],
  },
  {
    slug: "video-como-funciona-o-global-100",
    title: "Como funciona o Global 100",
    subtitle: "Texto explicativo da equipe sobre pontuação, fechamento semanal e estreias",
    category: "editorial",
    publishedAt: "2026-06-20",
    author: "Equipe ChartFM",
    excerpt:
      "Neste artigo explicamos do zero como uma parada pessoal vira ponto no ranking global, o que significa estreia e retorno, e por que o fechamento acontece toda terça.",
    tags: ["Global 100", "guia"],
    relatedLinks: [
      { label: "Guia escrito: Como funciona o Global 100", href: "/guides/como-funciona-o-global-100" },
      { label: "Glossário do ChartFM", href: "/guides/glossario" },
    ],
    paragraphs: [
      "Muita gente chega ao ChartFM pelo Global 100 e só depois descobre que o ranking nasce das paradas que usuários publicam. Este texto foi escrito pela equipe para fechar essa lacuna: em poucas seções você entende o fluxo completo, da criação da parada ao snapshot da terça-feira.",
      "Mostramos como funciona a tela de criar parada, como adicionar até cem faixas, publicar para a semana atual e o que acontece quando a semana fecha. Também explicamos os badges de movimento — subida, queda, estreia, retorno e posição estável — que aparecem no site e nos materiais que publicamos no canal do YouTube.",
      "A pontuação não é mistério: cada posição na parada tem um peso fixo. Uma música no #1 vale mais que uma no #50. Quando a mesma faixa aparece em paradas de usuários diferentes, os pontos se somam. Por isso o Global 100 é um consenso distribuído, não um voto único de um júri.",
      "Se preferir ler em vez de assistir, o guia escrito no site cobre os mesmos tópicos com exemplos numéricos. Quando publicarmos um vídeo explicativo no canal @chartFM, ele será incorporado aqui também.",
    ],
  },
  {
    slug: "clipe-good-luck-babe-chappell-roan",
    title: "Por que a comunidade não largou “Good Luck, Babe!”",
    subtitle: "Clipe oficial e contexto da faixa mais persistente do pop alternativo no ranking",
    category: "clipe",
    publishedAt: "2026-06-12",
    author: "Equipe ChartFM",
    excerpt:
      "Chappell Roan domina paradas de pop alternativo no ChartFM há meses. Revisitamos o clipe oficial e o que os dados da plataforma dizem sobre a permanência da faixa.",
    youtubeUrl: "https://www.youtube.com/watch?v=1RKq0gbFsuY",
    spotifyUrl: "https://open.spotify.com/track/5vNRhkKd0y0N5hJIPjFNDU",
    tags: ["Chappell Roan", "clipe", "pop"],
    relatedLinks: [
      { label: "Página da música no ChartFM", href: "/song/good-luck-babe-chappell-roan" },
      { label: "Discover — artistas em alta", href: "/discover" },
    ],
    paragraphs: [
      "“Good Luck, Babe!” entrou no ChartFM como estreia e rapidamente virou presença fixa no topo do Global 100 e em paradas temáticas de pop alternativo. Não é surpresa para quem acompanha a artista desde The Rise and Fall of a Midwest Princess, mas o volume de paradas pessoais que ainda incluem a faixa meses depois do lançamento chama atenção.",
      "O clipe oficial reforça o tom teatral e irônico que define Chappell Roan: referências visuais ao glamour dos anos 2000, coreografia exagerada e uma narrativa de desilusão romântica que conversa direto com o público que monta paradas emotivas no fim de semana.",
      "No ChartFM, a música acumula pontos de forma consistente porque aparece em listas variadas — não só no #1, mas espalhada entre as dez primeiras posições de centenas de usuários. Isso indica escuta repetida e identificação, não apenas hype de primeira semana.",
      "Se você ainda não viu o clipe ou quer reassistir com esse contexto, o embed acima é o vídeo oficial no YouTube. No Spotify, a faixa faz parte do álbum completo; muitos usuários do CriticsFM avaliaram o disco com notas altas no mesmo período em que a single liderava paradas.",
      "Para descobrir outras artistas com trajetória parecida no ranking — estreias que viraram permanência — vale explorar o Discover e filtrar por movimento de subida nas últimas semanas.",
    ],
  },
  {
    slug: "copa-chartfm-playlists-do-dia",
    title: "Playlists do dia na Copa ChartFM",
    subtitle: "Spotify e YouTube sincronizados com os confrontos de cada rodada",
    category: "playlist",
    publishedAt: "2026-05-28",
    author: "Equipe ChartFM",
    excerpt:
      "A cada rodada da Copa ChartFM publicamos playlists com as faixas dos artistas em jogo — no Spotify e no YouTube — para ouvir antes de votar.",
    spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
    tags: ["Copa ChartFM", "playlist", "comunidade"],
    relatedLinks: [
      { label: "Copa ChartFM — página principal", href: "/copa" },
      { label: "Guia: Como funciona a Copa", href: "/guides/como-funciona-a-copa" },
    ],
    paragraphs: [
      "A Copa ChartFM é um torneio comunitário: 64 artistas, fase de grupos e mata-mata, com votação aberta a todos os usuários. Cada confronto coloca duas discografias (ou carreiras) frente a frente, e a comunidade decide quem avança.",
      "Para ajudar quem não conhece um dos lados do duelo, a equipe monta playlists do dia com faixas representativas dos artistas em jogo. Elas são publicadas no Spotify e replicadas no canal YouTube @chartFM, sempre com o nome da rodada e a data no título.",
      "As playlists não substituem o voto informado — são material de apoio. Muitos usuários ouvem os dois lados, consultam paradas antigas dos artistas no ChartFM e só então votam. O histórico de #1s e pontos acumulados na plataforma costuma pesar na discussão nos comentários ao vivo.",
      "Se você perdeu uma rodada, o arquivo de confrontos no site mantém o resultado e, quando disponível, o link da playlist daquele dia. Na página ao vivo, o card do jogo atual destaca o duelo e atalhos para votar.",
      "A Copa acontece em temporadas; entre uma edição e outra, as playlists antigas continuam acessíveis como registro do que estava em destaque na comunidade naquele período.",
    ],
  },
  {
    slug: "artista-em-alta-sabrina-carpenter",
    title: "Sabrina Carpenter e o efeito “Espresso” nas paradas",
    subtitle: "Indicação editorial: por que a artista explodiu em paradas de pop no primeiro semestre de 2026",
    category: "artista",
    publishedAt: "2026-05-15",
    author: "Equipe ChartFM",
    excerpt:
      "“Espresso” e o álbum Short n’ Sweet dominaram paradas de pop no ChartFM. Texto da equipe sobre a ascensão e onde ouvir.",
    spotifyUrl: "https://open.spotify.com/track/2HRqTpkrJO5ggH2aKsfK3f",
    youtubeUrl: "https://www.youtube.com/watch?v=eVli-tstM5E",
    tags: ["Sabrina Carpenter", "pop", "artista"],
    relatedLinks: [
      { label: "Página do artista", href: "/artist/Sabrina%20Carpenter" },
      { label: "CriticsFM — avaliações de álbuns", href: "/criticsfm" },
    ],
    paragraphs: [
      "Sabrina Carpenter entrou em 2026 como uma das artistas mais votadas em paradas de pop no ChartFM. O catalisador foi “Espresso”, single que viralizou em paralelo em outras redes e trouxe novos usuários para publicar suas primeiras paradas na plataforma.",
      "O padrão que vemos nos dados é familiar: estreia no topo, semanas de liderança ou top 3, depois dispersão para outras faixas do álbum Short n’ Sweet — especialmente “Please Please Please” e “Taste”. Usuários que colocaram “Espresso” no #1 costumam manter outras músicas da artista nas posições seguintes.",
      "No CriticsFM, o álbum recebeu dezenas de reviews com média alta nas primeiras semanas pós-lançamento. A combinação de paradas pessoais + críticas da comunidade elevou Sabrina Carpenter entre os nomes femininos com mais pontos acumulados no semestre.",
      "Para quem chegou tarde: o clipe de “Espresso” está acima; no Spotify, recomendamos ouvir o álbum inteiro em ordem — a narrativa de curta duração funciona melhor assim do que só pelos singles.",
      "Artistas com trajetória parecida — estreia forte seguida de profundidade de catálogo nas paradas — aparecem toda semana no Discover. Vale seguir curadores que votam pesado em pop para ver o que vem depois.",
    ],
  },
  {
    slug: "album-clube-do-mes-kendrick",
    title: "Clube do Álbum: “GNX” no CriticsFM",
    subtitle: "Leitura longa da equipe sobre o disco mais debatido do rap no ranking",
    category: "album",
    publishedAt: "2026-04-22",
    author: "Equipe ChartFM",
    excerpt:
      "O Clube do Álbum do CriticsFM escolheu GNX para discussão mensal. Resumo editorial do debate, notas da comunidade e faixas que entraram nas paradas.",
    spotifyUrl: "https://open.spotify.com/album/5I2ZOer1t5t7RbPVtnSEru",
    tags: ["CriticsFM", "rap", "álbum"],
    relatedLinks: [
      { label: "CriticsFM — Clube do Álbum", href: "/criticsfm" },
      { label: "Guia: Como avaliar álbuns", href: "/guides/como-avaliar-albuns" },
    ],
    paragraphs: [
      "O Clube do Álbum é uma iniciativa do CriticsFM: a cada mês, a comunidade vota um disco para ler, ouvir e avaliar em conjunto. Em abril de 2026, GNX foi o escolhido — e gerou um dos maiores volumes de reviews do ano na plataforma.",
      "As notas se distribuíram de forma ampla, como esperado para um álbum com muitas faixas curtas e transições abruptas. O que uniu os reviews mais citados foi a leitura de GNX como resposta direta ao momento da carreira de Kendrick Lamar pós-conflictos públicos e pós-Pulitzer: agressivo, irônico, às vezes desconexo de propósito.",
      "No ChartFM de paradas pessoais, faixas individuais do álbum entraram em listas de rap e até em paradas gerais, mas sem a dominância de um único single — comportamento diferente de álbuns pop com uma música arrastando todo o resto.",
      "Para a discussão do clube, publicamos playlist com a ordem de faixas do álbum no Spotify (embed acima). A recomendação editorial da equipe: ouvir de uma vez, sem pular, e depois reler os reviews com maior engajamento no CriticsFM — muitos citam detalhes de produção que só aparecem na segunda escuta.",
      "Se quiser participar do próximo ciclo, basta ter conta no ChartFM, avaliar álbuns no CriticsFM e acompanhar o anúncio do disco vencedor na aba Clube do Álbum.",
    ],
  },
  {
    slug: "push-playlist-oficial",
    title: "Push: a playlist de cada rodada",
    subtitle: "Como funciona a trilha sonora do jogo musical semanal da comunidade",
    category: "playlist",
    publishedAt: "2026-04-10",
    author: "Equipe ChartFM",
    excerpt:
      "No Push, usuários indicam músicas, votam e a playlist oficial é montada no Spotify ao fim de cada fase. Entenda o fluxo e ouça a edição mais recente.",
    spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX4JAvH4ip6xs",
    tags: ["Push", "Spotify", "jogo"],
    relatedLinks: [
      { label: "Push — página principal", href: "/push" },
      { label: "Histórico de rodadas", href: "/push/historico" },
    ],
    paragraphs: [
      "O Push é um jogo semanal do ChartFM: a cada rodada abre um tema ou mecânica diferente, os participantes enviam indicações, votam nas favoritas e o ranking define quais faixas entram na playlist oficial.",
      "Diferente do Global 100 — que reflete todas as paradas publicadas — o Push é deliberadamente competitivo e com prazo. As indicações fecham, os votos contam e só as faixas classificadas vão para o Spotify. É um recorte mais curadoria + jogo do que consenso amplo.",
      "A playlist é sincronizada automaticamente quando a fase de votação encerra. O título inclui o nome da rodada e a data. No histórico do Push você encontra edições anteriores e pode comparar como os gostos da comunidade mudaram entre rodadas.",
      "Muitos usuários usam o Push para descobrir música fora do próprio bolha: como cada um só pode indicar um número limitado de faixas, aparecem artistas que não estariam no topo do Global 100 na mesma semana.",
      "Se nunca participou, crie uma conta, entre na rodada aberta e envie sua indicação antes do prazo. Mesmo sem ganhar o voto, sua faixa fica registrada no perfil como participação — e você vota nas dos outros.",
    ],
  },
  {
    slug: "editorial-paradas-pessoais-cultura",
    title: "Por que paradas pessoais ainda importam em 2026",
    subtitle: "Texto de abertura da série editorial ChartFM sobre cultura de ranking",
    category: "editorial",
    publishedAt: "2026-03-01",
    author: "Equipe ChartFM",
    excerpt:
      "Streaming mediu reprodução passiva; paradas medem intenção. A equipe ChartFM escreve sobre o que muda quando você ordena suas músicas da semana em público.",
    tags: ["editorial", "cultura", "paradas"],
    relatedLinks: [
      { label: "Criar sua primeira parada", href: "/guides/como-criar-sua-parada" },
      { label: "Sobre o ChartFM", href: "/about" },
    ],
    paragraphs: [
      "Durante décadas, paradas musicais foram símbolo de indústria: rádio, vendas físicas, depois streaming. O ChartFM propõe outra coisa — paradas pessoais publicadas por fãs, somadas em rankings coletivos. Não é reprodução passiva; é declaração de gosto.",
      "Quando você publica uma parada semanal, está dizendo: nesta ordem, estas foram as músicas que mais significaram para mim nos últimos dias. Essa ordem importa. O #1 não é equivalente ao #20. Por isso a pontuação do Global 100 usa pesos por posição, e não apenas contagem de aparições.",
      "A cultura de paradas pessoais existia antes em fóruns, blogs e planilhas privadas. O ChartFM centraliza isso em um lugar com histórico, perfil público, comunidades e jogos (Copa, Push). O editorial que você lê nesta seção é a camada da equipe por cima desses dados — indicações de vídeos, playlists e leituras que complementam o que a comunidade já vota.",
      "Nesta série vamos publicar textos sobre movimentos do ranking, clipes que a comunidade não largou, álbuns em debate no CriticsFM e bastidores de como montamos playlists oficiais. Tudo público, sem login, para quem quer entender o ChartFM antes de criar conta — ou para quem já publica parada todo domingo e quer contexto extra.",
      "Se este é seu primeiro contato, comece criando uma parada de teste ou explore o Global 100 da semana. A diferença entre ouvir um algoritmo e ler uma parada de outra pessoa é a mesma diferença entre recomendação e conversa.",
    ],
  },
];

export const EDITORIAL_CATEGORY_LABELS: Record<EditorialPickCategory, string> = {
  video: "Vídeo",
  clipe: "Clipe",
  playlist: "Playlist",
  album: "Álbum",
  artista: "Artista",
  editorial: "Editorial",
};
