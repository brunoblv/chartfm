import { describe, expect, it } from "vitest";
import { resolveClipWindow } from "@/lib/videoparada/prepare-clip";
import { extractYoutubeId, scoreSearchTitle } from "@/lib/videoparada/download-clip";

describe("resolveClipWindow", () => {
  it("respeita início/fim manuais", () => {
    expect(resolveClipWindow(200, { startSeconds: 40, endSeconds: 46 })).toEqual({
      startSec: 40,
      endSec: 46,
      strategy: "manual",
    });
  });

  it("usa heurística ~35% quando não há config", () => {
    const w = resolveClipWindow(100, { clipSeconds: 6 });
    expect(w.startSec).toBe(35);
    expect(w.endSec).toBe(41);
    expect(w.strategy).toBe("heuristic-35");
  });
});

describe("extractYoutubeId", () => {
  it("aceita id e urls", () => {
    expect(extractYoutubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
});

describe("scoreSearchTitle", () => {
  const artist = "Madonna";

  it("rejeita reaction mesmo com Official Music Video no título", () => {
    expect(
      scoreSearchTitle(
        "Madonna & Sabrina Carpenter - Bring Your Love (Official Music Video) REACTION",
        { artist, channel: "Steven In Stereo" },
      ),
    ).toBeNull();
  });

  it("prefere Official Video do canal da artista a Music Video genérico", () => {
    const official = scoreSearchTitle(
      "Madonna & Sabrina Carpenter - Bring Your Love (Official Video)",
      { artist, channel: "Madonna and Sabrina Carpenter" },
    );
    const generic = scoreSearchTitle("Bring Your Love (Music Video)", {
      artist,
      channel: "Random Channel",
    });
    expect(official).not.toBeNull();
    expect(generic).not.toBeNull();
    expect(official!).toBeGreaterThan(generic!);
  });

  it("rejeita lyric / visualizer / audio", () => {
    expect(scoreSearchTitle("Bring Your Love (Lyrics)", { artist })).toBeNull();
    expect(scoreSearchTitle("Bring Your Love (Official Visualizer)", { artist })).toBeNull();
    expect(scoreSearchTitle("Bring Your Love (Official Audio)", { artist })).toBeNull();
  });
});
