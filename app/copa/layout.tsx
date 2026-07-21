import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { CopaNav } from "./CopaNav";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("copa.navTitle"),
    description: t("copa.navMetaDescription"),
  };
}

export default async function CopaLayout({ children }: { children: React.ReactNode }) {
  await getServerSession(authOptions);
  return (
    <Shell noPadding>
      <CopaNav />
      <div style={{ padding: "0 0 80px 0" }}>{children}</div>
    </Shell>
  );
}
