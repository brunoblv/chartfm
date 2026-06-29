import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { GoogleAnalytics } from '@next/third-parties/google'

import "./globals.css";

import { ThemeScript } from "@/components/theme-script";
import { Providers } from "./providers";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { AdSenseScript } from "@/components/consent/AdSenseScript";
import { authOptions } from "@/lib/auth-options";
import { getServerLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "ChartFM",
  description: "Crie sua parada musical semanal, descubra novos artistas e participe de comunidades no ChartFM. Rankings, reviews e curadoria musical feitos por fãs.",
  metadataBase: new URL("https://chartfm.com.br"),
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const locale = await getServerLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta
          name="google-adsense-account"
          content="ca-pub-4600084865044867"
        />
        {/* Anti-flash: runs before React hydration to set theme from localStorage */}
        <ThemeScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "ChartFM",
              url: "https://chartfm.com.br",
              description: "Rede social de paradas musicais semanais. Publique seu ranking, acompanhe artistas e descubra fãs de música.",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://chartfm.com.br/communities?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "ChartFM",
              url: "https://chartfm.com.br",
              logo: "https://chartfm.com.br/logo.png",
              contactPoint: {
                "@type": "ContactPoint",
                email: "contato@chartfm.com.br",
                contactType: "customer support",
              },
            }),
          }}
        />
      </head>

      <body>
        <Providers session={session} initialLocale={locale}>
          {children}
        </Providers>
        <CookieConsent />
      </body>

      <GoogleAnalytics gaId="G-VKENNK522F" />
      <AdSenseScript />
    </html>
  );
}