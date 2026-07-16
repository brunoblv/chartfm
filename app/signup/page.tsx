import { Suspense } from "react";
import type { Metadata } from "next";
import { isGoogleAuthConfigured } from "@/lib/auth-config";
import SignupClient from "./SignupClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupClient googleConfigured={isGoogleAuthConfigured()} />
    </Suspense>
  );
}
