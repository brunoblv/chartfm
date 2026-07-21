import type { Metadata } from "next";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("copa.rulesMetaTitle"),
  };
}

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

export default async function CopaRegrasPage() {
  const { t } = await getServerTranslations();

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 720, margin: "0 auto" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
        {t("copa.rulesEyebrow")}
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
        {t("copa.rulesTitle")}
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>
        {t("copa.rulesSubtitle")}
      </p>

      <Section title={t("copa.rulesSection1Title")}>
        <List
          items={[
            t("copa.rulesS1i1"),
            t("copa.rulesS1i2"),
            t("copa.rulesS1i3"),
          ]}
        />
      </Section>

      <Section title={t("copa.rulesSection2Title")}>
        <p style={{ marginBottom: 10 }}>
          {t("copa.rulesS2ParaPrefix")}
          <strong>{t("copa.rulesS2ParaBold")}</strong>
          {t("copa.rulesS2ParaSuffix")}
        </p>
        <Card>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>{t("copa.rulesExampleLabel")} - Paramore</p>
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

      <Section title={t("copa.rulesSection3Title")}>
        <List
          items={[
            t("copa.rulesS3i1"),
            t("copa.rulesS3i2"),
            <>
              {t("copa.rulesS3ScorePrefix")} <strong>{t("copa.rulesS3ScoreWin")}</strong>, <strong>{t("copa.rulesS3ScoreDraw")}</strong>,{" "}
              <strong>{t("copa.rulesS3ScoreLoss")}</strong>.
            </>,
            t("copa.rulesS3i4"),
          ]}
        />
      </Section>

      <Section title={t("copa.rulesSection4Title")}>
        <p style={{ marginBottom: 10 }}>
          {t("copa.rulesS4Para")}
        </p>
        <MiniTable
          head={[t("copa.rulesColMatch"), t("copa.rulesColSongUsed")]}
          rows={[
            [t("copa.rulesRowGroupGame1"), t("copa.rulesSongN", { n: 1 })],
            [t("copa.rulesRowGroupGame2"), t("copa.rulesSongN", { n: 2 })],
            [t("copa.rulesRowGroupGame3"), t("copa.rulesSongN", { n: 3 })],
            [t("copa.phaseR32"), t("copa.rulesSongN", { n: 4 })],
            [t("copa.phaseR16"), t("copa.rulesSongN", { n: 5 })],
            [t("copa.phaseQF"), t("copa.rulesSongN", { n: 6 })],
            [t("copa.phaseSF"), t("copa.rulesSongN", { n: 7 })],
            [t("copa.rulesRowFinalThird"), t("copa.rulesSongN", { n: 8 })],
          ]}
        />
      </Section>

      <Section title={t("copa.rulesSection5Title")}>
        <p style={{ marginBottom: 10 }}>
          {t("copa.rulesS5Para")}
        </p>
        <List
          items={[
            <>
              <strong>{t("copa.rulesS5GroupBold")}</strong>{t("copa.rulesS5GroupText")}
            </>,
            <>
              <strong>{t("copa.rulesS5KnockoutBold")}</strong>{t("copa.rulesS5KnockoutText")}
            </>,
          ]}
        />
        <div style={{ marginTop: 10 }}>
          <Card>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>{t("copa.rulesExampleLabel")}</p>
            <p style={{ color: "var(--text-muted)" }}>Paramore: &quot;Decode&quot; × Avril Lavigne: &quot;Complicated&quot;</p>
          </Card>
        </div>
      </Section>

      <Section title={t("copa.rulesSection6Title")}>
        <p style={{ marginBottom: 10 }}>{t("copa.rulesS6Para")}</p>
        <OrderedList
          items={[
            t("copa.rulesS6i1"),
            t("copa.rulesS6i2"),
            t("copa.rulesS6i3"),
            t("copa.rulesS6i4"),
            t("copa.rulesS6i5"),
            t("copa.rulesS6i6"),
          ]}
        />
      </Section>

      <Section title={t("copa.rulesKnockoutSectionTitle")}>
        <List
          items={[
            <>
              <strong>{t("copa.rulesKoR32Bold")}</strong>{t("copa.rulesKoR32Text")}
            </>,
            <>
              <strong>{t("copa.rulesKoR16Bold")}</strong>{t("copa.rulesKoR16Text")}
            </>,
            <>
              <strong>{t("copa.rulesKoQFBold")}</strong>{t("copa.rulesKoQFText")}
            </>,
            <>
              <strong>{t("copa.rulesKoSFBold")}</strong>{t("copa.rulesKoSFText")}
            </>,
            <>
              <strong>{t("copa.rulesKoFinalBold")}</strong>{t("copa.rulesKoFinalText")}
            </>,
            <>
              <strong>{t("copa.rulesKoThirdBold")}</strong>{t("copa.rulesKoThirdText")}
            </>,
          ]}
        />
      </Section>

      <Section title={t("copa.rulesTiebreakKnockoutTitle")}>
        <p style={{ marginBottom: 10 }}>
          {t("copa.rulesTkPara")}
        </p>
        <OrderedList
          items={[
            t("copa.rulesTk1"),
            t("copa.rulesTk2"),
            t("copa.rulesTk3"),
          ]}
        />
      </Section>

      <Section title={t("copa.rulesFinalLineupTitle")}>
        <p style={{ marginBottom: 10 }}>
          {t("copa.rulesFlPara")}
        </p>
        <List items={[t("copa.rulesFl1"), t("copa.rulesFl2"), t("copa.rulesFl3")]} />
      </Section>

      <Section title={t("copa.rulesChampionExampleTitle")}>
        <MiniTable
          head={[t("copa.rulesColPhase"), t("copa.rulesColSongHeader")]}
          rows={[
            [t("copa.rulesChampRowGroup1"), t("copa.rulesSongN", { n: 1 })],
            [t("copa.rulesChampRowGroup2"), t("copa.rulesSongN", { n: 2 })],
            [t("copa.rulesChampRowGroup3"), t("copa.rulesSongN", { n: 3 })],
            [t("copa.phaseR32"), t("copa.rulesSongN", { n: 4 })],
            [t("copa.rulesChampRowR16"), t("copa.rulesSongN", { n: 5 })],
            [t("copa.rulesChampRowQF"), t("copa.rulesSongN", { n: 6 })],
            [t("copa.rulesChampRowSF"), t("copa.rulesSongN", { n: 7 })],
            [t("copa.rulesChampRowFinal"), t("copa.rulesSongN", { n: 8 })],
          ]}
        />
      </Section>

      <Section title={t("copa.rulesStrategyTitle")}>
        <p style={{ marginBottom: 10 }}>
          {t("copa.rulesStPara")}
        </p>
        <List
          items={[
            t("copa.rulesSt1"),
            t("copa.rulesSt2"),
            t("copa.rulesSt3"),
          ]}
        />
        <p style={{ marginTop: 10, color: "var(--text-muted)" }}>
          {t("copa.rulesStClosing")}
        </p>
      </Section>
    </div>
  );
}
