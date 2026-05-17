import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { BookOpen, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Guias e Tutoriais | ChartFM",
  description:
    "Aprenda como usar o ChartFM: crie sua parada musical semanal, entenda o Global 100, participe de comunidades, avalie álbuns e descubra novas músicas. Guias completos para novos e antigos usuários.",
};

const GUIDES = [
  {
    slug: "como-criar-sua-parada",
    title: "Como criar sua parada semanal",
    description:
      "Aprenda passo a passo como montar sua chart pessoal no ChartFM. Da busca por músicas à publicação, entenda como registrar o que você está ouvindo cada semana.",
    readTime: "4 min de leitura",
    tag: "Primeiros passos",
  },
  {
    slug: "como-funciona-o-global-100",
    title: "Como funciona o Global 100",
    description:
      "Entenda como o ranking global é calculado a partir das paradas pessoais dos usuários, como pontos são atribuídos e o que faz uma música subir ou cair na parada coletiva.",
    readTime: "5 min de leitura",
    tag: "Ranking",
  },
  {
    slug: "como-participar-de-comunidades",
    title: "Como participar de comunidades",
    description:
      "Descubra como entrar em comunidades musicais, o que são as paradas coletivas de cada grupo e como criar sua própria comunidade no ChartFM.",
    readTime: "4 min de leitura",
    tag: "Comunidades",
  },
  {
    slug: "como-avaliar-albuns",
    title: "Como avaliar álbuns no CriticsFM",
    description:
      "Guia completo para avaliar álbuns, escrever reviews, dar notas e explorar as avaliações da comunidade no módulo CriticsFM do ChartFM.",
    readTime: "3 min de leitura",
    tag: "Reviews",
  },
  {
    slug: "como-descobrir-musicas",
    title: "Como descobrir músicas no ChartFM",
    description:
      "Use o Discover para encontrar novos artistas, seguir curadores com gosto parecido com o seu e explorar charts por gênero musical.",
    readTime: "3 min de leitura",
    tag: "Descoberta",
  },
];

export default function GuidesPage() {
  return (
    <Shell title="Guias" subtitle="Aprenda a usar o ChartFM">

      {/* Intro */}
      <section style={{ marginBottom: 40, maxWidth: 720 }}>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 12px 0" }}>
          Seja você um novo usuário dando os primeiros passos ou alguém que já usa o ChartFM há algum tempo, os guias abaixo explicam como aproveitar ao máximo cada funcionalidade da plataforma. Do processo de criar sua primeira parada musical até entender como o ranking global é calculado, cada guia foi escrito para ser direto e completo.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>
          O ChartFM combina curadoria musical pessoal, rankings coletivos, reviews de álbuns e comunidades temáticas em um só lugar. Esses guias ajudam a navegar por cada um desses espaços com confiança.
        </p>
      </section>

      {/* Lista de guias */}
      <section>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {GUIDES.map((guide, i) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--divider)",
                  borderRadius: i === 0 ? "14px 14px 0 0" : i === GUIDES.length - 1 ? "0 0 14px 14px" : "0",
                  borderTop: i > 0 ? "none" : undefined,
                  padding: "22px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "var(--fill-inset)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <BookOpen size={20} color="#FA243C" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#FA243C",
                      }}
                    >
                      {guide.tag}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{guide.readTime}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{guide.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{guide.description}</div>
                </div>

                <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer links */}
      <div
        style={{
          marginTop: 40,
          paddingTop: 20,
          borderTop: "1px solid var(--divider)",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
        }}
      >
        <Link href="/about" style={{ color: "#FA243C", textDecoration: "none" }}>Sobre o ChartFM</Link>
        <Link href="/contact" style={{ color: "#FA243C", textDecoration: "none" }}>Contato</Link>
        <Link href="/discover" style={{ color: "#FA243C", textDecoration: "none" }}>Descobrir música</Link>
        <Link href="/communities" style={{ color: "#FA243C", textDecoration: "none" }}>Comunidades</Link>
      </div>
    </Shell>
  );
}
