"use client";

import { useSyncExternalStore } from "react";

const themeScript = `(function(){try{var t=localStorage.getItem('chartfm.theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}else if(t==='light'){document.documentElement.setAttribute('data-theme','light');}else if(!t||t==='auto'){if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}}catch(e){}})();`;

function useIsServerRender() {
  return useSyncExternalStore(
    () => () => {},
    () => false,
    () => true,
  );
}

function ThemeScriptElement() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}

export function ThemeScript() {
  const isServerRender = useIsServerRender();
  if (!isServerRender) {
    return null;
  }
  return <ThemeScriptElement />;
}
