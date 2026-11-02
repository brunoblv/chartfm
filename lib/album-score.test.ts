import { describe, expect, it } from "vitest";
import { aggregateScoreLabel } from "@/lib/album-score";

describe("aggregateScoreLabel", () => {
  it("não usa linguagem de consenso com amostra pequena", () => {
    // The Afterparty: nota 100 com 3 avaliações
    expect(aggregateScoreLabel(100, 3, "pt-BR")).toBe("Poucas avaliações até agora");
    expect(aggregateScoreLabel(100, 3, "en")).toBe("Few ratings so far");
  });
  it("usa a faixa normal com amostra suficiente", () => {
    expect(aggregateScoreLabel(95, 12, "pt-BR")).toBe("Aclamação universal");
    expect(aggregateScoreLabel(95, 12, "en")).toBe("Universal acclaim");
  });
});
