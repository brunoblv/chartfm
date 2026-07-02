"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { SystemFeedItem } from "@/lib/system-feed";

export function FeedSystemPostCard({ item }: { item: SystemFeedItem }) {
  const body = (
    <article
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        padding: 20,
        color: "var(--text)",
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Avatar user={{ name: "ChartFM", avatar: "#FA243C" }} imageUrl="/icon.svg" size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", lineHeight: 1.2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              ChartFM
            </span>
            <BadgeCheck size={15} color="#0A84FF" fill="#0A84FF" />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.postedAgo}</span>
          </div>
          <p style={{ fontSize: 15, color: "var(--text)", lineHeight: 1.55, margin: "8px 0 0" }}>{item.text}</p>
        </div>
      </div>
    </article>
  );

  if (!item.targetUrl) return body;

  return (
    <Link href={item.targetUrl} style={{ textDecoration: "none", display: "block" }}>
      {body}
    </Link>
  );
}
