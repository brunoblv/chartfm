import type { Metadata } from "next";
import Script from "next/script";
import { getServerSession } from "next-auth";
import { GoogleAnalytics } from '@next/third-parties/google'

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
      <head>
        <meta
          name="google-adsense-account"
          content="ca-pub-4600084865044867"
        />
      </head>

      <body>
        <Script
          id="adsense-script"
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4600084865044867"
          crossOrigin="anonymous"
        />

        <Providers session={session}>
          {children}
        </Providers>
      </body>
      <GoogleAnalytics gaId="G-VKENNK522F" />
    </html>
  );
}