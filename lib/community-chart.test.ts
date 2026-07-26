import { describe, expect, it } from "vitest";
import { limitOfficialEntriesByMaxSongs } from "@/lib/community-chart";

describe("limitOfficialEntriesByMaxSongs", () => {
  it("corta entradas além de maxSongs", () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({ position: i + 1 }));
    expect(limitOfficialEntriesByMaxSongs(entries, 20)).toHaveLength(20);
    expect(limitOfficialEntriesByMaxSongs(entries, 20).at(-1)?.position).toBe(20);
  });

  it("não altera quando já está dentro do limite", () => {
    const entries = [{ position: 1 }, { position: 2 }];
    expect(limitOfficialEntriesByMaxSongs(entries, 20)).toEqual(entries);
  });

  it("clampa limite inválido para 1–100", () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({ position: i + 1 }));
    expect(limitOfficialEntriesByMaxSongs(entries, 0)).toHaveLength(1);
    expect(limitOfficialEntriesByMaxSongs(entries, 200)).toHaveLength(5);
  });
});
