import { Suspense } from "react";
import { isGoogleAuthConfigured } from "@/lib/auth-config";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient googleConfigured={isGoogleAuthConfigured()} />
    </Suspense>
  );
}
