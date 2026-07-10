import { isSocialPlatformConfiguredFromEnv } from "@/lib/social/credentials/token-resolver";

export function isSocialPostingEnabled(): boolean {
  const flag = process.env.SOCIAL_POSTING_ENABLED?.trim().toLowerCase();
  return flag ? flag === "1" || flag === "true" || flag === "yes" : true;
}

export function socialPublicBaseUrl(): string {
  const raw = process.env.SOCIAL_PUBLIC_BASE_URL?.trim() || "https://chartfm.com.br";
  return raw.replace(/\/$/, "");
}

export function absoluteSocialUrl(targetUrl: string): string {
  if (/^https?:\/\//i.test(targetUrl)) return targetUrl;
  return `${socialPublicBaseUrl()}${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
}

export function isFacebookConfigured(): boolean {
  return isSocialPlatformConfiguredFromEnv("FACEBOOK");
}

export function isInstagramConfigured(): boolean {
  return isSocialPlatformConfiguredFromEnv("INSTAGRAM");
}

export function isThreadsConfigured(): boolean {
  return isSocialPlatformConfiguredFromEnv("THREADS");
}
