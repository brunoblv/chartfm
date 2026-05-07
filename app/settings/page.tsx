"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
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
  chartSize: number | null;
};

type Tab = "perfil" | "conta";

export default function SettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("perfil");
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
    chartSize: null,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
          chartSize: data.chartSize ?? null,
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
          chartSize: form.chartSize,
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

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/user/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error ?? "Erro ao excluir conta.");
        setDeleting(false);
        return;
      }
      await signOut({ redirect: false });
      router.replace("/");
    } catch {
      setDeleteError("Erro de conexão.");
      setDeleting(false);
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "perfil", label: "Perfil" },
    { id: "conta", label: "Conta" },
  ];

  return (
    <Shell title="Configurações" subtitle="Edite seus dados de perfil">
      <div style={{ maxWidth: 760 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#86868B",
            fontSize: 14,
            textDecoration: "none",
            marginBottom: 14,
          }}
        >
          <ChevronLeft size={16} />
          Voltar
        </Link>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 2,
            background: "rgba(0,0,0,0.05)",
            borderRadius: 12,
            padding: 4,
            marginBottom: 18,
            width: "fit-content",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "7px 20px",
                borderRadius: 9,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 120ms",
                background: tab === t.id ? "white" : "transparent",
                color: tab === t.id ? "#1D1D1F" : "#86868B",
                boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "#86868B", fontSize: 14 }}>Carregando...</div>
        ) : (
          <>
            {/* Aba Perfil */}
            {tab === "perfil" && (
              <div
                style={{
                  background: "white",
                  borderRadius: 18,
                  border: "1px solid rgba(0,0,0,0.06)",
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Nome</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>User</span>
                  <input
                    value={form.handle}
                    onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                    style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Bio</span>
                  <textarea
                    value={form.bio ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    rows={4}
                    style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14, resize: "vertical" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Nome da parada</span>
                  <input
                    value={form.paradaNome ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, paradaNome: e.target.value }))}
                    style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
                  />
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Usuário Last.fm</span>
                  <input
                    value={form.lastfmUser ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, lastfmUser: e.target.value }))}
                    placeholder="seu-usuario-lastfm"
                    style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
                  />
                  <span style={{ fontSize: 11, color: "#86868B" }}>
                    Necessário para importar suas músicas mais ouvidas do Last.fm.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Tamanho da parada</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={form.chartSize ?? ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setForm((f) => ({ ...f, chartSize: isNaN(v) ? null : Math.min(200, Math.max(1, v)) }));
                    }}
                    placeholder="Ex: 20"
                    style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14, width: "100%", boxSizing: "border-box" }}
                  />
                  <span style={{ fontSize: 11, color: "#86868B" }}>
                    Quantas músicas tem a sua parada (máx. 200). Ao publicar, só as primeiras N músicas são salvas.
                  </span>
                </div>

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

            {/* Aba Conta */}
            {tab === "conta" && (
              <div
                style={{
                  background: "white",
                  borderRadius: 18,
                  border: "1px solid rgba(0,0,0,0.06)",
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(185,28,28,0.18)",
                    background: "rgba(185,28,28,0.03)",
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#B91C1C", marginBottom: 4 }}>
                      Excluir conta
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.55 }}>
                      Ao excluir sua conta, todas as suas paradas, curtidas, comentários e demais dados serão
                      permanentemente removidos. Essa ação não pode ser desfeita.
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      style={{
                        background: "white",
                        color: "#B91C1C",
                        border: "1.5px solid rgba(185,28,28,0.35)",
                        borderRadius: 100,
                        padding: "9px 20px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Excluir minha conta
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de confirmação */}
      {showDeleteModal && (
        <div
          onClick={() => { if (!deleting) setShowDeleteModal(false); }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 20,
              padding: 28,
              maxWidth: 420,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1D1D1F" }}>
              Excluir conta?
            </div>
            <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
              Essa ação é <strong style={{ color: "#1D1D1F" }}>permanente e irreversível</strong>. Todos os seus dados —
              paradas, curtidas, comentários, seguidores e configurações — serão excluídos para sempre.
            </div>
            {deleteError && (
              <div style={{ fontSize: 13, color: "#B91C1C" }}>{deleteError}</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  background: "transparent",
                  color: "#1D1D1F",
                  border: "1px solid rgba(0,0,0,0.15)",
                  borderRadius: 100,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                style={{
                  background: "#B91C1C",
                  color: "white",
                  border: "none",
                  borderRadius: 100,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? "Excluindo..." : "Sim, excluir minha conta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
