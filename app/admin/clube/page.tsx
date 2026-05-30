import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getClubeAdminData } from "@/lib/clube-album";
import { ClubeAdminClient } from "./ClubeAdminClient";

export default async function AdminClubePage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin" subtitle="Clube do Álbum">
        <div style={{ color: "var(--text-muted)" }}>Acesso negado. Apenas ADMIN e DEV.</div>
      </Shell>
    );
  }

  const { active, completed } = await getClubeAdminData();

  return (
    <Shell title="Clube do Álbum" subtitle="Configure tema e cronograma da rodada">
      <ClubeAdminClient initialActive={active} initialCompleted={completed} />
    </Shell>
  );
}
