import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { ensureGoogleUser } from "@/lib/google-user";
import { prisma } from "@/lib/prisma";

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID?.length) && Boolean(process.env.GOOGLE_CLIENT_SECRET?.length);

export const authOptions: NextAuthOptions = {
  providers: googleConfigured
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || account?.provider !== "google" || !account.providerAccountId) {
        return false;
      }
      try {
        const { isNew } = await ensureGoogleUser({
          email: user.email,
          name: user.name,
          image: user.image,
          googleId: account.providerAccountId,
        });
        return isNew ? "/onboarding" : true;
      } catch (e) {
        console.error("[auth] ensureGoogleUser", e);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const email = user.email.toLowerCase().trim();
        const db = await prisma.user.findUnique({ where: { email } });
        if (db) {
          token.prismaUserId = db.id;
          token.handle = db.handle;
          token.name = db.name;
          token.picture = db.image ?? user.image ?? undefined;
          token.streak = db.streak;
          token.role = db.role;
          token.needsHandle = db.needsHandle;
        }
      } else if (token.prismaUserId) {
        const db = await prisma.user.findUnique({ where: { id: token.prismaUserId } });
        if (db) {
          token.handle = db.handle;
          token.name = db.name;
          token.picture = db.image ?? undefined;
          token.streak = db.streak;
          token.role = db.role;
          token.needsHandle = db.needsHandle;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.prismaUserId && token.handle) {
        session.user.id = token.prismaUserId;
        session.user.handle = token.handle;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.image = (token.picture as string | undefined) ?? session.user.image;
        session.user.streak = typeof token.streak === "number" ? token.streak : 0;
        session.user.role = (token.role as "USER" | "ADMIN" | "DEV" | undefined) ?? "USER";
        session.user.needsHandle = token.needsHandle === true;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
