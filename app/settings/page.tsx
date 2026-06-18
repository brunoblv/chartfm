"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronLeft, Camera, ImagePlus, Trash2 } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useTranslations } from "@/hooks/useTranslations";
import { spotifyConnectErrorMessage } from "@/lib/spotify-connect-oauth";
import { isMyTrlOwner } from "@/lib/mytrl-access";

async function compressImage(file: File, maxBytes = 900 * 1024): Promise<File> {
  if (file.size <= maxBytes) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const scale = Math.min(1, Math.sqrt(maxBytes / file.size));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

const ALL_GENRES = [
  "Pop", "Indie", "Rock", "R&B", "Hip Hop",
  "Eletrônica", "Sertanejo", "Funk BR", "MPB", "Jazz",
  "Clássica", "Latina", "K-Pop", "Country", "Metal", "Reggae",
];

type ParadaDraft = {
  id: string;
  name: string;
  logo: string | null;
  isPrimary: boolean;
  genres: string[];
  sortOrder: number;
  chartSize: number | null;
  cadence: "weekly" | "daily";
};

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
  spotifyConnected?: boolean;
};

type Tab = "perfil" | "parada" | "conta";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canUseSpotifyImport = isMyTrlOwner(session?.user?.handle);
  const { t } = useTranslations();
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
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [disconnectingSpotify, setDisconnectingSpotify] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [paradaDrafts, setParadaDrafts] = useState<ParadaDraft[]>([]);
  const [canCreateParada, setCanCreateParada] = useState(true);
  const [logoUploadParadaId, setLogoUploadParadaId] = useState<string | null>(null);
  const [logoErrorByParada, setLogoErrorByParada] = useState<Record<string, string | null>>({});
  const [newParadaName, setNewParadaName] = useState("");
  const [newParadaCadence, setNewParadaCadence] = useState<"weekly" | "daily">("weekly");
  const [creatingParada, setCreatingParada] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [activeLogoParadaId, setActiveLogoParadaId] = useState<string | null>(null);

  async function loadParadas() {
    const res = await fetch("/api/user/paradas", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      paradas?: ParadaDraft[];
      canCreate?: boolean;
    };
    if (data.paradas?.length) {
      setParadaDrafts(
        [...data.paradas]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((p) => ({ ...p, cadence: p.cadence ?? "weekly" })),
      );
    }
    setCanCreateParada(data.canCreate !== false);
  }

  useEffect(() => {
    loadParadas().catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyParam = params.get("spotify");
    const spotifyReason = params.get("spotify_reason");
    if (spotifyParam === "connected") {
      setSuccess("Spotify conectado com sucesso!");
      window.history.replaceState({}, "", "/settings");
    } else if (spotifyParam) {
      setError(spotifyConnectErrorMessage(spotifyParam, spotifyReason) ?? "Erro ao conectar o Spotify. Tente novamente.");
      window.history.replaceState({}, "", "/settings");
    }

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
        setSpotifyConnected(data.spotifyConnected ?? false);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  function updateParadaDraft(
    paradaId: string,
    patch: Partial<Pick<ParadaDraft, "name" | "genres" | "chartSize" | "cadence">>,
  ) {
    setParadaDrafts((prev) =>
      prev.map((p) => (p.id === paradaId ? { ...p, ...patch } : p)),
    );
  }

  function toggleParadaGenre(paradaId: string, genre: string) {
    setParadaDrafts((prev) =>
      prev.map((p) => {
        if (p.id !== paradaId) return p;
        const genres = p.genres.includes(genre)
          ? p.genres.filter((g) => g !== genre)
          : [...p.genres, genre];
        return { ...p, genres };
      }),
    );
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const profileRes = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          handle: form.handle,
          bio: form.bio,
          lastfmUser: form.lastfmUser,
          twitterUser: form.twitterUser,
          instagramUser: form.instagramUser,
        }),
      });
      const data = await profileRes.json();
      if (!profileRes.ok) {
        setError(data.error ?? "Erro ao salvar.");
        return;
      }
      setSuccess("Perfil atualizado com sucesso.");
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  async function saveParadas() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      for (const p of paradaDrafts) {
        const trimmed = p.name.trim();
        if (trimmed.length < 2) {
          setError(`O nome da parada "${trimmed || "sem nome"}" precisa ter pelo menos 2 caracteres.`);
          return;
        }
      }

      const results = await Promise.all(
        paradaDrafts.map((p) =>
          fetch("/api/user/paradas", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paradaId: p.id,
              name: p.name.trim(),
              genres: p.genres,
              chartSize: p.chartSize,
              cadence: p.cadence,
            }),
          }),
        ),
      );

      for (const res of results) {
        if (!res.ok) {
          const pd = await res.json();
          setError(pd.error ?? "Erro ao salvar uma das paradas.");
          return;
        }
      }

      await loadParadas();
      setSuccess("Paradas atualizadas com sucesso.");
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  async function setAsPrimary(paradaId: string) {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/user/paradas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paradaId, setPrimary: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao definir parada principal.");
        return;
      }
      setParadaDrafts((prev) =>
        prev.map((p) => ({
          ...p,
          isPrimary: p.id === paradaId,
          cadence: p.id === paradaId ? "weekly" : p.cadence,
        })),
      );
      setSuccess("Parada principal atualizada.");
    } catch {
      setError("Erro de conexão.");
    }
  }

  async function createSecondParada() {
    const trimmed = newParadaName.trim();
    if (trimmed.length < 2) {
      setError("Informe um nome com pelo menos 2 caracteres para a segunda parada.");
      return;
    }
    setCreatingParada(true);
    setError(null);
    try {
      const res = await fetch("/api/user/paradas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, cadence: newParadaCadence }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar segunda parada.");
        return;
      }
      setNewParadaName("");
      setNewParadaCadence("weekly");
      await loadParadas();
      setSuccess("Segunda parada criada.");
    } catch {
      setError("Erro de conexão.");
    } finally {
      setCreatingParada(false);
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

  async function handleLogoFile(paradaId: string, file: File) {
    setLogoUploadParadaId(paradaId);
    setLogoErrorByParada((e) => ({ ...e, [paradaId]: null }));
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch(`/api/user/chart-logo?paradaId=${encodeURIComponent(paradaId)}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        let message = "Erro ao enviar logo.";
        try {
          const data = await res.json();
          message = data.error ?? message;
        } catch {}
        setLogoErrorByParada((e) => ({ ...e, [paradaId]: message }));
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        setParadaDrafts((prev) =>
          prev.map((p) => (p.id === paradaId ? { ...p, logo: data.url! } : p)),
        );
      }
    } catch {
      setLogoErrorByParada((e) => ({ ...e, [paradaId]: "Erro de conexão." }));
    } finally {
      setLogoUploadParadaId(null);
    }
  }

  async function removeLogo(paradaId: string) {
    setLogoUploadParadaId(paradaId);
    setLogoErrorByParada((e) => ({ ...e, [paradaId]: null }));
    try {
      const res = await fetch(`/api/user/chart-logo?paradaId=${encodeURIComponent(paradaId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setLogoErrorByParada((e) => ({ ...e, [paradaId]: "Erro ao remover logo." }));
        return;
      }
      setParadaDrafts((prev) =>
        prev.map((p) => (p.id === paradaId ? { ...p, logo: null } : p)),
      );
    } catch {
      setLogoErrorByParada((e) => ({ ...e, [paradaId]: "Erro de conexão." }));
    } finally {
      setLogoUploadParadaId(null);
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
    { id: "perfil", label: t("settings.tabProfile") },
    { id: "parada", label: t("settings.tabCharts") },
    { id: "conta", label: t("settings.tabAccount") },
  ];

  const avatarUser = { name: form.name || session?.user?.name || "?", avatar: "#FA243C" };

  return (
    <Shell title={t("settings.title")} subtitle={t("settings.subtitle")}>
      <div style={{ maxWidth: 760 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-muted)",
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
            background: "var(--fill-subtle)",
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
                background: tab === t.id ? "var(--surface-elevated)" : "transparent",
                color: tab === t.id ? "var(--text)" : "var(--text-muted)",
                boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.14)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Carregando...</div>
        ) : (
          <>
            {/* Aba Perfil */}
            {tab === "perfil" && (
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: 18,
                  border: "1px solid var(--divider)",
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {/* Avatar upload */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Foto de perfil</span>
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
                          background: "var(--btn-dark-bg)",
                          border: "2px solid var(--surface)",
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
                          background: "var(--surface)",
                          border: "1px solid var(--divider-strong)",
                          borderRadius: 100,
                          padding: "8px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: uploadingAvatar ? "not-allowed" : "pointer",
                          color: "var(--text)",
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
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
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

                <div style={{ height: 1, background: "var(--divider)" }} />

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Nome</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    style={{ border: "1px solid var(--divider-strong)", borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "var(--fill-subtle)", color: "var(--text)" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>User</span>
                  <input
                    value={form.handle}
                    onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                    style={{ border: "1px solid var(--divider-strong)", borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "var(--fill-subtle)", color: "var(--text)" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Bio</span>
                  <textarea
                    value={form.bio ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    rows={4}
                    style={{ border: "1px solid var(--divider-strong)", borderRadius: 10, padding: "10px 12px", fontSize: 14, resize: "vertical", background: "var(--fill-subtle)", color: "var(--text)" }}
                  />
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Redes sociais</span>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>X (Twitter)</span>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14, pointerEvents: "none" }}>@</span>
                      <input
                        value={form.twitterUser ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/^@/, "").trim();
                          const match = raw.match(/(?:x\.com|twitter\.com)\/([^/?#\s]+)/i);
                          setForm((f) => ({ ...f, twitterUser: match ? match[1] : e.target.value.replace(/^@/, "") }));
                        }}
                        placeholder="seu_usuario"
                        style={{ border: "1px solid var(--divider-strong)", borderRadius: 10, padding: "10px 12px 10px 28px", fontSize: 14, width: "100%", boxSizing: "border-box", background: "var(--fill-subtle)", color: "var(--text)" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Instagram</span>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14, pointerEvents: "none" }}>@</span>
                      <input
                        value={form.instagramUser ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/^@/, "").trim();
                          const match = raw.match(/instagram\.com\/([^/?#\s]+)/i);
                          setForm((f) => ({ ...f, instagramUser: match ? match[1] : e.target.value.replace(/^@/, "") }));
                        }}
                        placeholder="seu_usuario"
                        style={{ border: "1px solid var(--divider-strong)", borderRadius: 10, padding: "10px 12px 10px 28px", fontSize: 14, width: "100%", boxSizing: "border-box", background: "var(--fill-subtle)", color: "var(--text)" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Last.fm</span>
                    <input
                      value={form.lastfmUser ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const match = raw.match(/last\.fm\/user\/([^/?#\s]+)/i);
                        setForm((f) => ({ ...f, lastfmUser: match ? match[1] : e.target.value }));
                      }}
                      placeholder="seu-usuario-lastfm"
                      style={{ border: "1px solid var(--divider-strong)", borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "var(--fill-subtle)", color: "var(--text)" }}
                    />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Cole o link do perfil ou só o nome de usuário — o usuário é extraído automaticamente.
                    </span>
                  </div>

                  {canUseSpotifyImport && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Spotify</span>
                    {spotifyConnected ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, border: "1px solid rgba(30,215,96,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 14, background: "rgba(30,215,96,0.06)", color: "#1DB954", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>✓</span> Conta conectada
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            setDisconnectingSpotify(true);
                            try {
                              await fetch("/api/spotify/disconnect", { method: "POST" });
                              setSpotifyConnected(false);
                              setSuccess("Spotify desconectado.");
                            } catch {
                              setError("Erro ao desconectar o Spotify.");
                            } finally {
                              setDisconnectingSpotify(false);
                            }
                          }}
                          disabled={disconnectingSpotify}
                          style={{ border: "1px solid var(--divider-strong)", background: "var(--fill-subtle)", color: "var(--text-muted)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: disconnectingSpotify ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: disconnectingSpotify ? 0.6 : 1 }}
                        >
                          {disconnectingSpotify ? "Desconectando…" : "Desconectar"}
                        </button>
                      </div>
                    ) : (
                      <a
                        href="/api/spotify/connect"
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(30,215,96,0.35)", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, color: "#1DB954", background: "rgba(30,215,96,0.06)", textDecoration: "none" }}
                      >
                        <span style={{ fontSize: 16 }}>♪</span> Conectar Spotify
                      </a>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Permite importar músicas recentes e criar playlists das suas paradas no Spotify.
                    </span>
                  </div>
                  )}
                </div>

                {error && <div style={{ fontSize: 13, color: "#B91C1C" }}>{error}</div>}
                {success && <div style={{ fontSize: 13, color: "var(--up-fg)" }}>{success}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={saveProfile}
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
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {paradaDrafts.map((p) => {
                  const isUploading = logoUploadParadaId === p.id;
                  const logoErr = logoErrorByParada[p.id] ?? null;
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: "var(--surface)",
                        borderRadius: 18,
                        border: "1px solid var(--divider)",
                        padding: 22,
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: p.isPrimary ? "#FA243C" : "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                          }}
                        >
                          {p.isPrimary ? "Parada principal" : "Parada secundária"}
                        </span>
                        {!p.isPrimary && (
                          <button
                            type="button"
                            onClick={() => setAsPrimary(p.id)}
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "6px 14px",
                              borderRadius: 100,
                              border: "1px solid var(--divider-strong)",
                              background: "var(--surface)",
                              cursor: "pointer",
                              color: "var(--text)",
                            }}
                          >
                            Tornar principal
                          </button>
                        )}
                      </div>

                      {/* Logo */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                        <div
                          style={{
                            width: 88,
                            height: 88,
                            borderRadius: 14,
                            overflow: "hidden",
                            flexShrink: 0,
                            border: "1px solid var(--divider-strong)",
                            background: "var(--fill-inset)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {p.logo ? (
                            <img
                              src={p.logo}
                              alt="Logo"
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          ) : (
                            <ImagePlus size={24} strokeWidth={1.5} color="var(--text-muted)" />
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => { setActiveLogoParadaId(p.id); logoInputRef.current?.click(); }}
                            disabled={isUploading}
                            style={{
                              background: "var(--btn-dark-bg)",
                              color: "var(--btn-dark-fg)",
                              border: "none",
                              borderRadius: 100,
                              padding: "8px 16px",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: isUploading ? "not-allowed" : "pointer",
                              opacity: isUploading ? 0.6 : 1,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <ImagePlus size={13} />
                            {isUploading ? "Enviando..." : p.logo ? "Trocar logo" : "Enviar logo"}
                          </button>
                          {p.logo && (
                            <button
                              type="button"
                              onClick={() => removeLogo(p.id)}
                              disabled={isUploading}
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: "4px 0",
                                fontSize: 12,
                                color: "#B91C1C",
                                cursor: isUploading ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                opacity: isUploading ? 0.5 : 1,
                              }}
                            >
                              <Trash2 size={12} />
                              Remover logo
                            </button>
                          )}
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            JPG, PNG ou WebP · máx. 5 MB
                          </span>
                        </div>
                      </div>
                      {logoErr && <div style={{ fontSize: 12, color: "#B91C1C" }}>{logoErr}</div>}

                      {/* Nome */}
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Nome da parada</span>
                        <input
                          value={p.name}
                          onChange={(e) => updateParadaDraft(p.id, { name: e.target.value })}
                          style={{
                            border: "1px solid var(--divider-strong)",
                            borderRadius: 10,
                            padding: "10px 12px",
                            fontSize: 14,
                            background: "var(--fill-subtle)",
                            color: "var(--text)",
                          }}
                        />
                      </label>

                      {/* Gêneros */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Gêneros</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {ALL_GENRES.map((genre) => {
                            const active = p.genres.includes(genre);
                            return (
                              <button
                                key={genre}
                                type="button"
                                onClick={() => toggleParadaGenre(p.id, genre)}
                                style={{
                                  padding: "8px 14px",
                                  background: active ? "var(--btn-dark-bg)" : "var(--surface)",
                                  color: active ? "var(--btn-dark-fg)" : "var(--text)",
                                  border: active ? "1px solid var(--btn-dark-bg)" : "1px solid var(--divider-strong)",
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

                      {!p.isPrimary && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                            Frequência da parada
                          </span>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {([
                              { id: "weekly" as const, label: "Semanal" },
                              { id: "daily" as const, label: "Diária" },
                            ]).map(({ id, label }) => {
                              const active = (p.cadence ?? "weekly") === id;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => updateParadaDraft(p.id, { cadence: id })}
                                  style={{
                                    padding: "8px 16px",
                                    borderRadius: 100,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    background: active ? "var(--btn-dark-bg)" : "var(--surface)",
                                    color: active ? "var(--btn-dark-fg)" : "var(--text)",
                                    border: active ? "1px solid var(--btn-dark-bg)" : "1px solid var(--divider-strong)",
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Paradas diárias publicam uma lista por dia. Continuam fora do ranking global.
                          </span>
                        </div>
                      )}

                      {/* Tamanho */}
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Tamanho da parada</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={p.chartSize ?? ""}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            updateParadaDraft(p.id, { chartSize: isNaN(v) ? null : Math.min(100, Math.max(1, v)) });
                          }}
                          placeholder="Ex: 20"
                          style={{
                            border: "1px solid var(--divider-strong)",
                            borderRadius: 10,
                            padding: "10px 12px",
                            fontSize: 14,
                            width: "100%",
                            boxSizing: "border-box",
                            background: "var(--fill-subtle)",
                            color: "var(--text)",
                          }}
                        />
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          Quantas músicas tem esta parada (máx. 100). Ao publicar, só as primeiras N músicas são salvas.
                        </span>
                      </label>
                    </div>
                  );
                })}

                {/* Criar segunda parada */}
                {canCreateParada && paradaDrafts.length < 2 && (
                  <div
                    style={{
                      background: "var(--surface)",
                      borderRadius: 18,
                      border: "1px dashed var(--divider-strong)",
                      padding: 22,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                        Criar segunda parada
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        Você pode ter até 2 paradas. A secundária conta menos pontos (30→1 semanal, 6→1 diária) e não entra no ranking global. Escolha se ela será semanal ou diária.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {([
                        { id: "weekly" as const, label: "Semanal" },
                        { id: "daily" as const, label: "Diária" },
                      ]).map(({ id, label }) => {
                        const active = newParadaCadence === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setNewParadaCadence(id)}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 100,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              background: active ? "rgba(250,36,60,0.1)" : "var(--fill-subtle)",
                              color: active ? "#FA243C" : "var(--text-muted)",
                              border: active ? "1px solid rgba(250,36,60,0.35)" : "1px solid var(--divider-strong)",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={newParadaName}
                        onChange={(e) => setNewParadaName(e.target.value)}
                        placeholder="Nome da segunda parada"
                        style={{
                          flex: 1,
                          border: "1px solid var(--divider-strong)",
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 14,
                          background: "var(--fill-subtle)",
                          color: "var(--text)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={createSecondParada}
                        disabled={creatingParada}
                        style={{
                          background: "#FA243C",
                          color: "white",
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 18px",
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: creatingParada ? "not-allowed" : "pointer",
                          opacity: creatingParada ? 0.7 : 1,
                        }}
                      >
                        {creatingParada ? "Criando..." : "Criar"}
                      </button>
                    </div>
                  </div>
                )}

                {error && <div style={{ fontSize: 13, color: "#B91C1C" }}>{error}</div>}
                {success && <div style={{ fontSize: 13, color: "var(--up-fg)" }}>{success}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={saveParadas}
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

                {/* Input de logo compartilhado entre paradas */}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && activeLogoParadaId) handleLogoFile(activeLogoParadaId, file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {/* Aba Conta */}
            {tab === "conta" && (
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: 18,
                  border: "1px solid var(--divider)",
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid var(--divider)",
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                      {t("language.label")}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-subtle)", lineHeight: 1.55 }}>
                      {t("language.description")}
                    </div>
                  </div>
                  <LanguageSwitcher variant="settings" />
                </div>

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
                    <div style={{ fontSize: 13, color: "var(--text-subtle)", lineHeight: 1.55 }}>
                      Ao excluir sua conta, todas as suas paradas, curtidas, comentários e demais dados serão
                      permanentemente removidos. Essa ação não pode ser desfeita.
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      style={{
                        background: "var(--surface)",
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
              background: "var(--surface-elevated)",
              borderRadius: 20,
              padding: 28,
              maxWidth: 420,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              Excluir conta?
            </div>
            <div style={{ fontSize: 14, color: "var(--text-subtle)", lineHeight: 1.6 }}>
              Essa ação é <strong style={{ color: "var(--text)" }}>permanente e irreversível</strong>. Todos os seus dados —
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
                  color: "var(--text)",
                  border: "1px solid var(--divider-strong)",
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
