export function isPrivilegedRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "DEV";
}
