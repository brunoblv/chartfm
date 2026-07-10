import { Suspense } from "react";
import type { Metadata } from "next";
import { isGoogleAuthConfigured } from "@/lib/auth-config";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient googleConfigured={isGoogleAuthConfigured()} />
    </Suspense>
  );
}
