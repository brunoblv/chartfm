import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "fs";
import path from "path";
import { authOptions } from "@/lib/auth-options";
import { fetchRecentTracks } from "@/lib/lastfm";
import { computeLastfmChart, getSundayKey } from "@/lib/lastfm-chart-engine";
import type { LastfmSnapshotHistory } from "@/lib/lastfm-chart-engine";

// Note: file-based snapshots work in development and Node.js servers.
// On Vercel serverless, migrate this to a database table.
const SNAPSHOTS_PATH = path.join(process.cwd(), "data", "lastfm-snapshots.json");

function readHistory(): LastfmSnapshotHistory {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOTS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeHistory(history: LastfmSnapshotHistory): void {
  const dir = path.dirname(SNAPSHOTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SNAPSHOTS_PATH, JSON.stringify(history, null, 2), "utf-8");
}

// GET /api/lastfm/chart — compute and return current chart (public)
export async function GET() {
  try {
    const today = new Date();
    const [trackPlays, history] = await Promise.all([
      fetchRecentTracks(30),
      Promise.resolve(readHistory()),
    ]);
    const entries = computeLastfmChart(trackPlays, history, today);
    return NextResponse.json({ entries, computedAt: today.toISOString(), weekOf: getSundayKey(today) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/lastfm/chart — save current chart as snapshot (requires @bruno session)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.handle || session.user.handle !== "bruno") {
    // Also allow cron secret as fallback for automated runs
    const auth = req.headers.get("authorization") ?? "";
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const today = new Date();
    const trackPlays = await fetchRecentTracks(30);
    const history = readHistory();
    const entries = computeLastfmChart(trackPlays, history, today);
    const sundayKey = getSundayKey(today);

    history[sundayKey] = { computedAt: today.toISOString(), entries };
    writeHistory(history);

    return NextResponse.json({ ok: true, savedAs: sundayKey, count: entries.length, entries });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
