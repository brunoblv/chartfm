import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { StepCard, ScoreTable } from "@/components/push/PushIntroView";
import { STEPS, SCORE_ROWS } from "@/components/push/push-content";
import { PUSH_NO_VOTE_PENALTY } from "@/lib/push-scoring";
import { PushNav } from "../PushNav";

export const metadata: Metadata = {
  title: "Push · Sobre | ChartFM",
  description:
    "Como funciona o Push: indique uma música pouco conhecida, ouça a playlist da rodada, rankeie e acompanhe a pontuação.",
};

export default function PushSobrePage() {
  return (
    <Shell
      title="Push · Sobre"
      subtitle="O jogo de descoberta musical do ChartFM"
      headerRight={
        <Link href="/push" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
          ← Rodada atual
        </Link>
      }
    >
      <div style={{ maxWidth: 780 }}>
        <PushNav />

        <div
          style={{
            marginTop: 24,
            marginBottom: 28,
            padding: "28px 30px",
            borderRadius: 16,
            background: "#0F0F12",
            color: "#fff",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#FF8C8C",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 10,
            }}
          >
            O que é o Push
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 12, lineHeight: 1.3 }}>
            Descubra um artista ou música que quase ninguém conhece — e mostre para o mundo.
          </div>
          <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, margin: 0 }}>
            Inspirado no antigo <b>MTV Push</b>, que lançava artistas para o grande público: aqui, toda rodada, cada
            participante indica uma faixa desconhecida. As indicações ficam ocultas até todo mundo ouvir e rankear —
            só então se revela quem indicou o quê. Quem somar mais pontos, ganha.
          </p>
        </div>

        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: "0 0 16px 0",
          }}
        >
          Como funciona
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
            marginBottom: 32,
          }}
        >
          {STEPS.map((step, i) => (
            <StepCard key={step.num} step={step} isFirst={i === 0} />
          ))}
        </div>

        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: "0 0 16px 0",
          }}
        >
          Como pontuar
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, margin: "0 0 16px 0" }}>
          Sua música recebe pontos de cada ouvinte, conforme a posição em que ele a colocou no próprio ranking:
          quem tira 1º lugar de alguém ganha {SCORE_ROWS[0].pts} pontos, e o valor cai numa curva suave até 1 ponto
          para o último colocado. Os pontos de todos os ouvintes da rodada são somados no final.
        </p>
        <ScoreTable isMobile={false} />
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.6 }}>
          Quem não avalia a rodada não fica neutro: cada participante que não envia seu ranking dá +{PUSH_NO_VOTE_PENALTY} pontos
          de bônus para todas as outras músicas da rodada — um incentivo para todo mundo ouvir e votar.
        </p>

        <div style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/push" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
            Participar da rodada atual →
          </Link>
          <Link href="/push/historico" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            Ver histórico de rodadas →
          </Link>
          <Link href="/push/ranking" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            Ver ranking →
          </Link>
        </div>
      </div>
    </Shell>
  );
}
