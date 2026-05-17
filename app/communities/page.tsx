import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users, BarChart2, MessageCircle, Star, Music2, Headphones, Radio } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Comunidades Musicais | ChartFM",
  description:
    "Descubra e participe de comunidades musicais no ChartFM. Discuta lançamentos, acompanhe charts coletivos, conheça fãs de pop, rock, indie, eletrônico e muito mais. Encontre sua tribo musical.",
};

type CommunityCard = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  logoUrl: string | null;
  cover: [string, string];
  members: number;
  posts: number;
  memberSample: {
    id: string;
    name: string;
    avatar: string;
    imageUrl: string | null;
  }[];
  newPosts: number;
};

function toCommunityCard(
  community: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    icon: string;
    logoUrl: string | null;
    coverA: string;
    coverB: string;
    members: number;
    posts: number;
    communityMembers: {
      joinedAt: Date;
      user: {
        id: string;
        name: string;
        avatarColor: string;
        image: string | null;
      };
    }[];
    communityPosts?: { createdAt: Date }[];
  },
): CommunityCard {
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;

  return {
    id: community.id,
    slug: community.slug,
    name: community.name,
    tagline: community.tagline,
    icon: community.icon,
    logoUrl: community.logoUrl,
    cover: [community.coverA, community.coverB],
    members: community.members,
    posts: community.posts,
    memberSample: community.communityMembers.map(({ user }) => ({
      id: user.id,
      name: user.name,
      avatar: user.avatarColor,
      imageUrl: user.image,
    })),
    newPosts: community.communityPosts?.filter((post) => post.createdAt.getTime() >= yesterday).length ?? 0,
  };
}

const GENRES = [
  { label: "Pop", icon: "🎤" },
  { label: "Rock", icon: "🎸" },
  { label: "Hip-Hop", icon: "🎧" },
  { label: "Eletrônico", icon: "🎛️" },
  { label: "R&B", icon: "🎶" },
  { label: "Indie", icon: "🌿" },
  { label: "K-Pop", icon: "⭐" },
  { label: "MPB", icon: "🎵" },
  { label: "Sertanejo", icon: "🤠" },
  { label: "Funk", icon: "🔊" },
  { label: "Metal", icon: "🤘" },
  { label: "Jazz", icon: "🎺" },
];

const HOW_IT_WORKS = [
  {
    icon: <Users size={20} />,
    title: "Entre ou crie uma comunidade",
    desc: "Qualquer usuário pode entrar em comunidades públicas ou criar a sua própria. Defina nome, ícone, descrição e convide quem quiser.",
  },
  {
    icon: <BarChart2 size={20} />,
    title: "A parada coletiva é gerada automaticamente",
    desc: "Toda semana o ChartFM agrega os charts de todos os membros e gera uma parada coletiva única para a comunidade, refletindo o que o grupo está ouvindo.",
  },
  {
    icon: <MessageCircle size={20} />,
    title: "Discuta, compartilhe e explore",
    desc: "Poste suas opiniões sobre lançamentos, álbuns e artistas. Veja o que outros membros estão ouvindo e descubra músicas através de quem tem o mesmo gosto que você.",
  },
  {
    icon: <Star size={20} />,
    title: "Acompanhe tendências em tempo real",
    desc: "Monitore quais artistas estão subindo no ranking da comunidade, quais faixas estão em alta e como o gosto coletivo do grupo evolui semana a semana.",
  },
];

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const params = await searchParams;
  const rawQuery = Array.isArray(params?.q) ? params?.q[0] : params?.q;
  const query = rawQuery?.trim() ?? "";
  const publicCommunityWhere = {
    isPublic: true,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { tagline: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [myRows, exploreRows] = await Promise.all([
    userId
      ? prisma.community.findMany({
          where: { communityMembers: { some: { userId } } },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            slug: true,
            name: true,
            tagline: true,
            icon: true,
            logoUrl: true,
            coverA: true,
            coverB: true,
            members: true,
            posts: true,
            communityMembers: {
              orderBy: { joinedAt: "asc" },
              take: 3,
              select: {
                joinedAt: true,
                user: { select: { id: true, name: true, avatarColor: true, image: true } },
              },
            },
            communityPosts: {
              where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
              select: { createdAt: true },
            },
          },
        })
      : Promise.resolve([]),
    prisma.community.findMany({
      where: publicCommunityWhere,
      orderBy: [{ members: "desc" }, { createdAt: "desc" }],
      take: 24,
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        icon: true,
        logoUrl: true,
        coverA: true,
        coverB: true,
        members: true,
        posts: true,
        communityMembers: {
          orderBy: { joinedAt: "asc" },
          take: 3,
          select: {
            joinedAt: true,
            user: { select: { id: true, name: true, avatarColor: true, image: true } },
          },
        },
      },
    }),
  ]);

  const myComms = myRows.map(toCommunityCard);
  const exploreComms = exploreRows.map(toCommunityCard);
  const myCommunityIds = new Set(myComms.map((community) => community.id));

  return (
    <Shell title="Comunidades" subtitle="Encontre sua tribo musical">

      {/* ===== BLOCO EDITORIAL PRINCIPAL ===== */}
      <section style={{ marginBottom: 48, maxWidth: 820 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>
          Descubra comunidades musicais no ChartFM
        </h2>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          As comunidades do ChartFM foram criadas para conectar pessoas através da música. Cada espaço reúne usuários com gostos, artistas e interesses em comum, permitindo discussões sobre lançamentos, álbuns clássicos, rankings semanais, reviews e cultura pop. Em vez de ouvir música de forma isolada, as comunidades tornam a experiência coletiva — você descobre o que seus pares estão ouvindo, defende seus artistas favoritos e acompanha como o gosto coletivo evolui semana a semana.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Dentro das comunidades, fãs podem compartilhar opiniões, acompanhar tendências musicais, descobrir novos artistas e participar de conversas sobre diferentes gêneros e movimentos da música ao redor do mundo. Do pop ao indie, do rock ao eletrônico, cada comunidade funciona como um espaço dedicado para trocar experiências e encontrar pessoas que enxergam a música da mesma forma. Não importa se você é fã de um nicho específico ou se seu gosto é eclético — existe uma comunidade para você, e se não existir, você pode criar a sua.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Um dos recursos mais únicos das comunidades no ChartFM é a <strong style={{ color: "var(--text)" }}>parada coletiva</strong>. Toda semana, o sistema agrega automaticamente os charts individuais de todos os membros e gera um ranking exclusivo da comunidade. Isso significa que a chart reflete, de verdade, o que aquele grupo de pessoas está ouvindo e defendendo naquele momento — não um algoritmo genérico, mas o gosto real de quem faz parte daquela comunidade. É uma forma completamente nova de descobrir música através de pessoas com quem você tem afinidade.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Além das discussões e da parada semanal, as comunidades ajudam usuários a descobrir novas charts pessoais, avaliações de álbuns e playlists criadas pela própria base de fãs do ChartFM. Conforme a plataforma cresce, novos grupos surgem constantemente, criando um ambiente dinâmico onde diferentes estilos musicais coexistem. Você pode acompanhar debates sobre posições no Global 100, comentar lançamentos aguardados e compartilhar suas previsões sobre artistas em ascensão.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>
          Seja para encontrar pessoas com o mesmo gosto musical, discutir um álbum recém-lançado, explorar novas recomendações ou simplesmente acompanhar o que está em alta dentro de um gênero específico, as comunidades do ChartFM foram feitas para aproximar fãs de música em um único lugar. Qualquer usuário pode criar uma comunidade: basta definir um nome, um ícone, uma descrição e começar a convidar membros. A experiência cresce junto com o grupo.
        </p>
      </section>

      {/* ===== COMO FUNCIONAM ===== */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 20 }}>
          Como funcionam as comunidades
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {HOW_IT_WORKS.map((step) => (
            <div
              key={step.title}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: 14,
                padding: "18px 20px",
              }}
            >
              <div style={{ color: "#FA243C", marginBottom: 10 }}>{step.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== GÊNEROS EM DESTAQUE ===== */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 6 }}>
          Gêneros mais discutidos
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.6 }}>
          Encontre comunidades organizadas por estilo musical. Cada gênero tem seu próprio espaço com fãs, debates, rankings e descobertas específicas.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {GENRES.map((g) => (
            <Link
              key={g.label}
              href={`/communities?q=${encodeURIComponent(g.label)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--surface)",
                border: "1px solid var(--divider-strong)",
                borderRadius: 20,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              <span>{g.icon}</span>
              {g.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ===== SEARCH + CREATE ===== */}
      <div style={{ display: "flex", gap: 12, marginBottom: 36, alignItems: "center" }}>
        <form
          action="/communities"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--surface)",
            border: "1px solid var(--divider-strong)",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar comunidades..."
            style={{
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "var(--text)",
              flex: 1,
              background: "transparent",
            }}
          />
        </form>
        <Link
          href="/community/create"
          style={{
            background: "#FA243C",
            color: "white",
            textDecoration: "none",
            padding: "10px 22px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
            whiteSpace: "nowrap",
          }}
        >
          Criar comunidade
        </Link>
      </div>

      {/* ===== SUAS COMUNIDADES ===== */}
      {userId && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>
            Suas comunidades
          </h2>
          {myComms.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {myComms.map((c) => (
                <Link key={c.id} href={`/community/${c.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div
                    style={{
                      background: "var(--surface)",
                      borderRadius: 18,
                      border: "1px solid var(--divider)",
                      padding: "16px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        flexShrink: 0,
                        background: `linear-gradient(135deg, ${c.cover[0]}, ${c.cover[1]})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        overflow: "hidden",
                      }}
                    >
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        c.icon
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {c.members.toLocaleString("pt-BR")} membros
                      </div>
                      <div style={{ fontSize: 12, color: "#FA243C", fontWeight: 600, marginTop: 2 }}>
                        {c.newPosts === 1 ? "1 post novo" : `${c.newPosts} posts novos`}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div
              style={{
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--divider)",
                padding: 18,
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              Você ainda não participa de nenhuma comunidade.
            </div>
          )}
        </section>
      )}

      {/* ===== EXPLORAR ===== */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>
          Explorar comunidades
        </h2>
        {exploreComms.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {exploreComms.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "var(--surface)",
                  borderRadius: 18,
                  border: "1px solid var(--divider)",
                  overflow: "hidden",
                }}
              >
                {/* Banner */}
                <div
                  style={{
                    height: 120,
                    background: `linear-gradient(135deg, ${c.cover[0]}, ${c.cover[1]})`,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {c.logoUrl ? (
                    <img
                      src={c.logoUrl}
                      alt={c.name}
                      style={{
                        width: 76,
                        height: 76,
                        borderRadius: 20,
                        objectFit: "cover",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 56 }}>{c.icon}</div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "rgba(0,0,0,0.5)",
                      backdropFilter: "blur(8px)",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 20,
                    }}
                  >
                    {c.members.toLocaleString("pt-BR")} membros
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "16px 18px 18px" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{c.name}</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-muted)",
                      marginBottom: 14,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      lineHeight: 1.55,
                    }}
                  >
                    {c.tagline}
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      <MessageCircle size={12} />
                      {c.posts.toLocaleString("pt-BR")} posts
                    </span>
                    {c.newPosts > 0 && (
                      <span style={{ fontSize: 12, color: "#FA243C", fontWeight: 600 }}>
                        +{c.newPosts} hoje
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Avatar stack */}
                    <div style={{ display: "flex" }}>
                      {(c.memberSample ?? []).slice(0, 3).map((u, i) => (
                        <div
                          key={u.id}
                          style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid var(--surface)", borderRadius: "50%" }}
                        >
                          <Avatar user={u} imageUrl={u.imageUrl} size={24} />
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <Link
                      href={`/community/${c.slug}`}
                      style={{
                        background: "var(--btn-dark-bg)",
                        color: "var(--btn-dark-fg)",
                        textDecoration: "none",
                        padding: "7px 16px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {myCommunityIds.has(c.id) ? "Abrir" : "Participar"}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid var(--divider)",
              padding: 18,
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            {query
              ? "Nenhuma comunidade encontrada para essa busca."
              : "Nenhuma comunidade pública foi criada ainda."}
          </div>
        )}
      </section>

      {/* ===== EDITORIAL FINAL ===== */}
      <section
        style={{
          borderTop: "1px solid var(--divider)",
          paddingTop: 40,
          maxWidth: 820,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 18 }}>
          Por que participar de uma comunidade musical?
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Music2 size={16} color="#FA243C" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Descubra música de verdade</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
              As recomendações das comunidades são geradas por pessoas reais com gosto parecido com o seu — não por algoritmos. Isso significa descobertas mais relevantes e menos óbvias.
            </p>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Headphones size={16} color="#FA243C" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Acompanhe charts coletivos</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
              Cada comunidade gera sua própria parada semanal automaticamente, refletindo o que os membros estão ouvindo. É o jeito mais honesto de ver o que um grupo realmente ouve.
            </p>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Radio size={16} color="#FA243C" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Participe de debates culturais</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
              De discussões sobre lançamentos aguardados a debates sobre álbuns clássicos, as comunidades são o espaço certo para quem leva música a sério e quer conversar com quem pensa igual.
            </p>
          </div>
        </div>

        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>
          O ChartFM acredita que música é melhor quando compartilhada. As comunidades são a forma que encontramos de tornar isso possível: conectando pessoas, cruzando gostos e construindo um espaço onde cada faixa ouvida se transforma em parte de algo maior. Junte-se a uma comunidade hoje, ou crie a sua e convide quem você quiser.
        </p>
      </section>
    </Shell>
  );
}
