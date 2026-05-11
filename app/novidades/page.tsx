"use client";

import { Shell } from "@/components/layout/Shell";
import { Sparkles } from "lucide-react";

type Tag = "novo" | "melhoria" | "fix" | "design";

type Entry = {
  title: string;
  description: string;
  tag: Tag;
};

type Release = {
  date: string;       // ISO "YYYY-MM-DD"
  label: string;      // display date
  entries: Entry[];
};

const RELEASES: Release[] = [
  {
    date: "2026-05-11",
    label: "11 de maio de 2026",
    entries: [
      {
        title: "Upload de foto de perfil",
        tag: "novo",
        description:
          "Agora você pode adicionar ou trocar sua foto de perfil diretamente nas configurações, na aba Perfil. Aceita JPG, PNG e WebP até 5 MB. A foto substitui o avatar com as iniciais e aparece em todo o site.",
      },
      {
        title: "Logo personalizado da parada",
        tag: "novo",
        description:
          "A nova aba Parada nas configurações permite que você faça upload de um logo exclusivo para a sua parada. Quando definido, o logo aparece no lugar do mosaico das 4 capas na página de detalhes — tanto no desktop quanto no mobile. Se nenhum logo for enviado, o comportamento atual (4 capas em grade) é mantido.",
      },
      {
        title: 'Nova aba "Parada" nas configurações',
        tag: "design",
        description:
          "As configurações da parada (nome, tamanho e gêneros) foram agrupadas em uma aba dedicada, deixando a aba Perfil mais focada nos dados pessoais. O upload do logo também fica aqui.",
      },
    ],
  },
];

const TAG_META: Record<Tag, { label: string; bg: string; color: string }> = {
  novo:     { label: "Novo",      bg: "rgba(34,197,94,0.1)",  color: "#16a34a" },
  melhoria: { label: "Melhoria",  bg: "rgba(59,130,246,0.1)", color: "#2563eb" },
  fix:      { label: "Fix",       bg: "rgba(245,158,11,0.1)", color: "#d97706" },
  design:   { label: "Design",    bg: "rgba(168,85,247,0.1)", color: "#9333ea" },
};

function TagBadge({ tag }: { tag: Tag }) {
  const meta = TAG_META[tag];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        background: meta.bg,
        color: meta.color,
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
}

export default function NovidadesPage() {
  return (
    <Shell title="O que há de novo" subtitle="Acompanhe as últimas melhorias do ChartFM">
      <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 48 }}>

        {RELEASES.map((release) => (
          <section key={release.date}>
            {/* Date header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: "rgba(250,36,60,0.08)",
                  borderRadius: 100,
                  padding: "6px 14px 6px 10px",
                }}
              >
                <Sparkles size={14} color="#FA243C" />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#FA243C",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {release.label}
                </span>
              </div>
              <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
            </div>

            {/* Entries */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {release.entries.map((entry, i) => (
                <article
                  key={i}
                  style={{
                    background: "white",
                    borderRadius: 16,
                    border: "1px solid rgba(0,0,0,0.06)",
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#1D1D1F",
                        letterSpacing: "-0.02em",
                        flex: 1,
                        minWidth: 160,
                      }}
                    >
                      {entry.title}
                    </span>
                    <TagBadge tag={entry.tag} />
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#444",
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {entry.description}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Empty state / bottom note */}
        <p style={{ fontSize: 13, color: "#86868B", textAlign: "center", paddingBottom: 40 }}>
          Esta página é atualizada a cada novo lançamento.
        </p>
      </div>
    </Shell>
  );
}
