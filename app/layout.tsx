import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { GoogleAnalytics } from '@next/third-parties/google'
import Script from "next/script";

import "./globals.css";

import { Providers } from "./providers";
import { authOptions } from "@/lib/auth-options";

export const metadata: Metadata = {
  title: "ChartFM",
  description: "Crie sua parada musical semanal, descubra novos artistas e participe de comunidades no ChartFM. Rankings, reviews e curadoria musical feitos por fãs.",
  metadataBase: new URL("https://chartfm.com.br"),
};

const themeScript = `(function(){try{var t=localStorage.getItem('chartfm.theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}else if(t==='light'){document.documentElement.setAttribute('data-theme','light');}else if(!t||t==='auto'){if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}}catch(e){}})();`;

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
        {/* Anti-flash: runs before React hydration to set theme from localStorage */}
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "ChartFM",
              url: "https://chartfm.com.br",
              description: "Rede social de paradas musicais semanais. Publique seu ranking, acompanhe artistas e descubra curadores.",
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
                email: "contato@chartfm.app",
                contactType: "customer support",
              },
            }),
          }}
        />
      </head>

      <body>
        <Providers session={session}>
          {children}
        </Providers>
      </body>

      <GoogleAnalytics gaId="G-VKENNK522F" />
      <Script
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4600084865044867"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </html>
  );
}