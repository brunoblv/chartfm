import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalList,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("privacyPolicy.metaTitle"),
    description: t("privacyPolicy.metaDescription"),
    alternates: { canonical: "/privacy-policy" },
  };
}

export default async function PrivacyPolicyPage() {
  const { t } = await getServerTranslations();

  return (
    <InstitutionalLayout>
      <InstitutionalTitle updatedAt="julho de 2026">{t("privacyPolicy.title")}</InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)" }}>
        <InstitutionalSection title={t("privacyPolicy.section1Title")}>
          <InstitutionalParagraph>{t("privacyPolicy.section1Body")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("privacyPolicy.section2Title")}>
          <InstitutionalParagraph>{t("privacyPolicy.section2Intro")}</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, margin: 0 }}>
              <li>
                <strong style={{ color: "var(--text)" }}>{t("privacyPolicy.section2RegistrationLabel")}</strong>{" "}
                {t("privacyPolicy.section2RegistrationBody")}
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>{t("privacyPolicy.section2UsageLabel")}</strong>{" "}
                {t("privacyPolicy.section2UsageBody")}
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>{t("privacyPolicy.section2TechnicalLabel")}</strong>{" "}
                {t("privacyPolicy.section2TechnicalBody")}
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>{t("privacyPolicy.section2CookiesLabel")}</strong>{" "}
                {t("privacyPolicy.section2CookiesBody")}
              </li>
            </ul>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("privacyPolicy.section3Title")}>
          <InstitutionalList
            items={[
              t("privacyPolicy.section3Item1"),
              t("privacyPolicy.section3Item2"),
              t("privacyPolicy.section3Item3"),
              t("privacyPolicy.section3Item4"),
              t("privacyPolicy.section3Item5"),
            ]}
          />
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("privacyPolicy.section4Title")}>
          <InstitutionalParagraph>
            {t("privacyPolicy.section4Prefix")}{" "}
            <Link href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
              {t("privacyPolicy.section4LinkText")}
            </Link>
            .
          </InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>
              {t("privacyPolicy.section4Body2Prefix")}{" "}
              <Link
                href="https://policies.google.com/technologies/partner-sites"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}
              >
                policies.google.com/technologies/partner-sites
              </Link>
              .
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("privacyPolicy.section5Title")}>
          <InstitutionalParagraph>{t("privacyPolicy.section5Intro")}</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, margin: 0 }}>
              <li>
                <strong style={{ color: "var(--text)" }}>{t("privacyPolicy.section5FunctionalLabel")}</strong>{" "}
                {t("privacyPolicy.section5FunctionalBody")}
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>{t("privacyPolicy.section5AdsLabel")}</strong>{" "}
                {t("privacyPolicy.section5AdsBody")}
              </li>
            </ul>
          </div>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>{t("privacyPolicy.section5Outro")}</InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("privacyPolicy.section6Title")}>
          <InstitutionalParagraph>{t("privacyPolicy.section6Intro")}</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                t("privacyPolicy.section6Item1"),
                t("privacyPolicy.section6Item2"),
                t("privacyPolicy.section6Item3"),
              ]}
            />
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("privacyPolicy.section7Title")}>
          <InstitutionalParagraph>{t("privacyPolicy.section7Intro")}</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                t("privacyPolicy.section7Item1"),
                t("privacyPolicy.section7Item2"),
                t("privacyPolicy.section7Item3"),
                t("privacyPolicy.section7Item4"),
              ]}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>
              {t("privacyPolicy.section7OutroPrefix")}{" "}
              <Link href="/data-deletion" style={{ color: "var(--accent)", fontWeight: 600 }}>
                {t("privacyPolicy.section7OutroLinkText")}
              </Link>
              . {t("privacyPolicy.section7OutroSuffix")}{" "}
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("privacyPolicy.section8Title")}>
          <InstitutionalParagraph>{t("privacyPolicy.section8Body")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("privacyPolicy.section9Title")}>
          <InstitutionalParagraph>{t("privacyPolicy.section9Body")}</InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title={t("privacyPolicy.section10Title")}>
          <InstitutionalParagraph>
            {t("privacyPolicy.section10Prefix")}{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>
          </InstitutionalParagraph>
        </InstitutionalSection>
      </div>
    </InstitutionalLayout>
  );
}
