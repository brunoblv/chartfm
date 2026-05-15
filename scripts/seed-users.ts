import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

const USERS = [
  {
    handle: "mariasouza",
    name: "Maria Souza",
    email: "maria.souza@example.com",
    avatarColor: "#FA243C",
    bio: "Amante de música brasileira e pop internacional.",
    genres: ["pop", "mpb", "sertanejo"],
  },
  {
    handle: "joaosilva",
    name: "João Silva",
    email: "joao.silva@example.com",
    avatarColor: "#3B82F6",
    bio: "Rock, metal e tudo mais. Charts toda semana.",
    genres: ["rock", "metal", "alternative"],
  },
  {
    handle: "anaoliveira",
    name: "Ana Oliveira",
    email: "ana.oliveira@example.com",
    avatarColor: "#10B981",
    bio: "K-pop stan desde 2012. ARMY forever.",
    genres: ["k-pop", "pop", "j-pop"],
  },
  {
    handle: "pedrocosta",
    name: "Pedro Costa",
    email: "pedro.costa@example.com",
    avatarColor: "#F59E0B",
    bio: "Hip-hop e R&B são minha religião.",
    genres: ["hip-hop", "r&b", "trap"],
  },
  {
    handle: "juliaferreira",
    name: "Júlia Ferreira",
    email: "julia.ferreira@example.com",
    avatarColor: "#8B5CF6",
    bio: "Indie e eletrônico. Descobrindo artistas novos todo dia.",
    genres: ["indie", "electronic", "dream pop"],
  },
  {
    handle: "lucasmendes",
    name: "Lucas Mendes",
    email: "lucas.mendes@example.com",
    avatarColor: "#EF4444",
    bio: "Funk carioca e pagode no DNA.",
    genres: ["funk", "pagode", "samba"],
  },
  {
    handle: "carolaraujo",
    name: "Carol Araújo",
    email: "carol.araujo@example.com",
    avatarColor: "#EC4899",
    bio: "Pop girlies e divas da música. Beyhive member.",
    genres: ["pop", "dance", "r&b"],
  },
  {
    handle: "rafaelnunes",
    name: "Rafael Nunes",
    email: "rafael.nunes@example.com",
    avatarColor: "#14B8A6",
    bio: "Jazz, soul e blues. Clássico nunca sai de moda.",
    genres: ["jazz", "soul", "blues"],
  },
  {
    handle: "biaribeiro",
    name: "Beatriz Ribeiro",
    email: "bia.ribeiro@example.com",
    avatarColor: "#F97316",
    bio: "Forró e baião. Nordestina com orgulho.",
    genres: ["forro", "baiao", "axe"],
  },
  {
    handle: "gabrielcardoso",
    name: "Gabriel Cardoso",
    email: "gabriel.cardoso@example.com",
    avatarColor: "#6366F1",
    bio: "Lo-fi, ambient e música para estudar.",
    genres: ["lo-fi", "ambient", "chillout"],
  },
];

async function main() {
  console.log("Criando 10 usuários...\n");

  for (const data of USERS) {
    const user = await prisma.user.upsert({
      where: { handle: data.handle },
      update: {},
      create: data,
    });
    console.log(`✓ @${user.handle} — ${user.name} (${user.id})`);
  }

  console.log("\nPronto! 10 usuários criados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
