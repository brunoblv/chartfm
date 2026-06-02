import type { Locale } from "./config";
import { messagesEn } from "./messages/en";
import { messagesPtBR } from "./messages/pt-BR";

const catalogs: Record<Locale, object> = {
  "pt-BR": messagesPtBR,
  en: messagesEn,
};

export type MessageKey = keyof typeof messagesPtBR;

function resolvePath(obj: unknown, path: string): string | undefined {
  let current: unknown = obj;
  for (const part of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template =
    resolvePath(catalogs[locale], key) ??
    resolvePath(catalogs["pt-BR"], key) ??
    key;

  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}
