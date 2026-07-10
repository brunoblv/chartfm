const SECRET_PATTERNS = [
  /access_token=[^&\s]+/gi,
  /authorization:\s*[^\s]+/gi,
  /bearer\s+[^\s]+/gi,
  /IGAA[A-Za-z0-9_-]+/g,
  /EAA[A-Za-z0-9_-]+/g,
  /\d{8,}:[A-Za-z0-9_-]{30,}/g,
];

export function sanitizeErrorMessage(input: unknown): string {
  const raw = input instanceof Error ? input.message : String(input ?? "erro desconhecido");
  let sanitized = raw;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized.slice(0, 500);
}

export function isTransientRefreshError(err: unknown): boolean {
  const message = sanitizeErrorMessage(err).toLowerCase();
  if (message.includes("abort") || message.includes("timeout") || message.includes("econnreset")) {
    return true;
  }
  if (message.includes("http 5") || message.includes("http 429")) {
    return true;
  }
  if (message.includes("oauthexception") || message.includes("invalid") || message.includes("expired")) {
    return false;
  }
  if (message.includes("http 4")) {
    return false;
  }
  return true;
}
