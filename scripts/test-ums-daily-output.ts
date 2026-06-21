/**
 * Teste: gera parada diária UMS Total Request a partir do Top 20 de 22/06/2026
 * npx tsx scripts/test-ums-daily-output.ts
 */
import { createSeededRandom, DISK_MTV_WEEKDAYS, generateWeeklyDailyCharts, type Top20Entry } from "../lib/disk-mtv-daily";

const TOP20: Top20Entry[] = [
  { pos: 1,  artist: "Hilary Duff",                   song: "Weather For Tennis" },
  { pos: 2,  artist: "Bebe Rexha, Faithless",          song: "New Religion" },
  { pos: 3,  artist: "Milk Inc.",                      song: "Medicine" },
  { pos: 4,  artist: "Delta Goodrem",                  song: "Eclipse" },
  { pos: 5,  artist: "Jennifer Lopez, David Guetta",   song: "Save Me Tonight" },
  { pos: 6,  artist: "Hilary Duff",                    song: "Roommates" },
  { pos: 7,  artist: "Lykke Li",                       song: "Lucky Again" },
  { pos: 8,  artist: "Topic, Becky G",                 song: "Sorry Papi" },
  { pos: 9,  artist: "Tame Impala, JENNIE",            song: "Dracula" },
  { pos: 10, artist: "sombr",                          song: "Homewrecker" },
  { pos: 11, artist: "Noah Kahan",                     song: "The Great Divide" },
  { pos: 12, artist: "Julia Wolf",                     song: "In My Room" },
  { pos: 13, artist: "Anyma, Lisa",                    song: "Bad Angel" },
  { pos: 14, artist: "Charlie Puth, Hikaru Utada",     song: "Home" },
  { pos: 15, artist: "KATSEYE",                        song: "PINKY UP" },
  { pos: 16, artist: "Anitta, Shakira",                song: "Choka Choka" },
  { pos: 17, artist: "Sam Fender, Olivia Dean",        song: "Rein Me In" },
  { pos: 18, artist: "Noah Kahan",                     song: "Porch Light" },
  { pos: 19, artist: "Zara Larsson",                   song: "Midnight Sun" },
  { pos: 20, artist: "Bella Kay",                      song: "iloveitiloveitiloveit" },
];

// Seed baseada na data da semana (20260622 em formato numérico)
const rnd = createSeededRandom(20260622);
const charts = generateWeeklyDailyCharts(TOP20, { random: rnd });

// --- Tabela de posições por dia (visão por música) ---
console.log("\n=== UMS TOTAL REQUEST — 22/06/2026 ===");
console.log("Posições diárias de cada música do Top 20\n");

const header = "Top20 | Artista / Música                                        | Seg | Ter | Qua | Qui | Sex";
console.log(header);
console.log("-".repeat(header.length));

for (const entry of TOP20) {
  const artistSong = `${entry.artist} - ${entry.song}`.padEnd(53).slice(0, 53);
  const top20Label = `#${String(entry.pos).padStart(2, "0")}`;

  const days = DISK_MTV_WEEKDAYS.map((day) => {
    const found = charts[day].find((e) => e.top20Pos === entry.pos);
    return found ? String(found.pos).padStart(2, " ") : " -";
  });

  console.log(`  ${top20Label}  | ${artistSong} | ${days.join(" | ")}`);
}

// --- Paradas diárias completas ---
console.log("\n\n=== PARADAS DIÁRIAS (TOP 10 → #1) ===\n");
for (const day of DISK_MTV_WEEKDAYS) {
  console.log(`${day.toUpperCase()}`);
  const entries = [...charts[day]].sort((a, b) => b.pos - a.pos);
  for (const e of entries) {
    const debut = e.isDebut ? " [ESTRÉIA]" : "";
    console.log(`  ${e.pos} — ${e.artist} - "${e.song}"  [Top20: #${e.top20Pos}]${debut}`);
  }
  console.log("");
}
