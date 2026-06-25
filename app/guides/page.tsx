import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { BookOpen, ChevronRight, Star, Users, BarChart2, Search, Music } from "lucide-react";

export const metadata: Metadata = {
  title: "Guias e Tutoriais | ChartFM",
  description:
    "Aprenda como usar o ChartFM: crie sua parada musical semanal, entenda o Global 100, participe de comunidades, avalie álbuns e descubra novas músicas. Guias completos para novos e antigos usuários.",
  alternates: { canonical: "/guides" },
};

const GUIDES_PRIMEIROS_PASSOS = [
  {
    slug: "como-criar-sua-parada",
    title: "Como criar sua parada semanal",
    description:
      "Aprenda passo a passo como montar sua chart pessoal no ChartFM. Da busca por músicas à publicação, entenda como registrar o que você está ouvindo cada semana.",
    readTime: "4 min de leitura",
    tag: "Primeiros passos",
    icon: <Music size={20} color="#FA243C" />,
  },
];

const GUIDES_RANKINGS = [
  {
    slug: "como-funciona-o-global-100",
    title: "Como funciona o Global 100",
    description:
      "Entenda como o ranking global é calculado a partir das paradas pessoais dos usuários, como pontos são atribuídos e o que faz uma música subir ou cair na parada coletiva.",
    readTime: "5 min de leitura",
    tag: "Ranking",
    icon: <BarChart2 size={20} color="#FA243C" />,
  },
  {
    slug: "como-descobrir-musicas",
    title: "Como descobrir músicas no ChartFM",
    description:
      "Use o Discover para encontrar novos artistas, seguir fãs de música com gosto parecido com o seu e explorar charts por gênero musical.",
    readTime: "3 min de leitura",
    tag: "Descoberta",
    icon: <Search size={20} color="#FA243C" />,
  },
];

const GUIDES_COMUNIDADE = [
  {
    slug: "como-participar-de-comunidades",
    title: "Como participar de comunidades",
    description:
      "Descubra como entrar em comunidades musicais, o que são as paradas coletivas de cada grupo e como criar sua própria comunidade no ChartFM.",
    readTime: "4 min de leitura",
    tag: "Comunidades",
    icon: <Users size={20} color="#FA243C" />,
  },
  {
    slug: "como-avaliar-albuns",
    title: "Como avaliar álbuns no CriticsFM",
    description:
      "Guia completo para avaliar álbuns, escrever reviews, dar notas e explorar as avaliações da comunidade no módulo CriticsFM do ChartFM.",
    readTime: "3 min de leitura",
    tag: "Reviews",
    icon: <Star size={20} color="#FA243C" />,
  },
];

const FAQ = [
  {
    q: "O que é uma personal chart?",
    a: "Uma personal chart é um ranking musical criado por você semanalmente. Você escolhe quais músicas mais marcaram a semana e define a ordem de importância. Não há regra de gênero, idioma ou época — a chart é completamente sua.",
  },
  {
    q: "Como criar minha primeira chart?",
    a: "Acesse o menu lateral e clique em 'Criar Chart'. Busque as músicas pelo nome da faixa ou do artista, adicione até 20 faixas, defina a ordem de posições e publique. Sua chart entra imediatamente no feed da comunidade.",
  },
  {
    q: "Como funciona o ranking global?",
    a: "O Global 100 é calculado a partir de todas as paradas pessoais publicadas na semana. Cada posição numa chart pessoal gera pontos: músicas na 1ª posição valem mais do que as na 10ª ou 20ª. O ranking é consolidado toda segunda-feira às 01h00 (BRT).",
  },
  {
    q: "Como publicar reviews de álbuns?",
    a: "Acesse qualquer álbum no CriticsFM, atribua uma nota de 0 a 100 e escreva sua análise. As reviews ficam públicas no perfil do álbum e aparecem no feed de usuários que te seguem.",
  },
  {
    q: "O que são comunidades no ChartFM?",
    a: "Comunidades são grupos de usuários reunidos por um gosto musical em comum — um artista, gênero ou era específica. Cada comunidade tem sua própria parada coletiva, calculada a partir das charts pessoais dos membros.",
  },
];

function GuideRow({ guide, isFirst, isLast }: { guide: (typeof GUIDES_PRIMEIROS_PASSOS)[0]; isFirst: boolean; isLast: boolean }) {
  return (
    <Link href={`/guides/${guide.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: isFirst && isLast ? 14 : isFirst ? "14px 14px 0 0" : isLast ? "0 0 14px 14px" : "0",
          borderTop: !isFirst ? "none" : undefined,
          padding: "20px 22px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          transition: "background 0.15s",
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 11,
            background: "var(--fill-inset)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {guide.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#FA243C" }}>
              {guide.tag}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{guide.readTime}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{guide.title}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{guide.description}</div>
        </div>
        <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      </div>
    </Link>
  );
}

export default function GuidesPage() {
  return (
    <Shell title="Guias e Tutoriais do ChartFM" subtitle="Tudo que você precisa saber para explorar a plataforma">

      {/* Hero editorial */}
      <section style={{ marginBottom: 48, maxWidth: 760 }}>
        <p style={{ fontSize: 16, lineHeight: 1.85, color: "var(--text-muted)", margin: "0 0 16px 0" }}>
          A seção de guias e tutoriais do ChartFM foi criada para ajudar usuários a explorar todos os recursos da plataforma e mergulhar ainda mais na cultura das paradas musicais pessoais. Aqui você encontra conteúdos sobre como criar sua própria chart semanal, acompanhar tendências musicais, avaliar álbuns, descobrir novos artistas e entender melhor como funciona o universo das personal charts dentro da comunidade.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.85, color: "var(--text-muted)", margin: "0 0 16px 0" }}>
          Além dos tutoriais da plataforma, os guias também abordam temas ligados à cultura pop, rankings musicais, comportamento de fandoms, reviews de álbuns e formas de descobrir músicas através da atividade da comunidade.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.85, color: "var(--text-muted)", margin: 0 }}>
          Seja você um novo usuário ou alguém apaixonado por charts musicais há anos, esta seção reúne conteúdos para ajudar a aproveitar melhor todas as experiências disponíveis no ChartFM.
        </p>
      </section>

      {/* Guia em destaque */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 8px 0" }}>
          Guia em destaque
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px 0", lineHeight: 1.6 }}>
          Se você está começando agora, este é o melhor ponto de partida. Criar sua primeira parada semanal é o coração da experiência no ChartFM.
        </p>
        <Link href="/guides/como-criar-sua-parada" style={{ textDecoration: "none", color: "inherit" }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              borderLeft: "4px solid #FA243C",
              borderRadius: 14,
              padding: "24px 28px",
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "rgba(250,36,60,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <BookOpen size={24} color="#FA243C" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#FA243C", marginBottom: 6 }}>
                Primeiros passos · 4 min de leitura
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>
                Como criar sua parada semanal
              </div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Aprenda passo a passo como montar sua chart pessoal no ChartFM. Da busca por músicas à publicação, entenda como registrar o que você está ouvindo cada semana e contribuir para o ranking global.
              </div>
            </div>
            <ChevronRight size={20} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          </div>
        </Link>
      </section>

      {/* Rankings e Descoberta */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 8px 0" }}>
          Rankings e descoberta musical
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px 0", lineHeight: 1.6 }}>
          Como as personal charts se transformam em rankings coletivos? Como o Global 100 é calculado? E como usar a atividade da comunidade para descobrir novos artistas? Esses guias explicam a lógica por trás das paradas coletivas e das ferramentas de descoberta.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {GUIDES_RANKINGS.map((guide, i) => (
            <GuideRow
              key={guide.slug}
              guide={guide}
              isFirst={i === 0}
              isLast={i === GUIDES_RANKINGS.length - 1}
            />
          ))}
        </div>
      </section>

      {/* Comunidade e Reviews */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 8px 0" }}>
          Comunidade e reviews
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px 0", lineHeight: 1.6 }}>
          O ChartFM vai além das paradas individuais. As comunidades reúnem usuários em torno de artistas, gêneros ou eras específicas — cada grupo tem sua própria chart coletiva. Já o CriticsFM funciona como um hub de reviews ao estilo Metacritic, onde você avalia álbuns e descobre o que a comunidade pensa sobre os lançamentos.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {GUIDES_COMUNIDADE.map((guide, i) => (
            <GuideRow
              key={guide.slug}
              guide={guide}
              isFirst={i === 0}
              isLast={i === GUIDES_COMUNIDADE.length - 1}
            />
          ))}
        </div>
      </section>

      {/* O que são personal charts */}
      <section
        style={{
          marginBottom: 52,
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 14,
          padding: "28px 32px",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 12px 0" }}>
          Como funcionam as personal charts?
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75, margin: "0 0 12px 0" }}>
          As personal charts são rankings musicais criados pelos próprios usuários semanalmente. Cada lista representa os artistas, músicas e álbuns mais marcantes daquele período, funcionando como um registro pessoal da experiência musical de cada usuário.
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75, margin: "0 0 12px 0" }}>
          Dentro do ChartFM, essas charts ajudam a construir tendências coletivas: quando muitos usuários colocam a mesma música em posições altas nas suas paradas individuais, essa faixa sobe no Global 100. Isso cria um ecossistema em que a descoberta musical é orgânica e reflexo real do que a comunidade está ouvindo.
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>
          Ao contrário dos algoritmos de streaming, que recomendam músicas baseados em reproduções passivas, o ChartFM parte de escolhas conscientes. Você decide o que vai para a sua parada — e essa curadoria coletiva define o que é tendência na plataforma.
        </p>
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 8px 0" }}>
          Perguntas frequentes
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px 0", lineHeight: 1.6 }}>
          Dúvidas comuns sobre como o ChartFM funciona, respondidas de forma direta.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {FAQ.map((item, i) => (
            <div
              key={i}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: i === 0 ? "14px 14px 0 0" : i === FAQ.length - 1 ? "0 0 14px 14px" : "0",
                borderTop: i > 0 ? "none" : undefined,
                padding: "20px 24px",
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px 0", letterSpacing: "-0.01em" }}>
                {item.q}
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Links internos */}
      <section
        style={{
          marginBottom: 40,
          padding: "24px 28px",
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 14,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 16px 0" }}>
          Explore o ChartFM
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { href: "/", label: "Feed da comunidade" },
            { href: "/global", label: "Global 100" },
            { href: "/discover", label: "Descobrir música" },
            { href: "/communities", label: "Comunidades" },
            { href: "/criticsfm", label: "CriticsFM" },
            { href: "/albums", label: "Álbuns" },
            { href: "/about", label: "Sobre o ChartFM" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#FA243C",
                textDecoration: "none",
                background: "rgba(250,36,60,0.07)",
                borderRadius: 8,
                padding: "6px 14px",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}
