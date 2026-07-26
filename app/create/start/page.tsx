"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslations } from "@/hooks/useTranslations";

export default function CreateStartPage() {
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { t } = useTranslations();
  const paradaId = searchParams.get("paradaId");
  const suffix = paradaId ? `?paradaId=${encodeURIComponent(paradaId)}` : "";

  return (
    <Shell title={t("createStart.title")} subtitle={t("createStart.subtitle")}>
      <div style={{ maxWidth: 720 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 20 }}>
        {t("createStart.eyebrow")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Link
          href={`/create/guided${suffix}`}
          style={{
            display: "block",
            border: "2px solid var(--accent)",
            background: "var(--accent-tint, rgba(250,36,60,.08))",
            borderRadius: 20,
            padding: 26,
            cursor: "pointer",
            position: "relative",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ position: "absolute", top: 16, right: 16, background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 100, letterSpacing: "0.03em", textTransform: "uppercase" }}>
            {t("createStart.recommended")}
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FA243C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 16 }}>
            🧭
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", marginBottom: 8 }}>{t("createStart.guidedTitle")}</div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            {t("createStart.guidedDesc")}
          </div>
        </Link>

        <Link
          href={`/create${suffix}`}
          style={{
            display: "block",
            border: "1px solid var(--divider)",
            background: "var(--surface)",
            borderRadius: 20,
            padding: 26,
            cursor: "pointer",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--fill-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 16 }}>
            ✎
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", marginBottom: 8 }}>{t("createStart.normalTitle")}</div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            {t("createStart.normalDesc")}
          </div>
        </Link>
      </div>

      <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, background: "var(--fill-subtle)", borderRadius: 12, padding: "14px 20px" }}>
        {t("createStart.footerNote")}
      </div>
      </div>
    </Shell>
  );
}
