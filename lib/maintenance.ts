import type { NextRequest } from "next/server";

export const MAINTENANCE_PATH = "/manutencao";
export const MAINTENANCE_BYPASS_COOKIE = "chartfm_maintenance_bypass";

export function isMaintenanceModeEnabled(): boolean {
  const value = process.env.MAINTENANCE_MODE?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function maintenanceBypassSecret(): string | null {
  const secret = process.env.MAINTENANCE_BYPASS_SECRET?.trim();
  return secret || null;
}

export function isMaintenancePath(pathname: string): boolean {
  return pathname === MAINTENANCE_PATH;
}

/** Rotas que continuam acessíveis durante a manutenção (assets estáticos). */
export function isMaintenanceStaticAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/public/")) return true;
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml)$/i.test(pathname);
}

export function hasMaintenanceBypass(request: NextRequest): boolean {
  const secret = maintenanceBypassSecret();
  if (!secret) return false;
  if (request.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value === secret) return true;
  return request.nextUrl.searchParams.get("bypass") === secret;
}
