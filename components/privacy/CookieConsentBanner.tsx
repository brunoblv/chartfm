"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "chartfm_cookie_consent";

type ConsentValue = "accepted" | "essential";

export function CookieConsentBanner() {
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    setShouldRender(true);
    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const saveConsent = (value: ConsentValue) => {
    localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent("chartfm-cookie-consent", { detail: value }));
    setVisible(false);
    window.setTimeout(() => setShouldRender(false), 220);
  };

  if (!shouldRender) return null;

  return (
    <>
      <div role="dialog" aria-live="polite" aria-label="Aviso de cookies" className="cookie-banner-wrapper">
        <div className={`cookie-banner ${visible ? "is-visible" : "is-hidden"}`}>
          <div className="cookie-banner-content">
            <div className="cookie-banner-title">Usamos cookies</div>
            <p className="cookie-banner-text">
              O ChartFM usa cookies essenciais para login e segurança. Com sua permissão, também podemos usar cookies de
              medição e anúncios, inclusive de parceiros como Google AdSense. Veja a{" "}
              <Link href="/privacy-policy" className="cookie-banner-link">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
          <div className="cookie-banner-actions">
            <button type="button" onClick={() => saveConsent("essential")} className="cookie-btn cookie-btn-secondary">
              Apenas essenciais
            </button>
            <button type="button" onClick={() => saveConsent("accepted")} className="cookie-btn cookie-btn-primary">
              Aceitar cookies
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .cookie-banner-wrapper {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          z-index: 300;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }

        .cookie-banner {
          width: min(100%, 840px);
          max-height: calc(100dvh - 24px - env(safe-area-inset-bottom, 0px));
          overflow-y: auto;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 14px;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.16);
          padding: 14px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: center;
          pointer-events: auto;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          opacity: 0;
          transform: translateY(10px) scale(0.98);
          transition: opacity 180ms ease, transform 220ms ease;
          will-change: opacity, transform;
        }

        .cookie-banner.is-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .cookie-banner.is-hidden {
          opacity: 0;
          transform: translateY(10px) scale(0.98);
        }

        .cookie-banner-content {
          min-width: 0;
        }

        .cookie-banner-title {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #1d1d1f;
          margin-bottom: 4px;
        }

        .cookie-banner-text {
          font-size: 13px;
          line-height: 1.45;
          color: #6b6b70;
          margin: 0;
        }

        .cookie-banner-link {
          color: #fa243c;
          font-weight: 600;
        }

        .cookie-banner-actions {
          display: flex;
          gap: 8px;
          flex-direction: column;
          width: 100%;
        }

        .cookie-btn {
          border-radius: 8px;
          min-height: 40px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 700;
          width: 100%;
          cursor: pointer;
        }

        .cookie-btn-secondary {
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: #ffffff;
          color: #1d1d1f;
        }

        .cookie-btn-primary {
          border: none;
          background: #1d1d1f;
          color: #ffffff;
        }

        @media (min-width: 640px) {
          .cookie-banner-wrapper {
            left: 16px;
            right: 16px;
            bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          }

          .cookie-banner {
            padding: 16px;
            gap: 16px;
            grid-template-columns: 1fr auto;
          }

          .cookie-banner-actions {
            flex-direction: row;
            justify-content: flex-end;
            width: auto;
          }

          .cookie-btn {
            width: auto;
            white-space: nowrap;
            padding: 10px 14px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cookie-banner {
            transition: none;
            transform: none;
          }

          .cookie-banner.is-hidden,
          .cookie-banner.is-visible {
            transform: none;
          }
        }
      `}</style>
    </>
  );
}
