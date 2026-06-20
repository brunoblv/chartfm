"use client";

import Link from "next/link";
import { BarChart2, Disc3, Radio } from "lucide-react";

type GlobalHubCard = {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  gradient: string;
};

const CARDS: GlobalHubCard[] = [
  {
    href: "/global/100",
    title: "Global 100",
    description: "As músicas mais populares da semana, com base nas paradas pessoais da comunidade.",
    badge: "Paradas",
    icon: <BarChart2 size={24} strokeWidth={2} />,
    gradient: "linear-gradient(135deg, #FA243C 0%, #FF5858 100%)",
  },
  {
    href: "/global/airplay",
    title: "Global 100 Air Play",
    description: "As músicas mais ouvidas pelos usuários na semana. Cadastre seu Last.fm nas configurações para participar.",
    badge: "Last.fm",
    icon: <Radio size={24} strokeWidth={2} />,
    gradient: "linear-gradient(135deg, #8338EC 0%, #3A86FF 100%)",
  },
  {
    href: "/global/albums",
    title: "Global 100 Álbuns",
    description: "Os álbuns mais ouvidos pelos usuários na semana. Cadastre seu Last.fm nas configurações para participar.",
    badge: "Last.fm",
    icon: <Disc3 size={24} strokeWidth={2} />,
    gradient: "linear-gradient(135deg, #06D6A0 0%, #073B4C 100%)",
  },
];

export function GlobalHubCards() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
        marginBottom: 48,
      }}
    >
      {CARDS.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: "22px 22px 20px",
            borderRadius: 16,
            border: "1px solid var(--divider)",
            background: "var(--surface)",
            textDecoration: "none",
            color: "inherit",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: card.gradient,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {card.icon}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "4px 8px",
                borderRadius: 8,
                background: "var(--fill-subtle)",
              }}
            >
              {card.badge}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>{card.title}</div>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-muted)", margin: 0 }}>{card.description}</p>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginTop: "auto" }}>
            Ver ranking →
          </div>
        </Link>
      ))}
    </div>
  );
}
