"use client";

import Link from "next/link";
import { Radio, Disc3 } from "lucide-react";
import { GLOBAL_GENRE_CHARTS } from "@/lib/global-genre-charts";

type SecondaryCard = {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  gradient: string;
};

const SECONDARY_CARDS: SecondaryCard[] = [
  {
    href: "/global/airplay",
    title: "Global 100 Airplay",
    description: "As músicas mais ouvidas de verdade pela comunidade, via histórico do Last.fm.",
    badge: "Last.fm",
    icon: <Radio size={21} strokeWidth={2} />,
    gradient: "linear-gradient(135deg, #8338EC 0%, #3A86FF 100%)",
  },
  {
    href: "/global/albums",
    title: "Global 100 Álbuns",
    description: "Os álbuns mais ouvidos pela comunidade na semana, via Last.fm.",
    badge: "Last.fm",
    icon: <Disc3 size={21} strokeWidth={2} />,
    gradient: "linear-gradient(135deg, #06D6A0 0%, #073B4C 100%)",
  },
];

/** Airplay e Álbuns — um degrau abaixo do hero da Global 100. */
export function GlobalSecondaryCards() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
      {SECONDARY_CARDS.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          prefetch={false}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 24,
            borderRadius: 18,
            border: "1px solid var(--divider)",
            background: "var(--surface)",
            textDecoration: "none",
            color: "inherit",
            transition: "box-shadow 160ms ease, transform 160ms ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: card.gradient,
                color: "white",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {card.icon}
            </div>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "4px 9px",
                borderRadius: 8,
                background: "var(--fill-subtle)",
              }}
            >
              {card.badge}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
              {card.title}
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-muted)", margin: 0 }}>
              {card.description}
            </p>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)", marginTop: "auto" }}>
            Ver ranking →
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Paradas por gênero — lista compacta de pills, não mais cards grandes competindo com o hero. */
export function GlobalGenreList() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {GLOBAL_GENRE_CHARTS.map((g) => (
        <Link
          key={g.slug}
          href={`/global/genre/${g.slug}`}
          prefetch={false}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 16px",
            borderRadius: 100,
            border: "1px solid var(--divider-strong)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${g.color[0]}, ${g.color[1]})`,
              flexShrink: 0,
            }}
          />
          {g.shortName}
        </Link>
      ))}
    </div>
  );
}
