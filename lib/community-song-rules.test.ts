import { describe, expect, it } from "vitest";
import {
  communityRequiresMusicVideo,
  songHasOfficialMusicVideo,
} from "@/lib/community-song-rules";

describe("communityRequiresMusicVideo", () => {
  it("vale só para disk-mtv", () => {
    expect(communityRequiresMusicVideo("disk-mtv")).toBe(true);
    expect(communityRequiresMusicVideo("ucc")).toBe(false);
  });
});

describe("songHasOfficialMusicVideo", () => {
  const empty = {
    musicVideoReleaseDate: null,
    youtubeReleaseDate: null,
    hasOfficialVideoClip: false,
  };

  it("rejeita sem evidência", () => {
    expect(songHasOfficialMusicVideo(empty)).toBe(false);
  });

  it("aceita data de MV ou YouTube", () => {
    expect(
      songHasOfficialMusicVideo({ ...empty, musicVideoReleaseDate: new Date("2024-01-01") }),
    ).toBe(true);
    expect(
      songHasOfficialMusicVideo({ ...empty, youtubeReleaseDate: new Date("2024-02-01") }),
    ).toBe(true);
  });

  it("aceita clipe OFFICIAL cadastrado", () => {
    expect(songHasOfficialMusicVideo({ ...empty, hasOfficialVideoClip: true })).toBe(true);
  });
});
