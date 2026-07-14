"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "@/app/copa/CopaArtistAvatar";
import { CopaArtistSinglesEditor } from "@/components/copa/CopaArtistSinglesEditor";
import { COPA_DAY_LABELS, COPA_PARTICIPANT_OPTIONS, COPA_SINGLES_COUNT, COPA_TOTAL_ARTISTS, COPA_TYPE_LABELS, COPA_TYPE_OPTIONS, SLOT_LABELS, applyCopaSingleMoveFromEditable, findDuplicateSongInSingles, mergeArtistSingles, votesToGoals, type CopaTypeOption } from "@/lib/copa";
import { readCopaSongDrag, slotDropKey, writeCopaSongDrag } from "@/lib/copa-song-dnd";
import { searchCopaSongs } from "@/lib/copa-song-search-client";
import { GripVertical } from "lucide-react";

type Edition = {
  id: string;
  name: string;
  year: number;
  status: string;
  type: string;
  startsAt: string | null;
  votesPerGoal: number;
  artistCount: number;
  fixtureCount: number;
  participants: { userId: string; name: string; handle: string; avatarColor: string }[];
};

type Fixture = {
  id: string;
  phase: string;
  groupLetter: string | null;
  round: number | null;
  matchIndex: number;
  day: number;
  status: string;
  votesA: number;
  votesB: number;
  artistA: { artistName: string; artistInitials: string; artistColor: string; artistImage: string | null };
  artistB: { artistName: string; artistInitials: string; artistColor: string; artistImage: string | null };
};

type SquadArtist = {
  id: string;
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
  groupLetter: string;
  singles: { slotIndex: number; songName: string; songId: string | null }[];
  lockedSlots: number[];
};

type SquadParticipant = {
  userId: string;
  name: string;
  handle: string;
  avatarColor: string;
  artistCount: number;
  singlesFilled: number;
  expectedSingles: number;
  isIncomplete: boolean;
  artists: SquadArtist[];
};

type ArtistMini = { artistName: string; artistInitials: string; artistColor: string; artistImage: string | null };

type ManualVoteData = {
  users: { userId: string; name: string; handle: string; avatarColor: string }[];
  fixtures: {
    id: string;
    phase: string;
    groupLetter: string | null;
    round: number | null;
    day: number;
    artistA: ArtistMini;
    artistB: ArtistMini;
  }[];
  existingVotes: Record<string, Record<string, "A" | "B">>;
};

type Props = {
  viewerHandle: string | null;
  manualVote: ManualVoteData | null;
  editions: Edition[];
  activeEditionId: string | null;
  activeVotesPerGoal: number;
  fixturesByStatus: { UPCOMING: number; LIVE: number; DONE: number } | null;
  knockoutControls: { r32Complete: boolean; hasR16: boolean } | null;
  activeFixtures: Fixture[];
};

const STATUS_LABELS: Record<string, string> = {
  REGISTRATION: "Inscrições",
  GROUP_STAGE: "Fase de Grupos",
  KNOCKOUT: "Eliminatória",
  FINISHED: "Encerrado",
};

const PHASE_LABELS: Record<string, string> = {
  GROUP: "GRP",
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  THIRD_PLACE: "3º",
  FINAL: "FIN",
};

export function CopaAdminClient({ viewerHandle, manualVote, editions, activeEditionId, activeVotesPerGoal, fixturesByStatus, knockoutControls, activeFixtures }: Props) {
  const router = useRouter();
  const isBruno = viewerHandle?.toLowerCase() === "bruno";
  const [tab, setTab] = useState<"manage" | "manual">("manage");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("Copa ChartFM");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMaxParticipants, setNewMaxParticipants] = useState(8);
  const [newType, setNewType] = useState<CopaTypeOption>("NORMAL");
  const [creating, setCreating] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [fixtureFilter, setFixtureFilter] = useState("ALL");
  const [dayFilter, setDayFilter] = useState<number | "ALL">("ALL");
  const [squadsEditionId, setSquadsEditionId] = useState<string | null>(null);
  const [squadsData, setSquadsData] = useState<{ artistsPerUser: number; squads: SquadParticipant[] } | null>(null);
  const [loadingSquads, setLoadingSquads] = useState(false);
  const [editArtist, setEditArtist] = useState<{ artistId: string; artistName: string; focusSlotIndex: number } | null>(null);
  const [slotDropOver, setSlotDropOver] = useState<string | null>(null);
  const [singleSearch, setSingleSearch] = useState("");
  const [singleResults, setSingleResults] = useState<{ id: string | null; title: string; artist: string; spotifyId?: string | null }[]>([]);
  const [savingSingle, setSavingSingle] = useState(false);
  const [notifyingIncomplete, setNotifyingIncomplete] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const startRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const votesPerGoalRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Aba de votos manuais (@bruno): seleção de lado por usuário e disputa.
  const [manualSel, setManualSel] = useState<Record<string, Record<string, "A" | "B" | "">>>(() => {
    const init: Record<string, Record<string, "A" | "B" | "">> = {};
    if (manualVote) {
      for (const u of manualVote.users) {
        const ev = manualVote.existingVotes[u.userId] ?? {};
        const row: Record<string, "A" | "B" | ""> = {};
        for (const f of manualVote.fixtures) row[f.id] = ev[f.id] ?? "";
        init[u.userId] = row;
      }
    }
    return init;
  });
  const [sendingUser, setSendingUser] = useState<string | null>(null);

  function setManual(userId: string, fixtureId: string, side: "A" | "B" | "") {
    setManualSel((prev) => ({ ...prev, [userId]: { ...(prev[userId] ?? {}), [fixtureId]: side } }));
  }

  function randomizeUser(userId: string) {
    if (!manualVote) return;
    const ev = manualVote.existingVotes[userId] ?? {};
    setManualSel((prev) => {
      const row = { ...(prev[userId] ?? {}) };
      for (const f of manualVote.fixtures) {
        if (ev[f.id]) continue; // já votou nesta disputa — mantém
        row[f.id] = Math.random() < 0.5 ? "A" : "B";
      }
      return { ...prev, [userId]: row };
    });
  }

  async function sendManualVotes(userId: string) {
    if (!manualVote || !activeEditionId || sendingUser) return;
    const ev = manualVote.existingVotes[userId] ?? {};
    const row = manualSel[userId] ?? {};
    const votes = manualVote.fixtures
      .filter((f) => !ev[f.id] && (row[f.id] === "A" || row[f.id] === "B"))
      .map((f) => ({ fixtureId: f.id, side: row[f.id] as "A" | "B" }));
    if (votes.length === 0) {
      alert("Selecione ao menos uma opção em uma disputa ainda não votada.");
      return;
    }
    setSendingUser(userId);
    try {
      const res = await fetch(`/api/admin/copa/${activeEditionId}/manual-votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, votes }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Erro ao enviar votos");
        return;
      }
      alert(`Votos registrados: ${json.created}` + (json.skipped ? ` · ignorados: ${json.skipped}` : ""));
      router.refresh();
    } finally {
      setSendingUser(null);
    }
  }

  // ISO (UTC) → valor de <input datetime-local> no fuso do navegador.
  function toLocalInput(iso: string): string {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  async function saveStart(copaId: string) {
    const value = startRefs.current[copaId]?.value;
    setActioning("set_start" + copaId);
    try {
      // datetime-local (hora local) → instante UTC.
      const startsAt = value ? new Date(value).toISOString() : null;
      const res = await fetch(`/api/admin/copa/${copaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_start", startsAt }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erro");
        return;
      }
      router.refresh();
    } finally {
      setActioning(null);
    }
  }

  async function saveVotesPerGoal(copaId: string) {
    const raw = votesPerGoalRefs.current[copaId]?.value;
    const votesPerGoal = Number(raw);
    if (!Number.isFinite(votesPerGoal) || votesPerGoal < 1 || !Number.isInteger(votesPerGoal)) {
      alert("Informe um número inteiro de votos por gol (mínimo 1).");
      return;
    }
    setActioning("set_votes_per_goal" + copaId);
    try {
      const res = await fetch(`/api/admin/copa/${copaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_votes_per_goal", votesPerGoal }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Erro ao salvar votos por gol");
        return;
      }
      alert(`Placar atualizado: ${votesPerGoal} ${votesPerGoal === 1 ? "voto" : "votos"} = 1 gol.`);
      router.refresh();
    } finally {
      setActioning(null);
    }
  }

  async function createCopa() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/copa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, year: newYear, maxParticipants: newMaxParticipants, type: newType }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erro ao criar Copa");
        return;
      }
      setShowCreate(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function editionAction(copaId: string, action: string, extra?: Record<string, unknown>) {
    setActioning(action);
    try {
      const res = await fetch(`/api/admin/copa/${copaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erro");
        return;
      }
      if (action === "realign_live") {
        const json = await res.json();
        alert(
          `Fase ao vivo alinhada.\n\n` +
            `Oitavas prematuras removidas: ${json.removedPrematureFixtures}\n` +
            `Jogos 1/16 abertos ao vivo: ${json.openedLiveFixtures}\n` +
            (json.closedPrematureR32Batch
              ? `2ª rodada 1/16 fechada (mantida p/ próximo dia): ${json.closedPrematureR32Batch}\n`
              : ""),
        );
      }
      if (action === "repair_knockout") {
        const json = await res.json();
        alert(
          `Mata-mata atualizado.\n\n` +
            (json.fixedGroupPhases ? `Grupos corrigidos: ${json.fixedGroupPhases}\n` : "") +
            (json.migratedR16Fixtures ? `Oitavas migradas p/ slot 4: ${json.migratedR16Fixtures}\n` : "") +
            (json.revertedLiveR16Fixtures ? `Oitavas ao vivo corrigidas (slot 3): ${json.revertedLiveR16Fixtures}\n` : "") +
            `Oitavas preservadas: ${json.preservedR16Fixtures}\n` +
            `Novos jogos 1/16 (32 avos): ${json.r32Fixtures}\n\n` +
            `Peça aos participantes que definam a música do slot 1/16 de Final em Meu Time.`,
        );
      }
      if (action === "fix_group_phases") {
        const json = await res.json();
        alert(
          json.fixedGroupPhases
            ? `${json.fixedGroupPhases} jogo(s) de grupos corrigidos de R16 → GROUP.`
            : "Nenhum jogo de grupos com phase errada.",
        );
      }
      if (action === "reset_r16") {
        const json = await res.json();
        alert(
          `Oitavas removidas.\n\n` +
            `Jogos apagados: ${json.deletedFixtures}\n` +
            `Votos removidos: ${json.deletedVotes}\n` +
            `Classificados (podem editar): ${json.competingArtists}\n\n` +
            `Peça aos participantes que ajustem a música das oitavas (slot 4) em Meu Time.`,
        );
      }
      if (action === "start_r16") {
        const json = await res.json();
        alert(
          `Oitavas iniciadas.\n\n` +
            `Jogos criados: ${json.created}\n` +
            `Abertos ao vivo: ${json.opened}\n\n` +
            `Chaveamento: O1=J1×J3, O2=J2×J4, … (vencedores do 1/16).`,
        );
      }
      router.refresh();
    } finally {
      setActioning(null);
    }
  }

  async function seedTestArtists(copaId: string) {
    if (!confirm("Cadastrar 7 artistas aleatórios (Global 100, ≥8 singles) para o bot de teste?")) return;
    setActioning("seed-test-artists");
    try {
      const res = await fetch(`/api/admin/copa/${copaId}/seed-test-artists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Erro ao cadastrar artistas de teste");
        return;
      }
      const names = (json.artists as { name: string }[]).map((a) => a.name).join(", ");
      alert(`Cadastrados para @${json.ownerHandle}: ${names}`);
      router.refresh();
    } finally {
      setActioning(null);
    }
  }

  async function loadSquads(copaId: string) {
    if (squadsEditionId === copaId && squadsData) {
      setSquadsEditionId(null);
      setSquadsData(null);
      return;
    }
    setLoadingSquads(true);
    setSquadsEditionId(copaId);
    try {
      const res = await fetch(`/api/admin/copa/${copaId}/squads`);
      if (!res.ok) {
        alert("Erro ao carregar escolhas");
        setSquadsEditionId(null);
        return;
      }
      const json = await res.json();
      setSquadsData({ artistsPerUser: json.artistsPerUser, squads: json.squads });
    } finally {
      setLoadingSquads(false);
    }
  }

  async function notifyIncompleteSingles(copaId: string, copaName: string) {
    const incomplete = squadsData?.squads.filter((s) => s.isIncomplete).length ?? 0;
    if (incomplete === 0) {
      alert("Todos os inscritos já completaram artistas e músicas.");
      return;
    }
    if (!confirm(`Enviar aviso no sino para ${incomplete} participante(s) com pendências na ${copaName}?`)) return;

    setNotifyingIncomplete(true);
    setNotifyMessage(null);
    try {
      const res = await fetch(`/api/admin/copa/${copaId}/notify-incomplete-singles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Faltam músicas no seu time da ${copaName}! Acesse Meu Time e complete as 8 músicas de cada artista.`,
        }),
      });
      const json = (await res.json()) as { error?: string; message?: string; sent?: number };
      if (!res.ok) {
        alert(json.error ?? "Não foi possível enviar.");
        return;
      }
      setNotifyMessage(json.message ?? `Aviso enviado para ${json.sent} participante(s).`);
    } finally {
      setNotifyingIncomplete(false);
    }
  }

  async function searchSongs(q: string, artistName: string) {
    setSingleSearch(q);
    if (!q.trim()) { setSingleResults([]); return; }
    const results = await searchCopaSongs(q, artistName);
    setSingleResults(results);
  }

  async function saveAdminSingle(
    artistId: string,
    slotIndex: number,
    songName: string,
    songId: string | null,
  ): Promise<boolean> {
    if (!squadsEditionId || savingSingle) return false;
    setSavingSingle(true);
    try {
      const res = await fetch(`/api/admin/copa/${squadsEditionId}/singles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          slotIndex,
          songName,
          songId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Erro ao salvar");
        return false;
      }
      setSquadsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          squads: prev.squads.map((p) => {
            const artists = p.artists.map((a) => {
              if (a.id !== artistId) return a;
              const others = a.singles.filter((s) => s.slotIndex !== slotIndex);
              return {
                ...a,
                singles: [...others, { slotIndex, songName, songId }].sort(
                  (x, y) => x.slotIndex - y.slotIndex,
                ),
              };
            });
            const singlesFilled = artists.reduce((n, a) => n + a.singles.length, 0);
            return { ...p, artists, singlesFilled };
          }),
        };
      });
      return true;
    } finally {
      setSavingSingle(false);
    }
  }

  function getSquadArtist(artistId: string) {
    if (!squadsData) return null;
    for (const p of squadsData.squads) {
      const art = p.artists.find((a) => a.id === artistId);
      if (art) return art;
    }
    return null;
  }

  async function assignAdminSingle(
    artistId: string,
    slotIndex: number,
    songName: string,
    songId: string | null,
    spotifySongId?: string | null,
  ) {
    const art = getSquadArtist(artistId);
    if (!art || art.lockedSlots.includes(slotIndex) || !squadsEditionId || savingSingle) return false;
    const lockedIndexes = new Set(art.lockedSlots);
    const validationOpts = art.lockedSlots.length > 0 ? { lockedSlotIndexes: lockedIndexes } : undefined;
    const merged = applyCopaSingleMoveFromEditable(art.singles, slotIndex, songName, songId, lockedIndexes);
    const dupErr = findDuplicateSongInSingles(merged, validationOpts);
    if (dupErr) {
      alert(dupErr);
      return false;
    }

    const prevBySlot = new Map(art.singles.map((s) => [s.slotIndex, s]));
    const changed = merged.filter((s) => {
      const prev = prevBySlot.get(s.slotIndex);
      return !prev || prev.songName !== s.songName || (prev.songId ?? null) !== s.songId;
    });
    if (changed.length === 0) return true;

    setSavingSingle(true);
    try {
      const resolvedBySlot = new Map<number, string | null>();
      for (const s of changed) {
        const res = await fetch(`/api/admin/copa/${squadsEditionId}/singles`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artistId,
            slotIndex: s.slotIndex,
            songName: s.songName,
            songId: s.songId,
            spotifySongId: s.slotIndex === slotIndex ? spotifySongId ?? null : null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error ?? "Erro ao salvar");
          return false;
        }
        const json = await res.json();
        resolvedBySlot.set(s.slotIndex, json.single?.songId ?? s.songId);
      }
      setSquadsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          squads: prev.squads.map((p) => {
            const artists = p.artists.map((a) => {
              if (a.id !== artistId) return a;
              return {
                ...a,
                singles: merged.map((s) => ({
                  slotIndex: s.slotIndex,
                  songName: s.songName,
                  songId: resolvedBySlot.has(s.slotIndex) ? (resolvedBySlot.get(s.slotIndex) ?? null) : s.songId,
                })),
              };
            });
            const singlesFilled = artists.reduce((n, a) => n + a.singles.filter((s) => !s.songName.startsWith("Single ")).length, 0);
            return { ...p, artists, singlesFilled };
          }),
        };
      });
      return true;
    } finally {
      setSavingSingle(false);
    }
  }

  async function swapAdminSingles(artistId: string, fromSlotIndex: number, toSlotIndex: number) {
    const art = getSquadArtist(artistId);
    if (!art) return false;
    if (art.lockedSlots.includes(fromSlotIndex) || art.lockedSlots.includes(toSlotIndex)) {
      alert("Um ou mais slots estão disputados.");
      return false;
    }
    const pick = (slotIndex: number) => {
      const s = art.singles.find((x) => x.slotIndex === slotIndex);
      return s ?? { slotIndex, songName: `Single ${slotIndex + 1}`, songId: null };
    };
    const from = pick(fromSlotIndex);
    const to = pick(toSlotIndex);
    const merged = mergeArtistSingles(art.singles, [
      { slotIndex: fromSlotIndex, songName: to.songName, songId: to.songId },
      { slotIndex: toSlotIndex, songName: from.songName, songId: from.songId },
    ]);
    const validationOpts = art.lockedSlots.length > 0 ? { lockedSlotIndexes: new Set(art.lockedSlots) } : undefined;
    const dupErr = findDuplicateSongInSingles(merged, validationOpts);
    if (dupErr) {
      alert(dupErr);
      return false;
    }
    const ok1 = await saveAdminSingle(artistId, fromSlotIndex, to.songName, to.songId);
    if (!ok1) return false;
    return saveAdminSingle(artistId, toSlotIndex, from.songName, from.songId);
  }

  async function handleAdminSlotDrop(artistId: string, slotIndex: number, e: React.DragEvent) {
    e.preventDefault();
    setSlotDropOver(null);
    const payload = readCopaSongDrag(e);
    if (!payload) return;
    if (payload.fromArtistId === artistId && payload.fromSlotIndex != null && payload.fromSlotIndex !== slotIndex) {
      await swapAdminSingles(artistId, payload.fromSlotIndex, slotIndex);
      return;
    }
    await assignAdminSingle(artistId, slotIndex, payload.title, payload.songId, payload.spotifyId);
  }

  function closeAdminEditor() {
    setEditArtist(null);
    setSingleSearch("");
    setSingleResults([]);
  }

  async function setFixtureStatus(fixtureId: string, status: "UPCOMING" | "LIVE" | "DONE") {
    if (!activeEditionId) return;
    setActioning(fixtureId + status);
    try {
      const res = await fetch(`/api/admin/copa/${activeEditionId}/fixtures/${fixtureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { alert("Erro"); return; }
      router.refresh();
    } finally {
      setActioning(null);
    }
  }

  const availableDays = [...new Set(activeFixtures.map((f) => f.day))].sort((a, b) => a - b);
  const filteredFixtures = activeFixtures.filter((f) => {
    const matchStatusPhase =
      fixtureFilter === "ALL" ? true :
      fixtureFilter === "LIVE" ? f.status === "LIVE" :
      fixtureFilter === "UPCOMING" ? f.status === "UPCOMING" :
      f.phase === fixtureFilter;
    const matchDay = dayFilter === "ALL" ? true : f.day === dayFilter;
    return matchStatusPhase && matchDay;
  });

  return (
    <>
      {isBruno && (
        <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid var(--divider)" }}>
          {([["manage", "Gerenciar"], ["manual", "Votos manuais"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer",
                fontSize: 14, fontWeight: 700,
                color: tab === key ? "var(--text)" : "var(--text-muted)",
                borderBottom: `2px solid ${tab === key ? "#FFD426" : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isBruno && tab === "manual" ? (
        <ManualVotePanel
          manualVote={manualVote}
          manualSel={manualSel}
          sendingUser={sendingUser}
          onSelect={setManual}
          onRandomize={randomizeUser}
          onSend={sendManualVotes}
        />
      ) : (
      <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <button
          onClick={() => setShowCreate(true)}
          style={{ background: "#FFD426", color: "#000", border: "none", padding: "10px 18px", borderRadius: 99, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          + Nova Copa
        </button>
      </div>

      {/* Editions list */}
      {editions.map((e) => (
        <div key={e.id} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14, padding: "18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                {e.name} {e.year}
                {e.type === "PUSH" && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(255,212,38,.12)", color: "#FFD426" }}>
                    Push
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                {STATUS_LABELS[e.status]} · {e.artistCount} artistas · {e.fixtureCount} jogos
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em",
              background: e.status === "GROUP_STAGE" ? "rgba(52,199,89,.12)" : e.status === "REGISTRATION" ? "rgba(255,212,38,.12)" : "var(--fill-inset)",
              color: e.status === "GROUP_STAGE" ? "#34C759" : e.status === "REGISTRATION" ? "#FFD426" : "var(--text-muted)",
            }}>
              {STATUS_LABELS[e.status]}
            </span>
          </div>

          {/* Participants */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {e.participants.map((p) => (
              <span key={p.userId} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "var(--fill-inset)", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: p.avatarColor, display: "inline-block" }} />
                {p.name}
              </span>
            ))}
          </div>

          {/* Participant choices */}
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={() => loadSquads(e.id)}
              disabled={loadingSquads}
              style={{
                padding: "10px 16px", borderRadius: 8, border: "none",
                background: squadsEditionId === e.id ? "var(--fill-inset)" : "#FFD426",
                color: squadsEditionId === e.id ? "var(--text-muted)" : "#000",
                fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loadingSquads ? 0.5 : 1,
              }}
            >
              {loadingSquads && squadsEditionId === e.id
                ? "Carregando escolhas…"
                : squadsEditionId === e.id
                  ? "Ocultar escolhas"
                  : "Gerenciar escolhas dos participantes"}
            </button>
          </div>

          {squadsEditionId === e.id && squadsData && (
            <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "0 2px" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", flex: 1, minWidth: 200 }}>
                  Use o botão <strong style={{ color: "var(--text)" }}>Editar</strong> ao lado de cada música para corrigir a escolha do participante.
                </div>
                {(() => {
                  const incompleteCount = squadsData.squads.filter((s) => s.isIncomplete).length;
                  return (
                    <>
                      {incompleteCount > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#C5291C" }}>
                          {incompleteCount} com pendências
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={notifyingIncomplete || incompleteCount === 0}
                        onClick={() => notifyIncompleteSingles(e.id, e.name)}
                        style={{
                          border: "none",
                          background: incompleteCount === 0 ? "var(--fill-inset)" : "#FA243C",
                          color: incompleteCount === 0 ? "var(--text-muted)" : "#fff",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: notifyingIncomplete || incompleteCount === 0 ? "not-allowed" : "pointer",
                          opacity: notifyingIncomplete ? 0.7 : 1,
                        }}
                      >
                        {notifyingIncomplete ? "Enviando…" : "Avisar incompletos"}
                      </button>
                    </>
                  );
                })()}
              </div>
              {notifyMessage && squadsEditionId === e.id && (
                <div style={{ fontSize: 12, color: "#0F9D58", padding: "0 2px" }}>{notifyMessage}</div>
              )}
              {squadsData.squads.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px", background: "var(--fill-inset)", borderRadius: 10 }}>
                  Nenhum participante inscrito.
                </div>
              ) : squadsData.squads.map((p) => {
                const expectedSingles = p.expectedSingles ?? p.artistCount * COPA_SINGLES_COUNT;
                return (
                  <div key={p.userId} style={{ background: "var(--fill-inset)", borderRadius: 12, overflow: "hidden", border: p.isIncomplete ? "1px solid rgba(197,41,28,0.35)" : undefined }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--divider)" }}>
                      <span style={{ width: 28, height: 28, borderRadius: "50%", background: p.avatarColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: p.isIncomplete ? "#C5291C" : "var(--text-muted)", marginTop: 2 }}>
                          @{p.handle} · {p.artistCount}/{squadsData.artistsPerUser} artistas · {p.singlesFilled}/{expectedSingles || "—"} músicas
                          {p.isIncomplete ? " · incompleto" : ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {p.artists.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum artista cadastrado.</div>
                      ) : p.artists.map((art) => (
                        <div key={art.id} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                            <CopaArtistAvatar {...art} size={32} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 800 }}>{art.artistName}</div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                {art.groupLetter !== "?" ? `Grupo ${art.groupLetter}` : "Aguardando sorteio"}
                              </div>
                            </div>
                          </div>
                          {Array.from({ length: COPA_SINGLES_COUNT }, (_, i) => {
                            const single = art.singles.find((s) => s.slotIndex === i);
                            const isLocked = art.lockedSlots.includes(i);
                            const isEmpty = !single || single.songName.startsWith("Single ");
                            const dropKey = slotDropKey(art.id, i);
                            const dropHighlight = slotDropOver === dropKey;
                            const canDrag = !isLocked && !isEmpty && !savingSingle;
                            return (
                              <div
                                key={i}
                                draggable={canDrag}
                                onDragStart={(e) => {
                                  if (!canDrag || !single) {
                                    e.preventDefault();
                                    return;
                                  }
                                  writeCopaSongDrag(e, {
                                    title: single.songName,
                                    songId: single.songId,
                                    fromArtistId: art.id,
                                    fromSlotIndex: i,
                                  });
                                }}
                                onDragEnd={() => setSlotDropOver(null)}
                                onDragOver={(e) => {
                                  if (isLocked) return;
                                  e.preventDefault();
                                  setSlotDropOver(dropKey);
                                }}
                                onDragLeave={() => setSlotDropOver((prev) => (prev === dropKey ? null : prev))}
                                onDrop={(e) => handleAdminSlotDrop(art.id, i, e)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
                                  borderTop: "1px solid var(--divider)", fontSize: 12,
                                  background: dropHighlight ? "rgba(52,199,89,.08)" : undefined,
                                  cursor: canDrag ? "grab" : isLocked ? "default" : "copy",
                                }}
                              >
                                {canDrag ? (
                                  <GripVertical size={12} color="var(--text-disabled)" style={{ flexShrink: 0 }} />
                                ) : (
                                  <span style={{ width: 12, flexShrink: 0 }} />
                                )}
                                <span style={{ width: 16, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", flexShrink: 0 }}>
                                  {i + 1}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-disabled)", marginBottom: 1 }}>
                                    {SLOT_LABELS[i]}
                                  </div>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: isEmpty ? "var(--text-disabled)" : "var(--text)",
                                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    }}
                                  >
                                    {isEmpty ? "— não definida" : single!.songName}
                                  </div>
                                </div>
                                {isLocked && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: "var(--fill-inset)", color: "var(--text-muted)", flexShrink: 0 }}>
                                    Disputado
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditArtist({ artistId: art.id, artistName: art.artistName, focusSlotIndex: i });
                                    setSingleSearch(single && !isEmpty ? single.songName : "");
                                    setSingleResults([]);
                                  }}
                                  style={{
                                    flexShrink: 0,
                                    padding: "5px 10px",
                                    borderRadius: 6,
                                    border: "none",
                                    background: "#FFD426",
                                    color: "#000",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Editar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats */}
          {e.id === activeEditionId && fixturesByStatus && (
            <div style={{ display: "flex", gap: 16, marginBottom: 14, padding: "12px", background: "var(--fill-inset)", borderRadius: 10 }}>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{fixturesByStatus.UPCOMING}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Em breve</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: "#FA243C" }}>{fixturesByStatus.LIVE}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Ao vivo</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: "#34C759" }}>{fixturesByStatus.DONE}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Encerrados</div></div>
            </div>
          )}

          {/* Start date / time */}
          {e.status !== "FINISHED" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14, padding: "12px", background: "var(--fill-inset)", borderRadius: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>📅 Início (data e hora dos jogos):</span>
              <input
                type="datetime-local"
                defaultValue={e.startsAt ? toLocalInput(e.startsAt) : ""}
                ref={(el) => { startRefs.current[e.id] = el; }}
                style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 13 }}
              />
              <button
                onClick={() => saveStart(e.id)}
                disabled={!!actioning}
                style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#FFD426", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                Salvar
              </button>
              <span style={{ fontSize: 11, color: "var(--text-disabled)", width: "100%" }}>
                A partir dessa data/hora os jogos abrem e avançam 1 dia por vez automaticamente (Dia 1 → grupos · … · Dia 12 → final). Deixe vazio para controle manual (botão Avançar Dia).
              </span>
            </div>
          )}

          {/* Votes per goal */}
          {e.status !== "FINISHED" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14, padding: "12px", background: "var(--fill-inset)", borderRadius: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>⚽ Votos por gol:</span>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                defaultValue={e.votesPerGoal}
                ref={(el) => { votesPerGoalRefs.current[e.id] = el; }}
                style={{ width: 72, background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 13 }}
              />
              <button
                onClick={() => saveVotesPerGoal(e.id)}
                disabled={!!actioning}
                style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#FFD426", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                Salvar
              </button>
              <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>
                Quantos votos equivalem a 1 gol no placar. Pode ser alterado a qualquer momento — o placar recalcula na hora.
              </span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {e.status === "REGISTRATION" && (
              <>
                <button
                  onClick={() => seedTestArtists(e.id)}
                  disabled={!!actioning}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--fill-inset)", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
                >
                  + 7 artistas de teste
                </button>
                <button
                  onClick={() => editionAction(e.id, "draw_groups")}
                  disabled={!!actioning}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#FFD426", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
                >
                  🎲 Sortear Grupos
                </button>
                <button
                  onClick={() => editionAction(e.id, "start_group_stage")}
                  disabled={!!actioning}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#34C759", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
                >
                  Iniciar Fase de Grupos
                </button>
              </>
            )}
            {(e.status === "GROUP_STAGE" || e.status === "KNOCKOUT") && (
              <button
                onClick={() => { if (confirm("Avançar o dia? Encerra os jogos Ao vivo e abre o próximo lote.")) editionAction(e.id, "advance_day"); }}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#FFD426", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                ⏭️ Avançar Dia
              </button>
            )}
            {(e.status === "GROUP_STAGE" || e.status === "KNOCKOUT") && (
              <button
                onClick={() => {
                  if (!confirm("Corrigir jogos de grupos marcados como R16 (ou outra fase)?\n\nSó altera linhas com group_letter + rodada 1–3 para phase = GROUP.")) return;
                  editionAction(e.id, "fix_group_phases");
                }}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--fill-inset)", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                Corrigir phase dos grupos
              </button>
            )}
            {e.status === "KNOCKOUT" && activeEditionId === e.id && knockoutControls && (() => {
              const { r32Complete, hasR16 } = knockoutControls;
              const canResetR16 = r32Complete && hasR16;
              const canStartR16 = r32Complete && !hasR16;
              return (
                <>
                  {canResetR16 && (
                    <button
                      onClick={() => {
                        if (
                          !confirm(
                            "Reabrir edição das oitavas?\n\n" +
                              "• Apaga TODOS os jogos de oitavas (e quartas/semis/final se existirem)\n" +
                              "• Apaga os votos desses jogos\n" +
                              "• Classificados do 1/16 podem editar músicas (slot 4+) em Meu Time\n\n" +
                              "O 1/16 de Final (R32) e os votos de grupos NÃO são alterados.",
                          )
                        ) {
                          return;
                        }
                        editionAction(e.id, "reset_r16");
                      }}
                      disabled={!!actioning}
                      style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,212,38,.45)", background: "rgba(255,212,38,.1)", color: "#FFD426", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
                    >
                      ↩ Reabrir edição (oitavas)
                    </button>
                  )}
                  {canStartR16 && (
                    <button
                      onClick={async () => {
                        if (
                          !confirm(
                            "Iniciar oitavas de final?\n\n" +
                              "• Gera 8 jogos: O1=J1×J3, O2=J2×J4, …\n" +
                              "• Exige música do slot 4 (oitavas) para os 16 classificados\n" +
                              "• Abre os 8 jogos ao vivo",
                          )
                        ) {
                          return;
                        }
                        setActioning("start_r16");
                        try {
                          const res = await fetch(`/api/admin/copa/${e.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "start_r16" }),
                          });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            if (
                              err.error &&
                              confirm(`${err.error}\n\nIniciar mesmo assim (sem validar músicas)?`)
                            ) {
                              await editionAction(e.id, "start_r16", { force: true });
                            }
                            return;
                          }
                          const json = await res.json();
                          alert(
                            `Oitavas iniciadas.\n\n` +
                              `Jogos criados: ${json.created}\n` +
                              `Abertos ao vivo: ${json.opened}`,
                          );
                          router.refresh();
                        } finally {
                          setActioning(null);
                        }
                      }}
                      disabled={!!actioning}
                      style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#34C759", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
                    >
                      ▶ Iniciar oitavas
                    </button>
                  )}
                </>
              );
            })()}
            {e.status === "KNOCKOUT" && (
              <button
                onClick={() => {
                  if (!confirm(
                    "Corrigir fase ao vivo?\n\n" +
                    "Remove oitavas fora de ordem e garante só a 1ª rodada do 1/16 (8 jogos) ao vivo.\n" +
                    "A 2ª rodada abre no Avançar Dia, após encerrar a 1ª.",
                  )) return;
                  editionAction(e.id, "realign_live");
                }}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--fill-inset)", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                Corrigir fase ao vivo
              </button>
            )}
            {e.status === "KNOCKOUT" && (
              <button
                onClick={() => {
                  if (!confirm(
                    "Atualizar mata-mata?\n\n" +
                    "• Recria os 16 jogos de 1/16 de Final (32 avos) se faltando\n" +
                    "• Remove oitavas/quartas fora de ordem\n\n" +
                    "Participantes precisam escolher a música do slot 1/16 de Final em Meu Time.",
                  )) return;
                  editionAction(e.id, "repair_knockout");
                }}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(250,36,60,.4)", background: "rgba(250,36,60,.08)", color: "#FA243C", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                🔧 Inserir 32 avos
              </button>
            )}
            {e.status === "GROUP_STAGE" && (
              <button
                onClick={() => editionAction(e.id, "start_knockout")}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--divider)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                Iniciar Fase Eliminatória
              </button>
            )}
            {e.status !== "FINISHED" && (
              <button
                onClick={() => { if (confirm("Encerrar esta Copa?")) editionAction(e.id, "finish"); }}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--divider)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                Encerrar Copa
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Fixture manager */}
      {activeFixtures.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>Gerenciar Jogos</h2>

          {/* Filter */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {["ALL", "LIVE", "UPCOMING", "GROUP", "R32", "R16", "QF", "SF", "FINAL"].map((f) => (
              <button
                key={f}
                onClick={() => setFixtureFilter(f)}
                style={{
                  padding: "6px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: fixtureFilter === f ? "#FFD426" : "var(--fill-inset)",
                  color: fixtureFilter === f ? "#000" : "var(--text-muted)",
                }}
              >
                {f === "ALL" ? "Todos" : f === "LIVE" ? "Ao vivo" : f === "UPCOMING" ? "Em breve" : PHASE_LABELS[f] ?? f}
              </button>
            ))}
          </div>

          {/* Day filter */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <button
              onClick={() => setDayFilter("ALL")}
              style={{
                padding: "6px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: dayFilter === "ALL" ? "#34C759" : "var(--fill-inset)",
                color: dayFilter === "ALL" ? "#fff" : "var(--text-muted)",
              }}
            >
              Todos os dias
            </button>
            {availableDays.map((d) => (
              <button
                key={d}
                onClick={() => setDayFilter(d)}
                title={COPA_DAY_LABELS[d - 1]}
                style={{
                  padding: "6px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: dayFilter === d ? "#34C759" : "var(--fill-inset)",
                  color: dayFilter === d ? "#fff" : "var(--text-muted)",
                }}
              >
                Dia {d} · {COPA_DAY_LABELS[d - 1]}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredFixtures.map((f) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: "var(--surface)",
                  border: `1px solid ${f.status === "LIVE" ? "rgba(250,36,60,.35)" : "var(--divider)"}`,
                  borderRadius: 10,
                }}
              >
                <span style={{ width: 28, fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", flexShrink: 0, textAlign: "center" }}>
                  {PHASE_LABELS[f.phase] ?? f.phase}
                  {f.groupLetter && ` ${f.groupLetter}`}
                  {f.round && ` R${f.round}`}
                </span>
                <CopaArtistAvatar
                  artistName={f.artistA.artistName}
                  artistImage={f.artistA.artistImage}
                  artistColor={f.artistA.artistColor}
                  artistInitials={f.artistA.artistInitials}
                  size={22}
                />
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.artistA.artistName}</span>
                <span style={{ fontSize: 12, fontWeight: 800, padding: "0 6px", flexShrink: 0 }}>
                  {votesToGoals(f.votesA, activeVotesPerGoal)}–{votesToGoals(f.votesB, activeVotesPerGoal)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.artistB.artistName}</span>
                <CopaArtistAvatar
                  artistName={f.artistB.artistName}
                  artistImage={f.artistB.artistImage}
                  artistColor={f.artistB.artistColor}
                  artistInitials={f.artistB.artistInitials}
                  size={22}
                />

                {/* Status controls */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {f.status !== "LIVE" && (
                    <button
                      onClick={() => setFixtureStatus(f.id, "LIVE")}
                      disabled={!!actioning}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(250,36,60,.13)", color: "#FA243C", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      ▶ Ao vivo
                    </button>
                  )}
                  {f.status !== "DONE" && (
                    <button
                      onClick={() => setFixtureStatus(f.id, "DONE")}
                      disabled={!!actioning}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(52,199,89,.12)", color: "#34C759", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      ✓ Encerrar
                    </button>
                  )}
                  {f.status !== "UPCOMING" && (
                    <button
                      onClick={() => setFixtureStatus(f.id, "UPCOMING")}
                      disabled={!!actioning}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--divider)", background: "transparent", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editArtist && squadsEditionId && (() => {
        const art = getSquadArtist(editArtist.artistId);
        if (!art) return null;
        const adminEditWindow = {
          open: true,
          completedPhase: null,
          completedLabel: null,
          nextPhase: null,
          nextLabel: null,
          editableSlots: Array.from({ length: COPA_SINGLES_COUNT }, (_, i) => i),
          message: "Edição admin",
        };
        return (
          <CopaArtistSinglesEditor
            open
            onClose={closeAdminEditor}
            title="Corrigir músicas"
            artistId={art.id}
            artistName={editArtist.artistName}
            singles={art.singles}
            slotLocks={art.lockedSlots.map((slotIndex) => ({
              slotIndex,
              status: "DONE" as const,
              phase: "ADMIN",
              label: SLOT_LABELS[slotIndex] ?? "",
            }))}
            editWindow={adminEditWindow}
            focusSlotIndex={editArtist.focusSlotIndex}
            canEditSlot={(slotIndex) => !art.lockedSlots.includes(slotIndex)}
            search={singleSearch}
            onSearchChange={(q) => searchSongs(q, editArtist.artistName)}
            results={singleResults}
            saving={savingSingle}
            onAssign={(slotIndex, songName, songId, spotifySongId) =>
              assignAdminSingle(editArtist.artistId, slotIndex, songName, songId, spotifySongId)
            }
            onSwap={(fromSlotIndex, toSlotIndex) =>
              swapAdminSingles(editArtist.artistId, fromSlotIndex, toSlotIndex)
            }
          />
        );
      })()}

      {/* Create Copa modal */}
      {showCreate && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{ background: "var(--surface)", width: "100%", maxWidth: 480, borderRadius: 20, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Nova Copa ChartFM</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Nome</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ width: "100%", background: "var(--fill-inset)", border: "1.5px solid var(--divider)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Ano</label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
                style={{ width: "100%", background: "var(--fill-inset)", border: "1.5px solid var(--divider)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Máximo de participantes
              </label>
              <select
                value={newMaxParticipants}
                onChange={(e) => setNewMaxParticipants(Number(e.target.value))}
                style={{ width: "100%", background: "var(--fill-inset)", border: "1.5px solid var(--divider)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
              >
                {COPA_PARTICIPANT_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} participantes</option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Cada participante deverá escolher <strong>{COPA_TOTAL_ARTISTS / newMaxParticipants} artista{COPA_TOTAL_ARTISTS / newMaxParticipants > 1 ? "s" : ""}</strong> ({COPA_TOTAL_ARTISTS} artistas ÷ {newMaxParticipants} participantes). Os próprios usuários se inscrevem enquanto a Copa está em Inscrições.
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Tipo da Copa
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as CopaTypeOption)}
                style={{ width: "100%", background: "var(--fill-inset)", border: "1.5px solid var(--divider)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
              >
                {COPA_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{COPA_TYPE_LABELS[t]}</option>
                ))}
              </select>
              {newType === "PUSH" && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  Só artistas com menos de 1.500.000 ouvintes mensais no Spotify poderão ser escolhidos.
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--divider)", background: "transparent", color: "var(--text-muted)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={createCopa}
                disabled={creating}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#FFD426", color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: creating ? 0.5 : 1 }}
              >
                {creating ? "Criando…" : "Criar Copa"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </>
  );
}

/* -------------------------- Painel de votos manuais -------------------------- */

const MANUAL_PHASE_LABELS: Record<string, string> = {
  GROUP: "Grupos",
  R32: "1/16",
  R16: "Oitavas",
  QF: "Quartas",
  SF: "Semi",
  THIRD_PLACE: "3º lugar",
  FINAL: "Final",
};

function manualFixtureLabel(f: ManualVoteData["fixtures"][number]): string {
  const phase = MANUAL_PHASE_LABELS[f.phase] ?? f.phase;
  const group = f.groupLetter ? ` ${f.groupLetter}` : "";
  const round = f.round ? ` · R${f.round}` : "";
  return `Dia ${f.day} · ${phase}${group}${round}`;
}

function ManualVotePanel({
  manualVote,
  manualSel,
  sendingUser,
  onSelect,
  onRandomize,
  onSend,
}: {
  manualVote: ManualVoteData | null;
  manualSel: Record<string, Record<string, "A" | "B" | "">>;
  sendingUser: string | null;
  onSelect: (userId: string, fixtureId: string, side: "A" | "B" | "") => void;
  onRandomize: (userId: string) => void;
  onSend: (userId: string) => void;
}) {
  if (!manualVote) {
    return (
      <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "16px", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 12 }}>
        Nenhuma Copa ativa no momento.
      </div>
    );
  }

  const { users, fixtures, existingVotes } = manualVote;

  if (fixtures.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "16px", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 12 }}>
        Nenhuma disputa Ao vivo aberta. Abra jogos na aba <strong>Gerenciar</strong> para votar aqui.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        Defina em qual opção cada um dos {users.length} usuários vota nas {fixtures.length} disputa(s) Ao vivo e clique em <strong>Enviar votos</strong>. Disputas já votadas ficam travadas.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {users.map((u) => {
          const ev = existingVotes[u.userId] ?? {};
          const row = manualSel[u.userId] ?? {};
          const pending = fixtures.filter((f) => !ev[f.id] && (row[f.id] === "A" || row[f.id] === "B")).length;
          const remaining = fixtures.filter((f) => !ev[f.id]).length;
          const sending = sendingUser === u.userId;
          return (
            <div key={u.userId} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--divider)" }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: u.avatarColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    @{u.handle} · {pending} selecionado(s) · {remaining} sem voto
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRandomize(u.userId)}
                  disabled={sending || remaining === 0}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--fill-inset)", color: "var(--text)", fontSize: 12, fontWeight: 700, cursor: sending || remaining === 0 ? "not-allowed" : "pointer", opacity: remaining === 0 ? 0.5 : 1, flexShrink: 0 }}
                >
                  🎲 Sortear
                </button>
                <button
                  type="button"
                  onClick={() => onSend(u.userId)}
                  disabled={sending || pending === 0}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: pending === 0 ? "var(--fill-inset)" : "#34C759", color: pending === 0 ? "var(--text-muted)" : "#fff", fontSize: 12, fontWeight: 700, cursor: sending || pending === 0 ? "not-allowed" : "pointer", flexShrink: 0 }}
                >
                  {sending ? "Enviando…" : "Enviar votos"}
                </button>
              </div>

              <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {fixtures.map((f) => {
                  const voted = ev[f.id];
                  const value = voted ?? row[f.id] ?? "";
                  return (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid var(--divider)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-disabled)" }}>
                          {manualFixtureLabel(f)}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.artistA.artistName} <span style={{ color: "var(--text-disabled)" }}>×</span> {f.artistB.artistName}
                        </div>
                      </div>
                      {voted ? (
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 99, background: "rgba(52,199,89,.12)", color: "#34C759" }}>
                          ✓ {(voted === "A" ? f.artistA : f.artistB).artistName.split(" ")[0]}
                        </span>
                      ) : (
                        <select
                          value={value}
                          onChange={(e) => onSelect(u.userId, f.id, e.target.value as "A" | "B" | "")}
                          disabled={sending}
                          style={{ flexShrink: 0, maxWidth: 160, background: "var(--fill-inset)", border: "1px solid var(--divider)", borderRadius: 8, padding: "6px 8px", color: "var(--text)", fontSize: 12, fontWeight: 600 }}
                        >
                          <option value="">— não votar</option>
                          <option value="A">{f.artistA.artistName}</option>
                          <option value="B">{f.artistB.artistName}</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
