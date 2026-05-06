import type { Metadata } from "next";
import Script from "next/script";
import { getServerSession } from "next-auth";

import "./globals.css";

import { Providers } from "./providers";
import { authOptions } from "@/lib/auth-options";

export const metadata: Metadata = {
  title: "ChartFM",
  description: "Compartilhe sua parada musical semanal com o mundo.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Script
          id="profitablecpm-network-script"
          strategy="afterInteractive"
          src="https://pl29363019.profitablecpmratenetwork.com/a0/c3/dd/a0c3dda5049d5ce35a4c2fc66b14b8d7.js"
        />

        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}