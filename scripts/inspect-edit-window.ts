import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getCopaSinglesEditWindow, getLockedSingleSlots, isSingleSlotEditableInWindow, SLOT_LABELS } from "../lib/copa";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}

const p = new PrismaClient();
const copaId = "cmqr3sma1000gvacfk24dl970";

(async () => {
  const copa = await p.copaEdition.findUnique({ where: { id: copaId }, select: { status: true } });
  const allFixtures = await p.copaFixture.findMany({
    where: { copaId },
    select: { phase: true, status: true, matchIndex: true },
  });
  const w = getCopaSinglesEditWindow(copa!.status, allFixtures);
  console.log("Copa status:", copa!.status);
  console.log("Edit window:", JSON.stringify(w, null, 2));

  const byPhase = await p.copaFixture.groupBy({
    by: ["phase", "status"],
    where: { copaId },
    _count: true,
  });
  console.log("\nFixtures:", byPhase);

  // Sample artist with R32 live - slot locks
  const liveR32 = await p.copaFixture.findMany({
    where: { copaId, phase: "R32", status: "LIVE", matchIndex: { lt: 8 } },
    take: 1,
    include: {
      artistA: { select: { id: true, artistName: true, ownerId: true } },
    },
  });
  if (liveR32[0]) {
    console.log("\nSample LIVE artist:", liveR32[0].artistA.artistName, "owner:", liveR32[0].artistA.ownerId);
  }

  const liveR16 = await p.copaFixture.findMany({
    where: { copaId, phase: "R16", status: "LIVE" },
    take: 1,
    include: { artistA: { select: { id: true, artistName: true } } },
  });
  if (liveR16[0]) {
    const aid = liveR16[0].artistA.id;
    const artistFixtures = await p.copaFixture.findMany({
      where: {
        copaId,
        OR: [{ artistAId: aid }, { artistBId: aid }],
        status: { in: ["LIVE", "DONE"] },
      },
      select: {
        artistAId: true,
        artistBId: true,
        singleAIdx: true,
        singleBIdx: true,
        status: true,
        phase: true,
      },
    });
    const locked = getLockedSingleSlots(aid, artistFixtures);
    console.log("\nR16 LIVE artist:", liveR16[0].artistA.artistName);
    console.log("Locked:", locked.map((l) => `${l.slotIndex}(${l.phase})`).join(", "));
    const editable = Array.from({ length: 8 }, (_, i) => i).filter((i) =>
      isSingleSlotEditableInWindow(i, w, locked),
    );
    console.log(
      "Editable slots:",
      editable.map((i) => SLOT_LABELS[i]).join(", ") || "NONE",
    );
  }
})().finally(() => p.$disconnect());
