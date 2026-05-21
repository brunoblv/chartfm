import type {
  Cover,
  Song,
  User,
  UserWithCharts,
  ChartEntry,
  Chart,
  TimelineItem,
  GlobalChartEntry,
  Artist,
  ArtistSong,
  Community,
  Post,
  PostReply,
  Comment,
  Notification,
} from "./types";
import { buildDateRangeFromDate, buildWeekLabelFromDate } from "./chart-week";

const COVER_PALETTES: [string, string][] = [
  ["#FF6B6B", "#FFE66D"],
  ["#4ECDC4", "#556270"],
  ["#C7F464", "#4ECDC4"],
  ["#FF8C94", "#FFAAA5"],
  ["#A8E6CF", "#3D5A80"],
  ["#E07856", "#F2D8A7"],
  ["#2E294E", "#EA698B"],
  ["#1B2021", "#FFD166"],
  ["#EF476F", "#06D6A0"],
  ["#073B4C", "#FFD166"],
  ["#8338EC", "#FB5607"],
  ["#3A86FF", "#FFBE0B"],
  ["#390099", "#FF5400"],
  ["#0F4C5C", "#E36414"],
  ["#5F0F40", "#FB8B24"],
  ["#1A1A2E", "#E94560"],
  ["#22223B", "#F2E9E4"],
  ["#2C6E49", "#D68C45"],
  ["#6A0572", "#AB83A1"],
  ["#001219", "#EE9B00"],
];

export const SONG_POOL: Song[] = [
  { title: "Luther", artist: "Kendrick Lamar & SZA", album: "GNX" },
  { title: "Birds of a Feather", artist: "Billie Eilish", album: "Hit Me Hard and Soft" },
  { title: "Die With A Smile", artist: "Lady Gaga & Bruno Mars", album: "Single" },
  { title: "APT.", artist: "Rosé & Bruno Mars", album: "Single" },
  { title: "Espresso", artist: "Sabrina Carpenter", album: "Short n' Sweet" },
  { title: "Please Please Please", artist: "Sabrina Carpenter", album: "Short n' Sweet" },
  { title: "Good Luck, Babe!", artist: "Chappell Roan", album: "Single" },
  { title: "Pink Pony Club", artist: "Chappell Roan", album: "Rise and Fall" },
  { title: "Not Like Us", artist: "Kendrick Lamar", album: "Single" },
  { title: "Squabble Up", artist: "Kendrick Lamar", album: "GNX" },
  { title: "Texas Hold 'Em", artist: "Beyoncé", album: "Cowboy Carter" },
  { title: "Fortnight", artist: "Taylor Swift & Post Malone", album: "TTPD" },
  { title: "Lose Control", artist: "Teddy Swims", album: "I've Tried Everything" },
  { title: "I Had Some Help", artist: "Post Malone & Morgan Wallen", album: "F-1 Trillion" },
  { title: "A Bar Song (Tipsy)", artist: "Shaboozey", album: "Where I've Been" },
  { title: "Too Sweet", artist: "Hozier", album: "Unreal Unearth" },
  { title: "Who", artist: "Jimin", album: "Muse" },
  { title: "Si Antes Te Hubiera Conocido", artist: "Karol G", album: "Single" },
  { title: "BAILE DE FAVELA", artist: "MC João", album: "Single" },
  { title: "Nosso Quadro", artist: "Ana Castela", album: "Single" },
  { title: "Leão", artist: "Marília Mendonça", album: "Decretos Reais" },
  { title: "Erro Gostoso", artist: "Simone Mendes", album: "Single" },
  { title: "Daylight", artist: "David Kushner", album: "The Dichotomy" },
  { title: "Stick Season", artist: "Noah Kahan", album: "Stick Season" },
  { title: "Beautiful Things", artist: "Benson Boone", album: "Fireworks & Rollerblades" },
  { title: "Cruel Summer", artist: "Taylor Swift", album: "Lover" },
  { title: "Flowers", artist: "Miley Cyrus", album: "Endless Summer Vacation" },
  { title: "Anti-Hero", artist: "Taylor Swift", album: "Midnights" },
  { title: "As It Was", artist: "Harry Styles", album: "Harry's House" },
  { title: "Unholy", artist: "Sam Smith & Kim Petras", album: "Gloria" },
  { title: "Houdini", artist: "Dua Lipa", album: "Radical Optimism" },
  { title: "Paint The Town Red", artist: "Doja Cat", album: "Scarlet" },
  { title: "Greedy", artist: "Tate McRae", album: "Think Later" },
  { title: "Vampire", artist: "Olivia Rodrigo", album: "GUTS" },
  { title: "Agora Hills", artist: "Doja Cat", album: "Scarlet" },
  { title: "Snooze", artist: "SZA", album: "SOS" },
  { title: "Kill Bill", artist: "SZA", album: "SOS" },
  { title: "Saturn", artist: "SZA", album: "SOS Deluxe" },
  { title: "Water", artist: "Tyla", album: "Tyla" },
  { title: "Calm Down", artist: "Rema & Selena Gomez", album: "Rave & Roses" },
  { title: "Gata Só", artist: "Pedro Sampaio", album: "Single" },
  { title: "Macetando", artist: "Ivete Sangalo & Ludmilla", album: "Single" },
  { title: "Malvadão 3", artist: "Xamã", album: "Zodíaco" },
  { title: "Joga Pra Lua", artist: "Pedro Sampaio", album: "Single" },
  { title: "Quando a Bad Bater", artist: "Matheus & Kauan", album: "Single" },
  { title: "Saudade Nossa", artist: "Simone & Simaria", album: "Single" },
  { title: "Morena", artist: "Luan Santana", album: "Single" },
  { title: "Pipoco", artist: "Ana Castela", album: "Single" },
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function coverFor(song: Song): Cover {
  const key = song.artist + song.title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const palette = COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
  const base: Cover = { palette, seed: Math.abs(hash) };
  if (song.imageUrl) return { ...base, imageUrl: song.imageUrl };
  return base;
}

const USERS: User[] = [
  { id: "u1", handle: "sophiacarvalho", name: "Sofia Carvalho", avatar: "#FF6B6B", bio: "Pop apologist. Sempre em busca do próximo hit.", followers: 1284, following: 412, streak: 42 },
  { id: "u2", handle: "marcosribeiro", name: "Marcos Ribeiro", avatar: "#4ECDC4", bio: "Hip-hop head • Rio de Janeiro", followers: 892, following: 201, streak: 31 },
  { id: "u3", handle: "helenasilva", name: "Helena Silva", avatar: "#8338EC", bio: "Indie, folk e um pouco de tudo", followers: 3420, following: 876, streak: 67, verified: true },
  { id: "u4", handle: "pedrogalvao", name: "Pedro Galvão", avatar: "#FB5607", bio: "Sertanejo universitário é arte", followers: 524, following: 189, streak: 12 },
  { id: "u5", handle: "julianacosta", name: "Juliana Costa", avatar: "#06D6A0", bio: "Music journalist. RT = endorsement? maybe.", followers: 5102, following: 342, streak: 89, verified: true },
  { id: "u6", handle: "thiagofarias", name: "Thiago Farias", avatar: "#3A86FF", bio: "R&B, neo-soul, funk carioca", followers: 768, following: 298, streak: 23 },
  { id: "u7", handle: "camilaoliveira", name: "Camila Oliveira", avatar: "#EF476F", bio: "Só ouço música ruim ✨", followers: 2134, following: 567, streak: 54, verified: true },
  { id: "u8", handle: "lucaspereira", name: "Lucas Pereira", avatar: "#FFD166", bio: "Curador musical amador", followers: 412, following: 612, streak: 8 },
  { id: "u9", handle: "briry", name: "Brian", avatar: "#22C55E", bio: "Music lover.", followers: 0, following: 0, streak: 0 },
];

function generateChart(userSeed: number, weekOffset: number, size = 20): Omit<ChartEntry, "status" | "delta" | "prevPos" | "peak" | "weeks">[] {
  const rand = seededRandom(userSeed * 1000 + weekOffset);
  const shuffled = [...SONG_POOL].sort(() => rand() - 0.5);
  const picks = shuffled.slice(0, size);
  return picks.map((song, i) => ({
    position: i + 1,
    song,
    cover: coverFor(song),
  }));
}

function withBillboardStats(
  current: Omit<ChartEntry, "status" | "delta" | "prevPos" | "peak" | "weeks">[],
  previous: ChartEntry[]
): ChartEntry[] {
  return current.map((entry) => {
    const prevEntry = previous.find(
      (p) => p.song.title === entry.song.title && p.song.artist === entry.song.artist
    );
    let status: ChartEntry["status"];
    let delta: number | null;
    let prevPos: number | null;
    if (!prevEntry) {
      status = "new";
      delta = null;
      prevPos = null;
    } else {
      prevPos = prevEntry.position;
      const d = prevEntry.position - entry.position;
      delta = d;
      if (d === 0) status = "same";
      else if (d > 0) status = "up";
      else status = "down";
    }
    const peak = Math.min(entry.position, prevEntry?.position ?? entry.position);
    const weeks = prevEntry ? (prevEntry.weeks || 1) + 1 : 1;
    return { ...entry, status, delta, prevPos, peak, weeks };
  });
}

function weekRef(weeksAgo: number): Date {
  const today = new Date("2026-04-20");
  const ref = new Date(today);
  ref.setDate(today.getDate() - weeksAgo * 7);
  return ref;
}

const WEEKS = 6;
function buildUserData(): UserWithCharts[] {
  return USERS.map((user, idx) => {
    const seed = idx + 1;
    const charts: Chart[] = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const raw = generateChart(seed, w);
      const prev = w < WEEKS - 1 ? charts[0]?.entries || [] : [];
      charts.unshift({
        id: `chart-${user.id}-${w}`,
        week: w,
        weekLabel: buildWeekLabelFromDate(weekRef(w)),
        dateRange: buildDateRangeFromDate(weekRef(w)),
        entries: withBillboardStats(raw, prev),
        likes: Math.floor(seededRandom(seed * 100 + w)() * 400) + 20,
        comments: Math.floor(seededRandom(seed * 200 + w)() * 60) + 2,
        reposts: Math.floor(seededRandom(seed * 300 + w)() * 30),
      });
    }
    return { ...user, charts };
  });
}

export const USERS_DATA: UserWithCharts[] = buildUserData();

export const TIMELINE: TimelineItem[] = USERS_DATA.map((u, i) => ({
  user: u,
  chart: u.charts[0],
  postedAgo: ["há 2h", "há 5h", "há 8h", "há 12h", "há 1d", "há 1d", "há 2d", "há 3d"][i],
}));

function buildGlobalChart(): GlobalChartEntry[] {
  const score = new Map<string, { song: Song; cover: Cover; pts: number; voters: number }>();
  USERS_DATA.forEach((u) => {
    u.charts[0].entries.forEach((e) => {
      const key = e.song.artist + "|" + e.song.title;
      if (!score.has(key)) score.set(key, { song: e.song, cover: e.cover, pts: 0, voters: 0 });
      const v = score.get(key)!;
      v.pts += 101 - e.position;
      v.voters += 1;
    });
  });
  const sorted = [...score.values()].sort((a, b) => b.pts - a.pts);
  const statuses: GlobalChartEntry["status"][] = ["up", "down", "same", "new"];
  const deltas = [3, -2, 0, null];
  return sorted.slice(0, 30).map((s, i) => ({
    position: i + 1,
    song: s.song,
    cover: s.cover,
    points: s.pts,
    voters: s.voters,
    status: statuses[i % 4],
    delta: deltas[i % 4],
    peak: i + 1,
    weeks: Math.floor((i * 7 + 3) % 20) + 1,
  }));
}
export const GLOBAL_CHART: GlobalChartEntry[] = buildGlobalChart();

function buildArtists(): Artist[] {
  const map = new Map<string, { name: string; songs: Map<string, ArtistSong>; totalPoints: number; voters: Set<string>; number1s: number }>();
  USERS_DATA.forEach((u) => {
    u.charts[0].entries.forEach((e) => {
      const a = e.song.artist;
      if (!map.has(a)) map.set(a, { name: a, songs: new Map(), totalPoints: 0, voters: new Set(), number1s: 0 });
      const obj = map.get(a)!;
      obj.voters.add(u.id);
      const pts = 101 - e.position;
      obj.totalPoints += pts;
      if (e.position === 1) obj.number1s += 1;
      if (!obj.songs.has(e.song.title)) {
        obj.songs.set(e.song.title, { title: e.song.title, points: 0, appearances: 0, bestPos: 100, album: e.song.album, cover: e.cover });
      }
      const s = obj.songs.get(e.song.title)!;
      s.points += pts;
      s.appearances += 1;
      s.bestPos = Math.min(s.bestPos, e.position);
    });
  });
  return [...map.values()].map((a) => ({
    name: a.name,
    totalPoints: a.totalPoints,
    listeners: a.voters.size,
    number1s: a.number1s,
    songs: [...a.songs.values()].sort((x, y) => y.points - x.points),
  })).sort((x, y) => y.totalPoints - x.totalPoints);
}
export const ARTISTS: Artist[] = buildArtists();

export const NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "like", user: USERS_DATA[1], text: "curtiu sua parada", target: "Top 20 • Semana 16", time: "há 5min", unread: true },
  { id: "n2", type: "comment", user: USERS_DATA[2], text: 'comentou: "Luther em #1 é crime" em sua parada', target: "Top 20 • Semana 16", time: "há 32min", unread: true },
  { id: "n3", type: "follow", user: USERS_DATA[4], text: "começou a seguir você", target: null, time: "há 2h", unread: true },
  { id: "n4", type: "repost", user: USERS_DATA[3], text: "fez repost da sua parada", target: "Top 20 • Semana 16", time: "há 4h", unread: false },
  { id: "n5", type: "like", user: USERS_DATA[5], text: "e 12 outros curtiram sua parada", target: "Top 20 • Semana 16", time: "há 6h", unread: false },
  { id: "n6", type: "milestone", user: null, text: "🎉 Streak de 42 semanas! Você publicou paradas por 42 semanas seguidas.", target: null, time: "ontem", unread: false },
  { id: "n7", type: "comment", user: USERS_DATA[6], text: 'comentou: "onde ficou a Chappell Roan?? 🥲" em sua parada', target: "Top 20 • Semana 15", time: "há 2d", unread: false },
  { id: "n8", type: "reaction", user: USERS_DATA[7], text: "reagiu 🔥 à sua parada", target: "Top 20 • Semana 15", time: "há 3d", unread: false },
];

export const SAMPLE_COMMENTS: Comment[] = [
  { user: USERS_DATA[1], text: "Luther em #1 é crime, deveria ser Squabble Up 🤝", likes: 24, time: "há 2h", reactions: ["🔥", "💯"] },
  { user: USERS_DATA[2], text: "Parada imaculada, nenhuma skip. Salvando pra ouvir depois.", likes: 18, time: "há 3h", reactions: ["❤️"] },
  { user: USERS_DATA[4], text: "Apt. aí em cima, gostei do recorte. Nossa overlap tá em 8 músicas essa semana 👀", likes: 12, time: "há 5h", reactions: [] },
  { user: USERS_DATA[5], text: "Benson Boone em #18 é injusto, merece top 10 no mínimo", likes: 7, time: "há 6h", reactions: ["🥲"] },
  { user: USERS_DATA[6], text: "Cadê o sertanejo??", likes: 3, time: "há 8h", reactions: ["😅"] },
];

export const CURRENT_USER = USERS_DATA[0];

export const COMMUNITIES: Community[] = [
  {
    id: "c1", slug: "rockeiros", name: "Rockeiros",
    tagline: "Do clássico ao moderno. Rock em todas as suas formas.",
    cover: ["#1A1A2E", "#E94560"], icon: "🤘",
    members: 12840, posts: 342, founded: "Jan 2026",
    admins: [USERS_DATA[2]],
    chart: [],
    memberSample: USERS_DATA.slice(0, 5),
  },
  {
    id: "c2", slug: "pop-2000s", name: "Pop 2000s",
    tagline: "Britney, Christina, *NSYNC, Backstreet. Aquela era dourada.",
    cover: ["#EF476F", "#FFD166"], icon: "💿",
    members: 8621, posts: 198, founded: "Fev 2026",
    admins: [USERS_DATA[0]],
    chart: [],
    memberSample: USERS_DATA.slice(1, 6),
  },
  {
    id: "c3", slug: "divas-pop", name: "Divas Pop",
    tagline: "Beyoncé, Rihanna, Gaga, Taylor, Ariana. Respeito.",
    cover: ["#FA243C", "#FF5858"], icon: "👑",
    members: 24102, posts: 891, founded: "Jan 2026",
    admins: [USERS_DATA[4]],
    chart: [],
    memberSample: USERS_DATA.slice(2, 7),
  },
  {
    id: "c4", slug: "disk-mtv", name: "Disk MTV",
    tagline: "Nostalgia dos anos 90/2000. MTV brasileira, clipes raros.",
    cover: ["#8338EC", "#3A86FF"], icon: "📺",
    members: 5432, posts: 127, founded: "Mar 2026",
    admins: [USERS_DATA[6]],
    chart: [],
    memberSample: USERS_DATA.slice(3, 8),
  },
  {
    id: "c5", slug: "sertanejo-universitario", name: "Sertanejo Universitário",
    tagline: "Modão, piseiro e o universitário. Bora bebê.",
    cover: ["#E36414", "#FFD166"], icon: "🤠",
    members: 9210, posts: 265, founded: "Fev 2026",
    admins: [USERS_DATA[3]],
    chart: [],
    memberSample: USERS_DATA.slice(0, 5),
  },
  {
    id: "c6", slug: "indie-br", name: "Indie BR",
    tagline: "Do Los Hermanos ao Terno Rei. Indie tupiniquim.",
    cover: ["#06D6A0", "#073B4C"], icon: "🎸",
    members: 3890, posts: 98, founded: "Mar 2026",
    admins: [USERS_DATA[5]],
    chart: [],
    memberSample: USERS_DATA.slice(1, 6),
  },
];

// Build community charts
COMMUNITIES.forEach((c, ci) => {
  const memberSlice = USERS_DATA.slice(ci % 3, (ci % 3) + 5);
  const score = new Map<string, { song: Song; cover: Cover; pts: number; voters: number }>();
  memberSlice.forEach((u) => {
    u.charts[0].entries.forEach((e) => {
      const k = e.song.artist + "|" + e.song.title;
      if (!score.has(k)) score.set(k, { song: e.song, cover: e.cover, pts: 0, voters: 0 });
      const v = score.get(k)!;
      v.pts += 101 - e.position;
      v.voters += 1;
    });
  });
  const statuses: GlobalChartEntry["status"][] = ["up", "down", "same", "new"];
  const deltas = [2, -1, 0, null];
  c.chart = [...score.values()].sort((a, b) => b.pts - a.pts).slice(0, 20).map((s, i) => ({
    position: i + 1,
    song: s.song,
    cover: s.cover,
    points: s.pts,
    voters: s.voters,
    status: statuses[i % 4],
    delta: deltas[i % 4],
    peak: i + 1,
    weeks: (i % 8) + 1,
  }));
  c.memberSample = memberSlice;
});

export const POSTS: Post[] = [
  {
    id: "p1", community: COMMUNITIES[2], user: USERS_DATA[4],
    kind: "image", text: "Renaissance World Tour foi o maior espetáculo da década. Discuss.",
    imagePalette: ["#FA243C", "#FFD700"], imageText: "BEYONCÉ",
    likes: 2841, replies: 342, shares: 89, postedAgo: "há 2h",
  },
  {
    id: "p2", community: COMMUNITIES[0], user: USERS_DATA[2],
    kind: "youtube", text: "Cara, esse solo do Gilmour aqui é arrepiante.",
    ytTitle: "Pink Floyd - Comfortably Numb (Live at Pulse)",
    ytChannel: "Pink Floyd Official",
    ytThumb: ["#0A0A0A", "#4A0E2E"],
    likes: 1204, replies: 156, shares: 67, postedAgo: "há 4h",
  },
  {
    id: "p3", community: COMMUNITIES[1], user: USERS_DATA[0],
    kind: "text",
    text: "Tese: \"Oops!... I Did It Again\" é a música pop mais bem produzida do início dos 2000s. O Max Martin cozinhou demais nessa. Ninguém muda minha opinião.",
    likes: 892, replies: 203, shares: 34, postedAgo: "há 6h",
  },
  {
    id: "p4", community: COMMUNITIES[2], user: USERS_DATA[6],
    kind: "image", text: "Ranking pessoal das eras da Gaga. Chromatica continua subestimado 😤",
    imagePalette: ["#06D6A0", "#EF476F"], imageText: "GAGA ERAS",
    likes: 1672, replies: 421, shares: 112, postedAgo: "há 8h",
  },
  {
    id: "p5", community: COMMUNITIES[3], user: USERS_DATA[7],
    kind: "youtube", text: "MTV Video Music Brasil 2003. Que montagem, que produção.",
    ytTitle: "VMB 2003 - Abertura Completa",
    ytChannel: "Arquivo MTV",
    ytThumb: ["#8338EC", "#3A86FF"],
    likes: 534, replies: 89, shares: 23, postedAgo: "há 12h",
  },
  {
    id: "p6", community: COMMUNITIES[0], user: USERS_DATA[5],
    kind: "text",
    text: "Tá na hora do Led Zeppelin voltar a bombar nas paradas jovens. A geração Z vai descobrir esse som e vai pirar.",
    likes: 412, replies: 87, shares: 18, postedAgo: "ontem",
  },
];

export const POST_REPLIES: PostReply[] = [
  { user: USERS_DATA[1], text: "Concordo 100%. Performance visual + vocal + coreografia em outro nível.", likes: 87, time: "há 1h" },
  { user: USERS_DATA[3], text: "Renaissance é trilogia obra-prima, mas Lemonade ainda é o peak pra mim.", likes: 54, time: "há 45min" },
  { user: USERS_DATA[0], text: '"Queens remind queens of they queen-ness"', likes: 231, time: "há 30min" },
];

export { COVER_PALETTES };
