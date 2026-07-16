import { Shell } from "@/components/layout/Shell";
import { requireBruno } from "@/lib/require-bruno";
import { getTiktokBotAdminData } from "@/lib/tiktok-bot";
import { TiktokBotClient } from "./TiktokBotClient";

export const dynamic = "force-dynamic";

// Painel do TikTok Growth Bot — exclusivo do @bruno.
export default async function AdminTiktokBotPage() {
  const bruno = await requireBruno();
  if (!bruno) {
    return (
      <Shell title="Admin" subtitle="TikTok Growth Bot">
        <div style={{ color: "var(--text-muted)" }}>Acesso negado. Esta página é exclusiva do @bruno.</div>
      </Shell>
    );
  }

  const data = await getTiktokBotAdminData();

  return (
    <Shell title="TikTok Growth Bot" subtitle="Comunidade de crescimento mútuo no TikTok via Telegram">
      <TiktokBotClient initialData={data} />
    </Shell>
  );
}
