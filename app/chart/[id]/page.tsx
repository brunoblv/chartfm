"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronLeft, Heart, Repeat2, Share, Play, Star, MessageCircle,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { formatChartPeriod } from "@/lib/chart-week";
import type { ChartDetailPayload } from "@/lib/map-db-profile";
import { TIMELINE, SAMPLE_COMMENTS, USERS_DATA } from "@/lib/data";
import type { ChartEntry, TimelineItem, User } from "@/lib/types";

type Variant = "list" | "grid" | "podium";
type Tab = "chart" | "comments" | "overlap";

type ParadaNomeResponse = { paradaNome?: string | null };

export default function ChartDetailPage() {
  const params = useParams();
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  const { data: session } = useSession();
  const [phase, setPhase] = useState<"loading" | "ready" | "missing">("loading");
  const [dbPayload, setDbPayload] = useState<ChartDetailPayload | null>(null);
  const [mockItem, setMockItem] = useState<TimelineItem | null>(null);
  const [ownerParadaNome, setOwnerParadaNome] = useState<string | null>(null);

  const [variant, setVariant] = useState<Variant>("list");
  const [tab, setTab] = useState<Tab>("chart");
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!id) {
      setPhase("missing");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setDbPayload(null);
    setMockItem(null);
    (async () => {
      try {
        const res = await fetch(`/api/charts/${encodeURIComponent(id)}`);
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as ChartDetailPayload;
          setDbPayload(data);
          setMockItem(null);
          setPhase("ready");
          return;
        }
        const item = TIMELINE.find((t) => t.chart.id === id) ?? null;
        setDbPayload(null);
        setMockItem(item);
        setPhase(item ? "ready" : "missing");
      } catch {
        if (!cancelled) setPhase("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const user = dbPayload?.user ?? mockItem?.user;
  const chart = dbPayload?.chart ?? mockItem?.chart;
  const ownerImageUrl = dbPayload?.imageUrl ?? null;
  const personalNumberOnes = dbPayload?.personalNumberOnes ?? {};
  const globalNumberOnes = dbPayload?.globalNumberOnes ?? {};

  useEffect(() => {
    if (!user?.handle) return;
    let cancelled = false;
    const profileHandle = user.handle;
    (async () => {
      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(profileHandle)}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ParadaNomeResponse;
        const nome = typeof data.paradaNome === "string" && data.paradaNome.trim() ? data.paradaNome.trim() : null;
        if (!cancelled) setOwnerParadaNome(nome);
      } catch {
        if (!cancelled) setOwnerParadaNome(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.handle]);

  const composeUser = useMemo((): Pick<User, "name" | "avatar"> => {
    if (session?.user?.name) {
      return { name: session.user.name, avatar: "#FA243C" };
    }
    if (user) return { name: user.name, avatar: user.avatar };
    return { name: "Visitante", avatar: "#86868B" };
  }, [session?.user?.name, user]);

  const composeImageUrl = session?.user?.image ?? null;
  const tituloDetalheParada = `${ownerParadaNome ?? "Parada"} · Top ${chart?.entries.length ?? 0}`;

  if (phase === "loading") {
    return (
      <Shell title="" noPadding>
        <div style={{ padding: 48, color: "#86868B", fontSize: 15 }}>Carregando parada…</div>
      </Shell>
    );
  }

  if (phase === "missing" || !chart || !user) {
    return (
      <Shell title="Parada" subtitle="Não encontrada">
        <div style={{ maxWidth: 480, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Esta parada não existe ou foi removida.</p>
          <Link href="/" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar ao início
          </Link>
        </div>
      </Shell>
    );
  }

  const newCount = chart.entries.filter((e) => e.status === "new").length;
  const upCount = chart.entries.filter((e) => e.status === "up").length;
  const downCount = chart.entries.filter((e) => e.status === "down").length;
  const sameCount = chart.entries.filter((e) => e.status === "same").length;

  return (
    <Shell title="" noPadding>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(180deg, ${user.avatar}22 0%, transparent 100%)`,
        padding: "48px 40px 24px 40px",
      }}>
        <Link href={`/profile/${encodeURIComponent(user.handle)}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 24 }}>
          <ChevronLeft size={16} />
          Voltar para o perfil
        </Link>

        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Mosaic cover */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, width: 200, height: 200, borderRadius: 18, overflow: "hidden", flexShrink: 0, boxShadow: "0 16px 40px rgba(0,0,0,0.15)" }}>
            {chart.entries.slice(0, 4).map((e, i) => (
              <Cover key={i} cover={e.cover} song={e.song} size={98} rounded={0} />
            ))}
          </div>

          {/* Info block */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 8 }}>
              {tituloDetalheParada}
            </div>
            <div style={{ fontSize: 14, color: "#86868B", marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span>{formatChartPeriod(chart)}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Avatar user={user} imageUrl={ownerImageUrl ?? undefined} size={28} />
              <Link href={`/profile/${user.handle}`} style={{ fontSize: 14, fontWeight: 600, color: "#1D1D1F", textDecoration: "none" }}>
                {user.name}
              </Link>
              <span style={{ fontSize: 13, color: "#86868B" }}>@{user.handle}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 13, color: "#86868B" }}>
              <Heart size={14} />
              <span>{chart.likes + (liked ? 1 : 0)}</span>
              <MessageCircle size={14} style={{ marginLeft: 8 }} />
              <span>{chart.comments}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#FA243C", color: "white", border: "none",
                padding: "10px 20px", borderRadius: 100, fontSize: 14, fontWeight: 700,
                boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
              }}>
                <Play size={14} fill="white" />
                Ouvir no Spotify
              </button>
              <button
                onClick={() => setLiked(!liked)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: liked ? "#FDECEC" : "rgba(0,0,0,0.05)",
                  color: liked ? "#C5291C" : "#6B6B70",
                  border: "none", padding: "10px 16px", borderRadius: 100, fontSize: 14, fontWeight: 600,
                }}
              >
                <Heart size={16} fill={liked ? "currentColor" : "none"} />
                {liked ? "Curtido" : "Curtir"}
              </button>
              <button style={{ background: "rgba(0,0,0,0.05)", border: "none", padding: "10px 16px", borderRadius: 100, fontSize: 14, fontWeight: 600, color: "#6B6B70", display: "flex", gap: 6, alignItems: "center" }}>
                <Repeat2 size={16} />
                Repostar
              </button>
              <button style={{ background: "rgba(0,0,0,0.05)", border: "none", padding: "10px 16px", borderRadius: 100, fontSize: 14, fontWeight: 600, color: "#6B6B70", display: "flex", gap: 6, alignItems: "center" }}>
                <Share size={16} />
              </button>

              {/* Variant toggle */}
              <div style={{ marginLeft: "auto", display: "flex", background: "rgba(0,0,0,0.05)", borderRadius: 8, padding: 3, gap: 2 }}>
                {(["list", "grid", "podium"] as Variant[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVariant(v)}
                    style={{
                      padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600,
                      background: variant === v ? "white" : "transparent",
                      color: variant === v ? "#1D1D1F" : "#86868B",
                      boxShadow: variant === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      transition: "background 120ms",
                    }}
                  >
                    {v === "list" ? "Lista" : v === "grid" ? "Grade" : "Pódio"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 40px 80px 40px" }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: "rgba(0,0,0,0.06)", borderRadius: 14, overflow: "hidden", margin: "28px 0" }}>
        {[
          { label: "Novas entradas", value: newCount, color: "#1D1D1F" },
          { label: "Subiram", value: upCount, color: "#1B873F" },
          { label: "Caíram", value: downCount, color: "#C5291C" },
          { label: "Estabilizadas", value: sameCount, color: "#86868B" },
          { label: "Overlap global", value: "12%", color: "#FA243C" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "white", padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: 24 }}>
        {([["chart", "Parada"], ["comments", `Comentários (${chart.comments})`], ["overlap", "Quem tem em comum"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              fontSize: 15,
              fontWeight: tab === t ? 600 : 500,
              color: tab === t ? "#1D1D1F" : "#86868B",
              borderBottom: `2px solid ${tab === t ? "#FA243C" : "transparent"}`,
              marginBottom: -1,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "chart" && (
        <>
          {variant === "list" && <ClassicList entries={chart.entries} personalNumberOnes={personalNumberOnes} globalNumberOnes={globalNumberOnes} />}
          {variant === "grid" && <GridVariant entries={chart.entries} />}
          {variant === "podium" && <PodiumVariant entries={chart.entries} />}
        </>
      )}
      {tab === "comments" && (
        <CommentsTab chartId={chart.id} composeUser={composeUser} composeImageUrl={composeImageUrl} />
      )}
      {tab === "overlap" && <OverlapTab />}
      </div>
    </Shell>
  );
}

function ClassicList({ entries, personalNumberOnes, globalNumberOnes }: { entries: ChartEntry[]; personalNumberOnes?: Record<string, number>; globalNumberOnes?: Record<string, number> }) {
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "60px 64px 90px minmax(0,1fr) 80px 80px 60px 90px",
        gap: 0,
        padding: "0 20px",
        background: "rgba(0,0,0,0.02)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}>
        {["Pos", "", "Mudança", "Música", "Semana ant.", "Sem.", "Pico", "#1s"].map((h, i) => (
          <div key={i} style={{ padding: "10px 8px", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B" }}>{h}</div>
        ))}
      </div>
      {entries.map((e) => {
        const key = `${e.song.title}\0${e.song.artist}`;
        const personal = personalNumberOnes?.[key] ?? 0;
        const global = globalNumberOnes?.[key] ?? 0;
        return (
          <div
            key={e.position}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 64px 90px minmax(0,1fr) 80px 80px 60px 90px",
              alignItems: "center",
              padding: "8px 20px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              gap: 0,
            }}
          >
            <div style={{ fontSize: e.position <= 3 ? 28 : 20, fontWeight: 700, letterSpacing: "-0.04em", color: "#000000", fontVariantNumeric: "tabular-nums", textAlign: "right", paddingRight: 12 }}>
              {e.position}
            </div>
            <div style={{ padding: "4px 8px 4px 0" }}>
              <Cover cover={e.cover} song={e.song} size={48} rounded={8} />
            </div>
            <div style={{ padding: "0 8px" }}><MovementBadge status={e.status} delta={e.delta} /></div>
            <div style={{ minWidth: 0, padding: "0 12px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.song.title}</div>
              <div style={{ fontSize: 12, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.song.artist}</div>
              <div style={{ fontSize: 11, color: "#86868B" }}>{e.song.album}</div>
            </div>
            <div style={{ fontSize: 13, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
              {e.prevPos ?? "—"}
            </div>
            <div style={{ fontSize: 13, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{e.weeks}</div>
            <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", padding: "0 8px", display: "flex", alignItems: "center", gap: 3 }}>
              {e.peak === 1 && <Star size={12} color="#FA243C" fill="#FA243C" />}
              {e.peak}
            </div>
            <div style={{ padding: "0 8px" }}>
              {personal > 0 ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: "#000000", fontVariantNumeric: "tabular-nums" }}>{personal}x</div>
              ) : (
                <div style={{ fontSize: 13, color: "rgba(0,0,0,0.2)" }}>—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GridVariant({ entries }: { entries: ChartEntry[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 20 }}>
      {entries.map((e) => (
        <div key={e.position} style={{ borderRadius: 14, overflow: "hidden", background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ position: "relative", aspectRatio: "1" }}>
            <Cover cover={e.cover} song={e.song} size={0} rounded={0} style={{ width: "100%", minHeight: 180 }} />
            <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", color: "white", fontSize: 14, fontWeight: 700, padding: "3px 8px", borderRadius: 6, fontVariantNumeric: "tabular-nums" }}>
              #{e.position}
            </div>
            <div style={{ position: "absolute", top: 8, right: 8 }}>
              <MovementBadge status={e.status} delta={e.delta} compact />
            </div>
          </div>
          <div style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.song.title}</div>
            <div style={{ fontSize: 12, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.song.artist}</div>
            <div style={{ fontSize: 11, color: "#86868B", marginTop: 4 }}>Pico #{e.peak} · {e.weeks} sem.</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PodiumVariant({ entries }: { entries: ChartEntry[] }) {
  if (entries.length < 3) {
    return <ClassicList entries={entries} />;
  }
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const podiumOrder = [top3[1], top3[0], top3[2]];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 16, padding: "40px 0 60px 0" }}>
        {podiumOrder.map((e) => (
          <div key={e.position} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <Cover cover={e.cover} song={e.song} size={160} rounded={16} style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.18)" }} />
              <div style={{
                position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                width: 36, height: 36, borderRadius: "50%",
                background: "#000000",
                color: "#FFFFFF",
                display: "grid", placeItems: "center", fontSize: 15, fontWeight: 800,
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}>
                {e.position}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{e.song.title}</div>
              <div style={{ fontSize: 12, color: "#86868B" }}>{e.song.artist}</div>
            </div>
          </div>
        ))}
      </div>
      <ClassicList entries={rest} />
    </>
  );
}

function CommentsTab({
  chartId,
  composeUser,
  composeImageUrl,
}: {
  chartId: string;
  composeUser: Pick<User, "name" | "avatar">;
  composeImageUrl?: string | null;
}) {
  const [comment, setComment] = useState("");
  const reactions = ["🔥", "💯", "❤️", "🥲", "😅", "👀"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} data-chart-id={chartId}>
      {/* Compose */}
      <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Avatar user={composeUser} imageUrl={composeImageUrl ?? undefined} size={36} />
          <div style={{ flex: 1 }}>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escreva um comentário..."
              style={{
                width: "100%", border: "none", outline: "none", fontSize: 14,
                color: "#1D1D1F", resize: "none", padding: "8px 0",
                background: "transparent",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              {reactions.map((r) => (
                <button key={r} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: 2 }}>{r}</button>
              ))}
              <button style={{
                marginLeft: "auto",
                background: "#FA243C", color: "white", border: "none",
                padding: "8px 18px", borderRadius: 100, fontSize: 13, fontWeight: 700,
                boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
              }}>
                Comentar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments list */}
      {SAMPLE_COMMENTS.map((c, i) => (
        <div key={i} style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Avatar user={c.user} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{c.user.name}</span>
                <span style={{ fontSize: 12, color: "#86868B" }}>@{c.user.handle}</span>
                <span style={{ fontSize: 12, color: "#86868B", marginLeft: "auto" }}>{c.time}</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "#1D1D1F", marginBottom: 10 }}>{c.text}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#86868B", fontSize: 13, cursor: "pointer" }}>
                  <Heart size={14} />
                  {c.likes}
                </button>
                <button style={{ background: "none", border: "none", color: "#86868B", fontSize: 13, cursor: "pointer" }}>Responder</button>
                {c.reactions.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                    {c.reactions.map((r) => (
                      <span key={r} style={{
                        background: "rgba(0,0,0,0.04)", borderRadius: 12, padding: "2px 8px", fontSize: 12,
                      }}>{r}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OverlapTab() {
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      {USERS_DATA.slice(1, 6).map((u, i) => {
        const overlap = [78, 65, 54, 42, 30][i];
        return (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
            <Avatar user={u} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#FA243C" }}>{overlap}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${overlap}%`, height: "100%", background: "linear-gradient(90deg, #FA243C, #FF5858)", borderRadius: 3 }} />
              </div>
            </div>
            <button style={{ background: "#1D1D1F", color: "white", border: "none", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              Comparar
            </button>
          </div>
        );
      })}
    </div>
  );
}
