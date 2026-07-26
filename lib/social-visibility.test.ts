import { describe, expect, it } from "vitest";
import {
  canViewerSeeSocial,
  filterSocialForViewer,
  normalizeSocialVisibility,
  parseSocialVisibility,
} from "./social-visibility";

describe("parseSocialVisibility", () => {
  it("aceita valores válidos", () => {
    expect(parseSocialVisibility("everyone")).toBe("everyone");
    expect(parseSocialVisibility("following")).toBe("following");
    expect(parseSocialVisibility("nobody")).toBe("nobody");
  });

  it("rejeita inválidos", () => {
    expect(parseSocialVisibility("public")).toBeNull();
    expect(parseSocialVisibility("")).toBeNull();
    expect(parseSocialVisibility(null)).toBeNull();
  });
});

describe("canViewerSeeSocial", () => {
  it("dono sempre vê", () => {
    expect(
      canViewerSeeSocial({ visibility: "nobody", isOwner: true, ownerFollowsViewer: false }),
    ).toBe(true);
  });

  it("everyone: qualquer viewer vê", () => {
    expect(
      canViewerSeeSocial({ visibility: "everyone", isOwner: false, ownerFollowsViewer: false }),
    ).toBe(true);
  });

  it("nobody: viewer externo não vê", () => {
    expect(
      canViewerSeeSocial({ visibility: "nobody", isOwner: false, ownerFollowsViewer: true }),
    ).toBe(false);
  });

  it("following: só se o dono segue o viewer", () => {
    expect(
      canViewerSeeSocial({ visibility: "following", isOwner: false, ownerFollowsViewer: true }),
    ).toBe(true);
    expect(
      canViewerSeeSocial({ visibility: "following", isOwner: false, ownerFollowsViewer: false }),
    ).toBe(false);
  });
});

describe("filterSocialForViewer", () => {
  it("oculta username quando a regra nega", () => {
    expect(
      filterSocialForViewer("bruno", "nobody", { isOwner: false, ownerFollowsViewer: false }),
    ).toBeNull();
  });

  it("mantém username quando a regra permite", () => {
    expect(
      filterSocialForViewer("bruno", "everyone", { isOwner: false, ownerFollowsViewer: false }),
    ).toBe("bruno");
  });

  it("trata visibility inválida como everyone", () => {
    expect(normalizeSocialVisibility("weird")).toBe("everyone");
    expect(
      filterSocialForViewer("x", "weird", { isOwner: false, ownerFollowsViewer: false }),
    ).toBe("x");
  });
});
