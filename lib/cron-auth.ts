export function authorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail-closed: sem CRON_SECRET configurado, negar em produção (endpoints de
  // cron disparam jobs pesados e mutações). Em dev/test, liberar por conveniência.
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
