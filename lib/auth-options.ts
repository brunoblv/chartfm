import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { isGoogleAuthConfigured } from "@/lib/auth-config";
import { ensureGoogleUser } from "@/lib/google-user";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export function getAuthOptions(): NextAuthOptions {
  const googleConfigured = isGoogleAuthConfigured();

  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      id: "credentials",
      name: "Email e senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ];

  if (googleConfigured) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    );
  }

  return {
    providers,
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    pages: {
      signIn: "/login",
    },
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider === "credentials") {
          if (!user.email) return false;
          const db = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase().trim() },
          });
          return db?.needsHandle ? "/onboarding" : true;
        }

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
          try {
            const db = await prisma.user.findUnique({ where: { id: token.prismaUserId } });
            if (db) {
              token.handle = db.handle;
              token.name = db.name;
              token.picture = db.image ?? undefined;
              token.streak = db.streak;
              token.role = db.role;
              token.needsHandle = db.needsHandle;
            } else {
              token.prismaUserId = undefined;
            }
          } catch (e) {
            console.error("[auth] jwt refresh", e);
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user && token.prismaUserId) {
          session.user.id = token.prismaUserId;
          session.user.handle = token.handle ?? undefined;
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
}

export const authOptions = getAuthOptions();
