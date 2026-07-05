import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users, BarChart2, MessageCircle, Star, Music2, Headphones, Radio } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { prisma } from "@/lib/prisma";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: `${t("communities.title")} | ChartFM`,
    description: t("communities.subtitle"),
    alternates: { canonical: "/communities" },
  };
}

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
  const { t } = await getServerTranslations();
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
    <Shell title={t("communities.title")} subtitle={t("communities.subtitle")}>

      {/* ===== BLOCO EDITORIAL PRINCIPAL ===== */}
      <section style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          As comunidades são espaços para encontrar pessoas que compartilham os mesmos interesses musicais que você. Entre para conversar sobre seus artistas favoritos, lançamentos, álbuns, paradas e tudo o que movimenta o mundo da música.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Explore comunidades dedicadas a diferentes gêneros, artistas e cenas musicais. Do pop ao rock, do indie à música eletrônica, cada grupo reúne pessoas com algo em comum e cria seu próprio espaço para conversas, descobertas e troca de recomendações.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", margin: "28px 0 14px 0" }}>
          Uma parada para cada comunidade
        </h2>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Cada comunidade tem sua própria parada musical, formada a partir das paradas pessoais publicadas por seus membros. Assim, é possível acompanhar quais músicas estão em alta dentro de cada grupo e comparar como os gostos mudam de uma comunidade para outra.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Uma música pode dominar a parada de uma comunidade de fãs de pop enquanto outra cresce entre os fãs de rock alternativo. É uma maneira diferente de descobrir música: através do gosto coletivo de pessoas que compartilham interesses com você.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Além das paradas, você pode participar das conversas, compartilhar músicas, comentar lançamentos e conhecer as paradas pessoais de outros membros.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>
          Não encontrou a comunidade que procurava? Crie a sua, escolha um nome e uma identidade, convide pessoas e comece a construir um novo espaço dentro do ChartFM.
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
