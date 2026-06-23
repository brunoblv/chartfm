"use client";

const themeScript = `(function(){try{var t=localStorage.getItem('chartfm.theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}else if(t==='light'){document.documentElement.setAttribute('data-theme','light');}else if(!t||t==='auto'){if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}}catch(e){}})();`;

export function ThemeScript() {
  // React 19: only emit during SSR; the browser runs the script from HTML before hydration.
  if (typeof window !== "undefined") {
    return null;
  }

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}
