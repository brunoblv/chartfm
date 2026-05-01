"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Shell } from "@/components/layout/Shell";

const ALL_GENRES = [
  "Pop", "Indie", "Rock", "R&B", "Hip Hop",
  "Eletrônica", "Sertanejo", "Funk BR", "MPB", "Jazz",
  "Clássica", "Latina", "K-Pop", "Country", "Metal", "Reggae",
];

type ProfileData = {
  handle: string;
  name: string;
  bio: string | null;
  paradaNome: string | null;
  genres: string[];
  lastfmUser: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileData>({
    handle: "",
    name: "",
    bio: "",
    paradaNome: "",
    genres: [],
    lastfmUser: "",
  });

  useEffect(() => {
    fetch("/api/user/profile")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!res.ok) throw new Error("Não foi possível carregar seus dados.");
        return (await res.json()) as ProfileData;
      })
      .then((data) => {
        if (!data) return;
        setForm({
          handle: data.handle ?? "",
          name: data.name ?? "",
          bio: data.bio ?? "",
          paradaNome: data.paradaNome ?? "",
          genres: data.genres ?? [],
          lastfmUser: data.lastfmUser ?? "",
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  function toggleGenre(genre: string) {
    setForm((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter((g) => g !== genre)
        : [...prev.genres, genre],
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          handle: form.handle,
          bio: form.bio,
          paradaNome: form.paradaNome,
          genres: form.genres,
          lastfmUser: form.lastfmUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar.");
        return;
      }
      setSuccess("Dados atualizados com sucesso.");
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title="Configurações" subtitle="Edite seus dados de perfil">
      <div style={{ maxWidth: 760 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, textDecoration: "none", marginBottom: 14 }}>
          <ChevronLeft size={16} />
          Voltar
        </Link>

        {loading ? (
          <div style={{ color: "#86868B", fontSize: 14 }}>Carregando...</div>
        ) : (
          <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Nome</span>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>User</span>
              <input value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Bio</span>
              <textarea value={form.bio ?? ""} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={4} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14, resize: "vertical" }} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Nome da parada</span>
              <input value={form.paradaNome ?? ""} onChange={(e) => setForm((f) => ({ ...f, paradaNome: e.target.value }))} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Usuário Last.fm</span>
              <input
                value={form.lastfmUser ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, lastfmUser: e.target.value }))}
                placeholder="seu-usuario-lastfm"
                style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
              />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Gêneros</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ALL_GENRES.map((genre) => {
                  const active = form.genres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      style={{
                        padding: "10px 16px",
                        background: active ? "#1D1D1F" : "white",
                        color: active ? "white" : "#1D1D1F",
                        border: active ? "1px solid #1D1D1F" : "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 100,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 120ms",
                      }}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <div style={{ fontSize: 13, color: "#B91C1C" }}>{error}</div>}
            {success && <div style={{ fontSize: 13, color: "#166534" }}>{success}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  background: "#FA243C",
                  color: "white",
                  border: "none",
                  borderRadius: 100,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
