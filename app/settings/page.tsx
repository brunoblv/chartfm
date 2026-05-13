"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronLeft, Camera, ImagePlus, Trash2 } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";

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
  twitterUser: string | null;
  instagramUser: string | null;
  chartSize: number | null;
  image: string | null;
  paradaLogo: string | null;
};

type Tab = "perfil" | "parada" | "conta";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
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
    twitterUser: "",
    instagramUser: "",
    chartSize: null,
    image: null,
    paradaLogo: null,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

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
          twitterUser: data.twitterUser ?? "",
          instagramUser: data.instagramUser ?? "",
          chartSize: data.chartSize ?? null,
          image: data.image ?? null,
          paradaLogo: data.paradaLogo ?? null,
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
          twitterUser: form.twitterUser,
          instagramUser: form.instagramUser,
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

  async function handleAvatarFile(file: File) {
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setAvatarError(data.error ?? "Erro ao enviar foto.");
        return;
      }
      setForm((f) => ({ ...f, image: data.url }));
    } catch {
      setAvatarError("Erro de conexão.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      if (!res.ok) {
        setAvatarError("Erro ao remover foto.");
        return;
      }
      setForm((f) => ({ ...f, image: null }));
    } catch {
      setAvatarError("Erro de conexão.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleLogoFile(file: File) {
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/user/parada-logo", { method: "POST", body: fd });
      if (!res.ok) {
        let message = "Erro ao enviar logo.";
        try {
          const data = await res.json();
          message = data.error ?? message;
        } catch {}
        setLogoError(message);
        return;
      }
      const data = await res.json();
      setForm((f) => ({ ...f, paradaLogo: data.url }));
    } catch {
      setLogoError("Erro de conexão. Tente novamente.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const res = await fetch("/api/user/parada-logo", { method: "DELETE" });
      if (!res.ok) {
        setLogoError("Erro ao remover logo.");
        return;
      }
      setForm((f) => ({ ...f, paradaLogo: null }));
    } catch {
      setLogoError("Erro de conexão.");
    } finally {
      setUploadingLogo(false);
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
    { id: "parada", label: "Parada" },
    { id: "conta", label: "Conta" },
  ];

  const avatarUser = { name: form.name || session?.user?.name || "?", avatar: "#FA243C" };

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
                {/* Avatar upload */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Foto de perfil</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <Avatar user={avatarUser} imageUrl={form.image} size={72} />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "#1D1D1F",
                          border: "2px solid white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: uploadingAvatar ? "not-allowed" : "pointer",
                          opacity: uploadingAvatar ? 0.6 : 1,
                        }}
                      >
                        <Camera size={12} color="white" />
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        style={{
                          background: "white",
                          border: "1px solid rgba(0,0,0,0.15)",
                          borderRadius: 100,
                          padding: "8px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: uploadingAvatar ? "not-allowed" : "pointer",
                          color: "#1D1D1F",
                          opacity: uploadingAvatar ? 0.6 : 1,
                        }}
                      >
                        {uploadingAvatar ? "Enviando..." : "Trocar foto"}
                      </button>
                      {form.image && (
                        <button
                          type="button"
                          onClick={removeAvatar}
                          disabled={uploadingAvatar}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: "4px 0",
                            fontSize: 12,
                            color: "#B91C1C",
                            cursor: uploadingAvatar ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            opacity: uploadingAvatar ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={12} />
                          Remover foto
                        </button>
                      )}
                    </div>
                  </div>
                  {avatarError && (
                    <span style={{ fontSize: 12, color: "#B91C1C" }}>{avatarError}</span>
                  )}
                  <span style={{ fontSize: 11, color: "#86868B" }}>
                    JPG, PNG ou WebP · máx. 5 MB
                  </span>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>

                <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />

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

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>Redes sociais</span>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>X (Twitter)</span>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#86868B", fontSize: 14, pointerEvents: "none" }}>@</span>
                      <input
                        value={form.twitterUser ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/^@/, "").trim();
                          const match = raw.match(/(?:x\.com|twitter\.com)\/([^/?#\s]+)/i);
                          setForm((f) => ({ ...f, twitterUser: match ? match[1] : e.target.value.replace(/^@/, "") }));
                        }}
                        placeholder="seu_usuario"
                        style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px 10px 28px", fontSize: 14, width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Instagram</span>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#86868B", fontSize: 14, pointerEvents: "none" }}>@</span>
                      <input
                        value={form.instagramUser ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/^@/, "").trim();
                          const match = raw.match(/instagram\.com\/([^/?#\s]+)/i);
                          setForm((f) => ({ ...f, instagramUser: match ? match[1] : e.target.value.replace(/^@/, "") }));
                        }}
                        placeholder="seu_usuario"
                        style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px 10px 28px", fontSize: 14, width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Last.fm</span>
                    <input
                      value={form.lastfmUser ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const match = raw.match(/last\.fm\/user\/([^/?#\s]+)/i);
                        setForm((f) => ({ ...f, lastfmUser: match ? match[1] : e.target.value }));
                      }}
                      placeholder="seu-usuario-lastfm"
                      style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
                    />
                    <span style={{ fontSize: 11, color: "#86868B" }}>
                      Cole o link do perfil ou só o nome de usuário — o usuário é extraído automaticamente.
                    </span>
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

            {/* Aba Parada */}
            {tab === "parada" && (
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
                {/* Logo da parada */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1D1D1F", marginBottom: 4 }}>
                      Logo da parada
                    </div>
                    <div style={{ fontSize: 13, color: "#86868B", lineHeight: 1.5 }}>
                      Aparece no lugar das 4 capas na página de detalhes da sua parada. Se não tiver um logo, as capas das músicas são exibidas automaticamente.
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                    {/* Preview quadrado */}
                    <div
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: 16,
                        overflow: "hidden",
                        flexShrink: 0,
                        border: "1px solid rgba(0,0,0,0.10)",
                        background: "rgba(0,0,0,0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    >
                      {form.paradaLogo ? (
                        <img
                          src={form.paradaLogo}
                          alt="Logo da parada"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#86868B" }}>
                          <ImagePlus size={28} strokeWidth={1.5} />
                          <span style={{ fontSize: 11, fontWeight: 500 }}>Sem logo</span>
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        style={{
                          background: "#1D1D1F",
                          color: "white",
                          border: "none",
                          borderRadius: 100,
                          padding: "10px 20px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: uploadingLogo ? "not-allowed" : "pointer",
                          opacity: uploadingLogo ? 0.6 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <ImagePlus size={14} />
                        {uploadingLogo ? "Enviando..." : form.paradaLogo ? "Trocar logo" : "Enviar logo"}
                      </button>
                      {form.paradaLogo && (
                        <button
                          type="button"
                          onClick={removeLogo}
                          disabled={uploadingLogo}
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(185,28,28,0.3)",
                            borderRadius: 100,
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#B91C1C",
                            cursor: uploadingLogo ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            opacity: uploadingLogo ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={13} />
                          Remover logo
                        </button>
                      )}
                      <span style={{ fontSize: 11, color: "#86868B", maxWidth: 220, lineHeight: 1.5 }}>
                        Use uma imagem quadrada para melhor resultado. JPG, PNG ou WebP · máx. 5 MB.
                      </span>
                    </div>
                  </div>

                  {logoError && (
                    <div style={{ fontSize: 13, color: "#B91C1C" }}>{logoError}</div>
                  )}

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>

                <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />

                {/* Nome da parada e tamanho — também aqui para conveniência */}
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Nome da parada</span>
                  <input
                    value={form.paradaNome ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, paradaNome: e.target.value }))}
                    style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
                  />
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B" }}>Tamanho da parada</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.chartSize ?? ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setForm((f) => ({ ...f, chartSize: isNaN(v) ? null : Math.min(100, Math.max(1, v)) }));
                    }}
                    placeholder="Ex: 20"
                    style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 14, width: "100%", boxSizing: "border-box" }}
                  />
                  <span style={{ fontSize: 11, color: "#86868B" }}>
                    Quantas músicas tem a sua parada (máx. 100). Ao publicar, só as primeiras N músicas são salvas.
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
