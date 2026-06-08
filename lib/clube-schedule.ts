/** Horários fixos do Clube do Álbum (horário local do servidor/navegador). */

export type ClubePhaseSchedule = {
  nominationsOpenAt: Date;
  nominationsCloseAt: Date;
  pollCloseAt: Date;
  resultCloseAt: Date;
  listeningCloseAt: Date;
  dateRange: string;
};

export const CLUBE_SCHEDULE_RULES = [
  { phase: 1, label: "Inscrições", desc: "Tema em destaque, 2 indicações via Spotify, lista da rodada", when: "Dia 1 · 6h → 20h" },
  { phase: 2, label: "Enquete", desc: "Grid com seleção múltipla, mínimo 7 votos", when: "Dia 1, 20h → Dia 2, 20h" },
  { phase: 3, label: "Resultado", desc: "2 vencedores em destaque + link Spotify", when: "Dia 2 · 20h" },
  { phase: 4, label: "Escuta", desc: "Cards dos escolhidos; nota e indicador revelados no 8º dia 20h", when: "Dia 2, 20h → Dia 8, 20h" },
] as const;

function atLocalTime(base: Date, hours: number, minutes = 0): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatShortDate(d: Date): string {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatDateTime(d: Date): string {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} · ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Data de início de referência (qualquer dia; qualquer hora); horários são normalizados. */
export function buildScheduleFromDate(startDate: Date): ClubePhaseSchedule {
  const wed = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  const nominationsOpenAt = atLocalTime(wed, 6, 0);
  const nominationsCloseAt = atLocalTime(wed, 20, 0);
  const pollCloseAt = atLocalTime(addDays(wed, 1), 20, 0);
  const resultCloseAt = pollCloseAt;
  const listeningCloseAt = atLocalTime(addDays(wed, 7), 20, 0);

  const dateRange = `${formatShortDate(nominationsOpenAt)} – ${formatShortDate(listeningCloseAt)} ${listeningCloseAt.getFullYear()}`;

  return {
    nominationsOpenAt,
    nominationsCloseAt,
    pollCloseAt,
    resultCloseAt,
    listeningCloseAt,
    dateRange,
  };
}

export function buildDateRangeLabel(start: Date, end: Date): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)} ${end.getFullYear()}`;
}

export function toDateTimeLocalValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function parseDateTimeLocal(value: string): Date | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function schedulePreview(schedule: ClubePhaseSchedule) {
  return [
    { label: "Inscrições abrem", at: formatDateTime(schedule.nominationsOpenAt) },
    { label: "Inscrições fecham / Enquete abre", at: formatDateTime(schedule.nominationsCloseAt) },
    { label: "Enquete fecha / Resultado", at: formatDateTime(schedule.pollCloseAt) },
    { label: "Escuta encerra", at: formatDateTime(schedule.listeningCloseAt) },
  ];
}

/** Próxima data de início disponível (hoje se antes das 20h, amanhã caso contrário). */
export function suggestNextStartDate(from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (from.getHours() >= 20) return addDays(d, 1);
  return d;
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}


export function formatCountdown(target: Date, now = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "em breve";
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}
