"use client";

import Link from "next/link";
import { Crown, Zap, Check, Minus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useTranslations } from "@/hooks/useTranslations";

export type CommunityMemberRow = {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    handle: string;
    name: string;
    avatarColor: string;
    image: string | null;
    lastfmUser: string | null;
  };
  postCount: number;
};

export function CommunityMembersList({ members }: { members: CommunityMemberRow[] }) {
  const { t } = useTranslations();
  const memberGrid = "40px 48px 1fr 80px 100px 110px";

  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
      <div
        style={{
          padding: "15px 20px 13px",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{t("communities.membersPageTitle")}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          {t("communities.members", { count: members.length })}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: memberGrid,
          alignItems: "center",
          padding: "10px 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {["#", "", t("communities.colMember"), "Posts", "Last.fm", ""].map((h, i) => (
          <div
            key={i}
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              textAlign: i === 3 || i === 4 ? "center" : i === 0 ? "center" : "left",
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {members.length === 0 ? (
        <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {t("communities.noMembersYet")}
        </div>
      ) : (
        members.map((m, i) => (
          <div
            key={m.id}
            style={{
              display: "grid",
              gridTemplateColumns: memberGrid,
              alignItems: "center",
              padding: "12px 20px",
              borderBottom: "1px solid var(--divider-soft)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>{i + 1}</div>
            <Avatar user={{ name: m.user.name, avatar: m.user.avatarColor }} imageUrl={m.user.image} size={36} />
            <div style={{ minWidth: 0, padding: "0 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                {m.user.name}
                {m.role === "owner" && <Crown size={13} color="var(--accent)" />}
                {m.role === "admin" && <Zap size={13} color="#3B82F6" />}
              </div>
              <Link href={`/profile/${m.user.handle}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
                @{m.user.handle}
              </Link>
            </div>
            <div style={{ fontSize: 14, textAlign: "center", color: "var(--text)" }}>{m.postCount}</div>
            <div style={{ display: "flex", justifyContent: "center", color: m.user.lastfmUser ? "#16A34A" : "var(--text-muted)" }}>
              {m.user.lastfmUser ? <Check size={14} /> : <Minus size={14} />}
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  background: m.role === "owner" ? "var(--accent-tint)" : m.role === "admin" ? "rgba(59,130,246,0.1)" : "var(--fill-subtle)",
                  color: m.role === "owner" ? "var(--accent)" : m.role === "admin" ? "#3B82F6" : "var(--text-subtle)",
                  borderRadius: 100,
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {m.role === "owner"
                  ? t("communities.roleOwner")
                  : m.role === "admin"
                    ? t("communities.roleAdmin")
                    : t("communities.roleMember")}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
