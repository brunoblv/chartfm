import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { requireBruno } from "@/lib/require-bruno";
import { RetroClient } from "./RetroClient";

export const dynamic = "force-dynamic";

// Em um primeiro momento, a Hot 100 Retrospectiva é visível apenas para o @bruno.
export default async function RetroPage() {
  const userId = await requireBruno();
  if (!userId) redirect("/");

  return (
    <Shell title="Hot 100 Retrospectivo" subtitle="Monte sua parada histórica — ajuste e gere seu Hot 100.">
      <RetroClient />
    </Shell>
  );
}
