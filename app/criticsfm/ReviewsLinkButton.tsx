"use client";

import Link from "next/link";
import { useTranslations } from "@/hooks/useTranslations";

export function ReviewsLinkButton() {
  const { t } = useTranslations();
  return (
    <Link
      href="/criticsfm/reviews"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-muted)",
        textDecoration: "none",
        padding: "9px 16px",
        borderRadius: 10,
        border: "1px solid var(--divider)",
        background: "var(--surface)",
        marginBottom: 4,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      {t("criticsfm.viewAllReviews")}
    </Link>
  );
}
