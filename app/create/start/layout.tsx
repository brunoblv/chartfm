import { Suspense } from "react";
import { getServerTranslations } from "@/lib/i18n/server-translations";

// Página client-only, gated por sessão, sem valor de SEO — não faz sentido
// pré-renderizar estaticamente no build (a VPS tem só 1.9 GB de RAM e o build
// trava/derruba em "Generating static pages" quando páginas pesadas demais
// entram nesse passo). Renderiza sob demanda em vez de no build.
export const dynamic = "force-dynamic";

export default async function CreateStartLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getServerTranslations();
  return <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t("create.loadingFallback")}</div>}>{children}</Suspense>;
}
