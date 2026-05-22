"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ArtistRefreshImageButton({ artistId }: { artistId: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleRefresh() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/admin/artist/${artistId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh-image" }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("ok");
      router.refresh();
    } catch {
      setStatus("error");
    } finally {
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={status === "loading"}
      style={{
        marginLeft: 8,
        padding: "3px 10px",
        borderRadius: 6,
        border: "1px solid rgba(0,0,0,0.12)",
        background: status === "ok" ? "#E8F5E9" : status === "error" ? "#FEECEC" : "white",
        color: status === "ok" ? "#2E7D32" : status === "error" ? "#C5291C" : "#6B6B70",
        fontSize: 11,
        fontWeight: 600,
        cursor: status === "loading" ? "default" : "pointer",
        opacity: status === "loading" ? 0.6 : 1,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {status === "loading" ? "…" : status === "ok" ? "Atualizado" : status === "error" ? "Não encontrado" : "Atualizar foto"}
    </button>
  );
}
