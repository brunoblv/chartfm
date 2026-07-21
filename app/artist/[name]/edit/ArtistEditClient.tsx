"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "@/hooks/useTranslations";

type ArtistEditInitial = {
  id: number;
  slug: string;
  name: string;
  spotifyId: string;
  romanization: string;
  imageUrl: string;
  bio: string;
};

export function ArtistEditClient({ initialArtist }: { initialArtist: ArtistEditInitial }) {
  const { t } = useTranslations();
  const [name, setName] = useState(initialArtist.name);
  const [spotifyId, setSpotifyId] = useState(initialArtist.spotifyId);
  const [romanization, setRomanization] = useState(initialArtist.romanization);
  const [imageUrl, setImageUrl] = useState(initialArtist.imageUrl);
  const [bio, setBio] = useState(initialArtist.bio);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => name.trim().length > 0 && spotifyId.trim().length > 0 && !saving, [name, spotifyId, saving]);

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/artist/${initialArtist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          spotifyId: spotifyId.trim(),
          romanization: romanization.trim(),
          imageUrl: imageUrl.trim(),
          bio: bio.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("artist.couldNotSave"));
        return;
      }
      setMessage(t("artist.artistUpdated"));
    } catch {
      setError(t("artist.saveConnError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>{t("artist.fieldName")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>{t("artist.fieldSpotifyId")}</span>
          <input value={spotifyId} onChange={(e) => setSpotifyId(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>{t("artist.fieldRomanization")}</span>
          <input value={romanization} onChange={(e) => setRomanization(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>{t("artist.fieldCoverUrl")}</span>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>{t("artist.fieldBio")}</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            placeholder={t("artist.bioPlaceholder")}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
          <button type="button" onClick={submit} disabled={!canSave} style={buttonStyle(canSave)}>
            {saving ? t("artist.saving") : t("artist.saveChanges")}
          </button>
          {message && <span style={{ color: "#0F9D58", fontSize: 13 }}>{message}</span>}
          {error && <span style={{ color: "#C5291C", fontSize: 13 }}>{error}</span>}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.08)", margin: "32px 0" }} />
      <ArtistCreateSection />
    </>
  );
}

function ArtistCreateSection() {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [spotifyId, setSpotifyId] = useState("");
  const [romanization, setRomanization] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => name.trim().length > 0 && spotifyId.trim().length > 0 && !saving, [name, spotifyId, saving]);

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          spotifyId: spotifyId.trim(),
          romanization: romanization.trim(),
          imageUrl: imageUrl.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; artist?: { name: string } };
      if (!res.ok) {
        setError(data.error === "spotify_id_already_exists" ? t("artist.spotifyIdExists") : (data.error ?? t("artist.couldNotCreate")));
        return;
      }
      setMessage(t("artist.artistCreatedSuccess", { name: data.artist?.name ?? "" }));
      setName("");
      setSpotifyId("");
      setRomanization("");
      setImageUrl("");
    } catch {
      setError(t("artist.createConnError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          background: "white",
          borderRadius: 10,
          padding: "9px 14px",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          color: "#1D1D1F",
        }}
      >
        {open ? t("artist.hideLabel") : t("artist.createNewArtist")}
      </button>

      {open && (
        <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>{t("artist.fieldNameRequired")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder={t("artist.artistNamePlaceholder")} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>{t("artist.fieldSpotifyIdRequired")}</span>
            <input value={spotifyId} onChange={(e) => setSpotifyId(e.target.value)} style={inputStyle} placeholder={t("artist.spotifyIdPlaceholder")} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>{t("artist.fieldRomanization")}</span>
            <input value={romanization} onChange={(e) => setRomanization(e.target.value)} style={inputStyle} placeholder={t("artist.romanizationPlaceholder")} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>{t("artist.fieldCoverUrl")}</span>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={inputStyle} placeholder={t("artist.coverUrlOptionalPlaceholder")} />
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={submit} disabled={!canSave} style={buttonStyle(canSave)}>
              {saving ? t("artist.creating") : t("artist.createArtist")}
            </button>
            {message && <span style={{ color: "#0F9D58", fontSize: 13 }}>{message}</span>}
            {error && <span style={{ color: "#C5291C", fontSize: 13 }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: CSSProperties = {
  border: "1px solid rgba(0,0,0,0.14)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  background: "#fff",
};

const buttonStyle = (enabled: boolean): CSSProperties => ({
  border: "none",
  background: "#FA243C",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  opacity: enabled ? 1 : 0.55,
  cursor: enabled ? "pointer" : "not-allowed",
});
