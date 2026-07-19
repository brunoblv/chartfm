import { describe, it, expect } from "vitest";
import { titleMatches } from "./spotify-track-match";

describe("titleMatches", () => {
  it("aceita remaster do Spotify quando o título canônico não menciona remaster", () => {
    expect(titleMatches("Come As You Are - 2011 Remaster", "Come As You Are")).toBe(true);
    expect(titleMatches("Come As You Are (Remastered)", "Come As You Are")).toBe(true);
  });

  it("aceita edition/deluxe quando o título canônico não menciona a tag", () => {
    expect(titleMatches("Nevermind (Deluxe Edition)", "Nevermind")).toBe(true);
    expect(titleMatches("Song - Anniversary Edition", "Song")).toBe(true);
  });

  it("continua rejeitando live/acoustic/remix quando o título canônico não pede a variante", () => {
    expect(titleMatches("Genie In a Bottle - Live from the Crazy Horse", "Genie In a Bottle")).toBe(false);
    expect(titleMatches("Song (Acoustic)", "Song")).toBe(false);
    expect(titleMatches("Song - Remix", "Song")).toBe(false);
  });

  it("não bloqueia quando a tag já faz parte do título buscado", () => {
    expect(titleMatches("Show Me How to Live", "Show Me How to Live")).toBe(true);
  });
});
