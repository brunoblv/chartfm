import { describe, expect, it } from "vitest";
import { decodeHeaderValue } from "./api-call-context";

// Regressão: em 2026-07-21, nomes de usuário com caracteres fora do Latin-1
// (ex.: "'𝔐arnjin ⟭⟬") faziam `headers.set()` no middleware.ts lançar
// `TypeError: Cannot convert argument to a ByteString`, derrubando TODA
// requisição de API do usuário logado (perfil, charts, etc. — sumia tudo).
// O middleware agora envia esses valores com encodeURIComponent; este
// arquivo decodifica de volta. Ver middleware.ts:200-204.
describe("decodeHeaderValue", () => {
  it("decodifica valores percent-encoded (como o middleware envia)", () => {
    const name = "'𝔐arnjin ⟭⟬";
    expect(decodeHeaderValue(encodeURIComponent(name))).toBe(name);
  });

  it("decodifica emojis e aspas curvas sem lançar", () => {
    for (const name of ["Matt 🍒", "Marcella “May”", "Marco’s Rodrigues", "gabriel 🦋"]) {
      expect(() => decodeHeaderValue(encodeURIComponent(name))).not.toThrow();
      expect(decodeHeaderValue(encodeURIComponent(name))).toBe(name);
    }
  });

  it("mantém texto ASCII simples inalterado", () => {
    expect(decodeHeaderValue("bruno")).toBe("bruno");
  });

  it("retorna null quando o header não veio", () => {
    expect(decodeHeaderValue(null)).toBeNull();
  });

  it("não lança em entrada malformada (fallback para o valor bruto)", () => {
    expect(() => decodeHeaderValue("%")).not.toThrow();
    expect(decodeHeaderValue("%")).toBe("%");
  });
});

// Prova em nível de plataforma: Headers (undici/Web Fetch, o que o middleware
// usa via NextResponse) recusa strings fora de Latin-1, mas aceita qualquer
// string ASCII — por isso encodeURIComponent (saída sempre ASCII) é a defesa
// correta para QUALQUER valor vindo de dado de usuário (nome, handle, bio...)
// que precise virar header HTTP.
describe("encodeURIComponent como transporte seguro para headers HTTP", () => {
  it("Headers.set lança para nome de usuário com caracteres fora do Latin-1", () => {
    const h = new Headers();
    expect(() => h.set("x-api-user-name", "'𝔐arnjin ⟭⟬")).toThrow();
  });

  it("Headers.set aceita o mesmo nome depois de encodeURIComponent, e o valor decodifica de volta ao original", () => {
    const original = "'𝔐arnjin ⟭⟬";
    const h = new Headers();
    expect(() => h.set("x-api-user-name", encodeURIComponent(original))).not.toThrow();
    expect(decodeHeaderValue(h.get("x-api-user-name"))).toBe(original);
  });
});
