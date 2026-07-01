import { notFound } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { Avatar } from "@/components/ui/Avatar";
import { prisma } from "@/lib/prisma";
import { loadCommunityHeader } from "@/lib/community-page-data";

export default async function CommunityMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { community, notFound: missing } = await loadCommunityHeader(slug);
  if (missing) notFound();

  const row = await prisma.community.findUnique({ where: { slug }, select: { id: true } });
  if (!row) notFound();

  const members = await prisma.communityMember.findMany({
    where: { communityId: row.id },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    include: {
      user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true, lastfmUser: true } },
    },
  });

  const postCounts = await prisma.post.groupBy({
    by: ["userId"],
    where: { communityId: row.id },
    _count: { id: true },
  });
  const postsByUser = new Map(postCounts.map((p) => [p.userId, p._count.id]));

  const memberGrid = "40px 48px 1fr 80px 100px 110px";

  return (
    <Shell title="" noPadding>
      <CommunityHeader community={community} activeTab="members" />
      <div style={{ padding: "28px 40px 80px 40px" }}>
        <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: memberGrid,
              alignItems: "center",
              padding: "10px 20px",
              background: "rgba(0,0,0,0.02)",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            {["#", "", "Membro", "Posts", "Last.fm", ""].map((h, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#86868B",
                  textAlign: i === 3 || i === 4 ? "center" : i === 0 ? "center" : "left",
                }}
              >
                {h}
              </div>
            ))}
          </div>
          {members.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: "#86868B", fontSize: 14 }}>
              Nenhum membro ainda.
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
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#86868B", textAlign: "center" }}>{i + 1}</div>
                <Avatar user={{ name: m.user.name, avatar: m.user.avatarColor }} imageUrl={m.user.image} size={36} />
                <div style={{ minWidth: 0, padding: "0 8px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.user.name}</div>
                  <Link href={`/profile/${m.user.handle}`} style={{ fontSize: 12, color: "#86868B", textDecoration: "none" }}>
                    @{m.user.handle}
                  </Link>
                </div>
                <div style={{ fontSize: 14, textAlign: "center" }}>{postsByUser.get(m.userId) ?? 0}</div>
                <div style={{ fontSize: 12, textAlign: "center", color: m.user.lastfmUser ? "#16A34A" : "#86868B" }}>
                  {m.user.lastfmUser ? "✓" : "—"}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B", textTransform: "capitalize" }}>
                    {m.role === "owner" ? "Dono" : m.role === "admin" ? "Admin" : "Membro"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Shell>
  );
}
