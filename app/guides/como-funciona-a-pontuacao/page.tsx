import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalInlineLink,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { scoringDocParams, scoringTable } from "@/lib/scoring-docs";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("guides.pontuacaoMetaTitle"),
    description: t("guides.pontuacaoMetaDescription"),
    alternates: { canonical: "/guides/como-funciona-a-pontuacao" },
  };
}

export default async function GuideComoFuncionaAPontuacao() {
  const { t: tRaw, locale } = await getServerTranslations();
  const docParams = scoringDocParams(locale);
  const t = (key: string) => tRaw(key, docParams);
  const rows = scoringTable();
  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle={t("guides.pontuacaoSubtitle")}>{t("guides.pontuacaoTitle")}</InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <InstitutionalSection title={t("guides.pontuacaoSec1Title")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InstitutionalParagraph>{t("guides.pontuacaoSec1Body1")}</InstitutionalParagraph>
            <InstitutionalParagraph>{t("guides.pontuacaoSec1Body2")}</InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("guides.pontuacaoSec2Title")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InstitutionalParagraph>{t("guides.pontuacaoSec2Intro")}</InstitutionalParagraph>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--divider)",
                        color: "var(--text)",
                        fontWeight: 700,
                      }}
                    >
                      {t("guides.pontuacaoTableColPosicao")}
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--divider)",
                        color: "var(--text)",
                        fontWeight: 700,
                      }}
                    >
                      {t("guides.pontuacaoTableColPontos")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ position, points }) => (
                    <tr key={position} data-position={position} data-points={points}>
                      <td
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--divider)",
                          color: "var(--text-subtle)",
                        }}
                      >
                        {locale === "en" ? `#${position}` : `${position}ª`}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid var(--divider)",
                          color: "var(--text-subtle)",
                        }}
                      >
                        {points.toLocaleString(locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("guides.pontuacaoSec3Title")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InstitutionalParagraph>{t("guides.pontuacaoSec3Body1")}</InstitutionalParagraph>
            <InstitutionalParagraph>{t("guides.pontuacaoSec3Body2")}</InstitutionalParagraph>
            <InstitutionalParagraph>{t("guides.pontuacaoSec3Body3")}</InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("guides.pontuacaoSec4Title")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InstitutionalParagraph>{t("guides.pontuacaoSec4Body1")}</InstitutionalParagraph>
            <InstitutionalParagraph>{t("guides.pontuacaoSec4Body2")}</InstitutionalParagraph>
          </div>
        </InstitutionalSection>
      </div>

      <div style={{ marginTop: 32 }}>
        <InstitutionalParagraph>
          {t("guides.pontuacaoFooterPrefix")}{" "}
          <InstitutionalInlineLink href="/guides/como-funciona-o-global-100">
            {t("guides.pontuacaoFooterLink1")}
          </InstitutionalInlineLink>
          {" · "}
          <InstitutionalInlineLink href="/guides/glossario">{t("guides.pontuacaoFooterLink2")}</InstitutionalInlineLink>
          {" · "}
          <InstitutionalInlineLink href="/guides">{t("guides.pontuacaoFooterLink3")}</InstitutionalInlineLink>
        </InstitutionalParagraph>
      </div>
    </InstitutionalLayout>
  );
}
