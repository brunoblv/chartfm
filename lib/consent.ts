export const CONSENT_STORAGE_KEY = "chartfm-consent";

export type ConsentPreferences = {
  functional: true;
  ads: boolean;
};

export function parseConsentValue(raw: string | null): ConsentPreferences | null {
  if (!raw) return null;
  if (raw === "all") return { functional: true, ads: true };
  if (raw === "functional") return { functional: true, ads: false };
  if (raw.startsWith("custom:")) {
    try {
      const parsed = JSON.parse(raw.slice("custom:".length)) as { functional?: boolean; ads?: boolean };
      return { functional: true, ads: Boolean(parsed.ads) };
    } catch {
      return null;
    }
  }
  return null;
}

export function serializeConsent(prefs: ConsentPreferences): string {
  if (prefs.ads) return "all";
  return `custom:${JSON.stringify({ functional: true, ads: false })}`;
}

export function hasAdsConsent(raw: string | null): boolean {
  return parseConsentValue(raw)?.ads === true;
}

export function readStoredConsent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredConsent(value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent("chartfm-consent-change", { detail: value }));
  } catch {
    // ignore quota / private mode
  }
}

export const CONSENT_REOPEN_EVENT = "chartfm-consent-reopen";

/** Reabre o banner de cookies para o usuário revisar/trocar a escolha já feita. */
export function reopenConsentBanner(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CONSENT_REOPEN_EVENT));
}
