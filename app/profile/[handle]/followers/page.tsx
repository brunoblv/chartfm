"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronLeft, BadgeCheck } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/ui/FollowButton";

type UserRow = {
  id: string;
  handle: string;
  name: string;
  avatarColor: string;
  image: string | null;
  verified: boolean;
  followers: number;
  bio: string | null;
  isFollowing: boolean;
};

type ApiResponse = {
  users: UserRow[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};

export default function FollowersPage() {
  const { handle } = useParams<{ handle: string }>();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") === "following" ? "following" : "followers";
  const { data: session } = useSession();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (p: number, replace: boolean) => {
      if (p === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await fetch(
          `/api/profile/${handle}/followers?type=${type}&page=${p}&perPage=20`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as ApiResponse;
        setUsers((prev) => (replace ? data.users : [...prev, ...data.users]));
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(p);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [handle, type],
  );

  useEffect(() => {
    setUsers([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, true);
  }, [fetchPage]);

  const title = type === "followers" ? "Seguidores" : "Seguindo";

  return (
    <Shell title="">
      <div>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <Link
            href={`/profile/${handle}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.06)",
              color: "#1D1D1F",
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "#1D1D1F",
              }}
            >
              @{handle}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#86868B" }}>
              {loading ? "—" : total.toLocaleString("pt-BR")} {title.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            marginBottom: 20,
          }}
        >
          {(["followers", "following"] as const).map((t) => {
            const active = type === t;
            const label = t === "followers" ? "Seguidores" : "Seguindo";
            return (
              <Link
                key={t}
                href={`/profile/${handle}/followers?type=${t}`}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#1D1D1F" : "#86868B",
                  textDecoration: "none",
                  borderBottom: active ? "2px solid #FA243C" : "2px solid transparent",
                  marginBottom: -1,
                  transition: "color 150ms",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#86868B",
              fontSize: 15,
            }}
          >
            {type === "followers"
              ? "Nenhum seguidor ainda."
              : "Não está seguindo ninguém ainda."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                currentUserId={session?.user?.id}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button
              onClick={() => fetchPage(page + 1, false)}
              disabled={loadingMore}
              style={{
                background: "rgba(0,0,0,0.06)",
                border: "none",
                borderRadius: 100,
                padding: "10px 28px",
                fontSize: 14,
                fontWeight: 600,
                color: "#1D1D1F",
                cursor: loadingMore ? "default" : "pointer",
                opacity: loadingMore ? 0.6 : 1,
              }}
            >
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function UserRow({
  user,
  currentUserId,
}: {
  user: UserRow;
  currentUserId?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <Link href={`/profile/${user.handle}`} style={{ flexShrink: 0 }}>
        <Avatar
          user={{ name: user.name, avatar: user.avatarColor }}
          imageUrl={user.image ?? undefined}
          size={44}
        />
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          href={`/profile/${user.handle}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              lineHeight: 1.2,
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "#1D1D1F",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.name}
            </span>
            {user.verified && (
              <BadgeCheck size={14} color="#FA243C" fill="#FA243C" strokeWidth={0} />
            )}
          </div>
          <div style={{ fontSize: 13, color: "#86868B", marginTop: 1 }}>
            @{user.handle}
            {user.followers > 0 && (
              <span style={{ marginLeft: 8 }}>
                · {user.followers.toLocaleString("pt-BR")} seguidores
              </span>
            )}
          </div>
          {user.bio && (
            <div
              style={{
                fontSize: 13,
                color: "#48484A",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.bio}
            </div>
          )}
        </Link>
      </div>

      {currentUserId && currentUserId !== user.id && (
        <FollowButton
          targetId={user.id}
          initialFollowing={user.isFollowing}
          variant="outline"
          size="sm"
        />
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.06)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            width: "40%",
            height: 14,
            borderRadius: 6,
            background: "rgba(0,0,0,0.06)",
            marginBottom: 6,
          }}
        />
        <div
          style={{
            width: "25%",
            height: 12,
            borderRadius: 6,
            background: "rgba(0,0,0,0.04)",
          }}
        />
      </div>
    </div>
  );
}
