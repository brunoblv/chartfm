import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regras · Copa ChartFM",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: 10,
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>{children}</div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        borderRadius: 14,
        padding: "16px 18px",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function OrderedList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

function MiniTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--divider)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  background: "var(--fill-inset)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--divider)" }}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: "8px 12px", color: j === 0 ? "var(--text)" : "var(--text-muted)", fontWeight: j === 0 ? 700 : 400 }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CopaRegrasPage() {
  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 720, margin: "0 auto" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
        Regulamento Oficial
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
        Copa de Artistas — 64 Artistas
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>
        Como funciona o torneio musical da comunidade ChartFM, do sorteio dos grupos até a final.
      </p>

      <Section title="1. Participantes">
        <List
          items={[
            "A competição é disputada por 64 artistas.",
            "Cada artista tem um representante (técnico) responsável pela inscrição e pela estratégia.",
            "O representante escolhe uma lista de 8 músicas do artista, que serão usadas ao longo de toda a campanha.",
          ]}
        />
      </Section>

      <Section title="2. Escalação">
        <p style={{ marginBottom: 10 }}>
          O representante define 8 músicas do artista, em ordem de utilização (Música 1 a Música 8). A ordem enviada é{" "}
          <strong>definitiva</strong> — ela determina qual música entra em cada partida da campanha.
        </p>
        <Card>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Exemplo — Paramore</p>
          <OrderedList
            items={[
              "Misery Business",
              "That's What You Get",
              "Decode",
              "Ignorance",
              "Hard Times",
              "Ain't It Fun",
              "Rose-Colored Boy",
              "Still Into You",
            ]}
          />
        </Card>
      </Section>

      <Section title="3. Fase de Grupos">
        <List
          items={[
            "Os 64 artistas são divididos em 16 grupos de 4.",
            "Cada artista enfrenta os outros três integrantes do grupo — 3 partidas por artista.",
            <>
              Pontuação: <strong>vitória = 3 pontos</strong>, <strong>empate = 1 ponto</strong>,{" "}
              <strong>derrota = 0 ponto</strong>.
            </>,
            "Classificam-se o 1º e o 2º colocado de cada grupo, avançando ao 1/16 de Final.",
          ]}
        />
      </Section>

      <Section title="4. Utilização das Músicas">
        <p style={{ marginBottom: 10 }}>
          A música usada em cada partida depende do número do jogo do artista na competição — as músicas não podem ser
          repetidas.
        </p>
        <MiniTable
          head={["Partida", "Música utilizada"]}
          rows={[
            ["Grupo · Jogo 1", "Música 1"],
            ["Grupo · Jogo 2", "Música 2"],
            ["Grupo · Jogo 3", "Música 3"],
            ["1/16 de Final", "Música 4"],
            ["Oitavas de Final", "Música 5"],
            ["Quartas de Final", "Música 6"],
            ["Semifinal", "Música 7"],
            ["Final / 3º Lugar", "Música 8"],
          ]}
        />
      </Section>

      <Section title="5. Votação das Partidas">
        <p style={{ marginBottom: 10 }}>
          Cada confronto é formado por uma música de cada artista. Os torcedores votam na música preferida — o artista
          cuja música recebe mais votos vence a partida.
        </p>
        <Card>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Exemplo</p>
          <p style={{ color: "var(--text-muted)" }}>Paramore: "Decode" × Avril Lavigne: "Complicated"</p>
        </Card>
      </Section>

      <Section title="6. Critérios de Desempate — Fase de Grupos">
        <p style={{ marginBottom: 10 }}>Em caso de empate na tabela do grupo, a ordem de critérios é:</p>
        <OrderedList
          items={[
            "Maior número de pontos",
            "Confronto direto",
            "Saldo de votos",
            "Maior número de votos recebidos",
            "Número de vitórias",
            "Sorteio",
          ]}
        />
      </Section>

      <Section title="Fases Eliminatórias">
        <List
          items={[
            <>
              <strong>1/16 de Final (32 artistas):</strong> 1º do Grupo A × 2º do Grupo B, 1º do Grupo B × 2º do Grupo A,
              e assim sucessivamente.
            </>,
            <>
              <strong>Oitavas de Final:</strong> os vencedores do 1/16 avançam.
            </>,
            <>
              <strong>Quartas de Final:</strong> os oito artistas restantes disputam quatro partidas.
            </>,
            <>
              <strong>Semifinais:</strong> os quatro artistas restantes disputam duas partidas.
            </>,
            <>
              <strong>Final:</strong> os vencedores das semifinais disputam o título.
            </>,
            <>
              <strong>Disputa de 3º Lugar:</strong> os derrotados das semifinais disputam a terceira colocação.
            </>,
          ]}
        />
      </Section>

      <Section title="Empates no Mata-Mata">
        <p style={{ marginBottom: 10 }}>
          Um jogo eliminatório nunca termina empatado. O desempate segue, em ordem:
        </p>
        <OrderedList
          items={[
            "Placar (votos convertidos em gols) — quem tiver mais gols vence.",
            "Empate em gols: vence quem tiver mais votos no total (a \"prorrogação\").",
            "Empate também em votos: decide nos \"pênaltis\" — vence a música com mais pontos no Global 100.",
          ]}
        />
      </Section>

      <Section title="A Escalação é Definitiva">
        <p style={{ marginBottom: 10 }}>
          As músicas enviadas no início da competição valem para toda a campanha. Não são permitidas:
        </p>
        <List items={["Trocas de músicas", "Alteração da ordem", "Substituições"]} />
      </Section>

      <Section title="Exemplo da Campanha do Campeão">
        <MiniTable
          head={["Fase", "Música"]}
          rows={[
            ["Grupo — Rodada 1", "Música 1"],
            ["Grupo — Rodada 2", "Música 2"],
            ["Grupo — Rodada 3", "Música 3"],
            ["1/16 de Final", "Música 4"],
            ["Oitavas", "Música 5"],
            ["Quartas", "Música 6"],
            ["Semifinal", "Música 7"],
            ["Final", "Música 8"],
          ]}
        />
      </Section>

      <Section title="Estratégia">
        <p style={{ marginBottom: 10 }}>
          O representante atua como o técnico do artista. Ele precisa decidir:
        </p>
        <List
          items={[
            "Colocar os maiores sucessos na fase de grupos para garantir a classificação.",
            "Guardar músicas fortes para as fases decisivas.",
            "Equilibrar a escalação pensando em toda a campanha.",
          ]}
        />
        <p style={{ marginTop: 10, color: "var(--text-muted)" }}>
          Uma música usada no início pode garantir a vaga, mas uma música guardada para a final pode ser decisiva para
          conquistar o título. Por isso, a ordem das músicas é tão importante quanto as próprias escolhas.
        </p>
      </Section>
    </div>
  );
}
