import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export default async function NotFound() {
  const { locale } = await getServerTranslations();
  const en = locale === "en";
  return (
    <Shell title={en ? "Page not found" : "Página não encontrada"} subtitle="404">
      <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>
        <p style={{ fontSize: 16, marginBottom: 20 }}>
          {en
            ? "This page doesn't exist or was removed."
            : "Esta página não existe ou foi removida."}
        </p>
        <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
          {en ? "Back to Discover" : "Voltar para o Discover"}
        </Link>
      </div>
    </Shell>
  );
}
