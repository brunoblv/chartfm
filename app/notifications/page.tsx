import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { NotificationsClient, type NotifRow } from "./NotificationsClient";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const rows = await prisma.notification.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
        },
      },
    },
  });

  // Collect unique actor IDs from follow notifications to check follow-back state
  const followActorIds = [
    ...new Set(
      rows
        .filter((r) => r.type === "follow" && r.actor)
        .map((r) => r.actor!.id)
    ),
  ];

  const alreadyFollowing = new Set<string>();
  if (followActorIds.length > 0) {
    const existing = await prisma.userFollow.findMany({
      where: { followerId: session.user.id, followingId: { in: followActorIds } },
      select: { followingId: true },
    });
    for (const f of existing) alreadyFollowing.add(f.followingId);
  }

  const notifications: NotifRow[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    text: r.text,
    targetUrl: r.targetUrl,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
    actor: r.actor
      ? {
          id: r.actor.id,
          handle: r.actor.handle,
          name: r.actor.name,
          avatarColor: r.actor.avatarColor,
          image: r.actor.image,
        }
      : null,
    isFollowingBack: r.type === "follow" && r.actor ? alreadyFollowing.has(r.actor.id) : undefined,
  }));

  return (
    <Shell title="Notificações">
      <div style={{ maxWidth: 680 }}>
        <NotificationsClient initial={notifications} />
      </div>
    </Shell>
  );
}
