/** Verifica se o login Google (NextAuth) está configurado no ambiente. */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.NEXTAUTH_SECRET?.trim() &&
      process.env.NEXTAUTH_URL?.trim(),
  );
}
