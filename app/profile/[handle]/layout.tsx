import type { Metadata } from "next";
import { entityMetadata, getProfileMaturity } from "@/lib/entity-maturity";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  let decoded = handle;
  try {
    decoded = decodeURIComponent(handle);
  } catch {
    // mantém o valor bruto
  }
  return entityMetadata(await getProfileMaturity(decoded.replace(/^@/, ""), await getServerLocale()), "ChartFM");
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
