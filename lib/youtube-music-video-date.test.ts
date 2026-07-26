import { describe, expect, it } from "vitest";
import { parseYoutubePublishedAt } from "@/lib/youtube-music-video-date";

describe("parseYoutubePublishedAt", () => {
  it("parseia ISO do YouTube", () => {
    const d = parseYoutubePublishedAt("2011-06-09T20:04:32Z");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2011-06-09T20:04:32.000Z");
  });

  it("retorna null para vazio/inválido", () => {
    expect(parseYoutubePublishedAt(undefined)).toBeNull();
    expect(parseYoutubePublishedAt("")).toBeNull();
    expect(parseYoutubePublishedAt("   ")).toBeNull();
    expect(parseYoutubePublishedAt("não-é-data")).toBeNull();
  });
});
