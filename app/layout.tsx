import type { Metadata } from "next";
import Script from "next/script";
import { getServerSession } from "next-auth";
import "./globals.css";
import { Providers } from "./providers";
import { authOptions } from "@/lib/auth-options";

export const metadata: Metadata = {
  title: "ChartFM",
  description: "Compartilhe sua parada musical semanal com o mundo.",
  other: {
    "google-adsense-account": "ca-pub-4600084865044867",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4600084865044867"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
