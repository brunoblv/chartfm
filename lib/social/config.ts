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
  return Boolean(process.env.FACEBOOK_PAGE_ID?.trim() && process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim());
}

export function isInstagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() && process.env.INSTAGRAM_ACCESS_TOKEN?.trim());
}

export function isThreadsConfigured(): boolean {
  return Boolean(process.env.THREADS_USER_ID?.trim() && process.env.THREADS_ACCESS_TOKEN?.trim());
}
