import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { GlobalHubCards } from "@/components/global/GlobalHubCards";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { ChevronLeft } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("global.hubMetaTitle"),
    description: t("global.hubMetaDescription"),
    alternates: { canonical: "/global" },
  };
}

export default async function GlobalHubPage() {
  const { t } = await getServerTranslations();

  return (
    <Shell title={t("global.hubTitle")} subtitle={t("global.hubSubtitle")}>
      <section style={{ marginBottom: 32, maxWidth: 820 }}>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>
          {t("global.hubIntro")}
        </p>
      </section>

      <GlobalHubCards />

      <section style={{ borderTop: "1px solid var(--divider)", paddingTop: 32, maxWidth: 820 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t("global.hubHowTitle")}</h2>
        <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-muted)", fontSize: 14, lineHeight: 1.8 }}>
          <li>{t("global.hubHowCharts")}</li>
          <li>Top 50 por gênero — Rock, Brasil, Urban, Asian, Pop, Alternative e Eletrônica.</li>
          <li>{t("global.hubHowAirplay")}</li>
          <li>{t("global.hubHowAlbums")}</li>
        </ul>
        <Link
          href="/guides/como-funciona-o-global-100"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 16,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={16} style={{ transform: "rotate(180deg)" }} />
          {t("global.hubGuideLink")}
        </Link>
      </section>
    </Shell>
  );
}
