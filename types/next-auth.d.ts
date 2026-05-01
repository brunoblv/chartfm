import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      handle?: string;
      streak?: number;
      role?: "USER" | "ADMIN" | "DEV";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    handle?: string;
    prismaUserId?: string;
    streak?: number;
    role?: "USER" | "ADMIN" | "DEV";
  }
}
