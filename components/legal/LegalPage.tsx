import Link from "next/link";
import { Shell } from "@/components/layout/Shell";

type Section = {
  title: string;
  body: string[];
};

export function LegalPage({
  title,
  subtitle,
  updatedAt,
  sections,
}: {
  title: string;
  subtitle: string;
  updatedAt?: string;
  sections: Section[];
}) {
  return (
    <Shell title={title} subtitle={subtitle}>
      <article
        style={{
          maxWidth: 860,
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 14,
          padding: "28px 26px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        {updatedAt && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 22px 0" }}>
            Última atualização: {updatedAt}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {sections.map((section) => (
            <section key={section.title}>
              <h2 style={{ fontSize: 20, lineHeight: 1.2, letterSpacing: "-0.02em", margin: "0 0 10px 0" }}>
                {section.title}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} style={{ fontSize: 15, lineHeight: 1.65, color: "var(--text-subtle)", margin: "0 0 10px 0" }}>
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
        <div
          style={{
            marginTop: 28,
            paddingTop: 18,
            borderTop: "1px solid var(--divider)",
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <Link href="/guides" style={{ color: "#FA243C", textDecoration: "none" }}>Guias</Link>
          <Link href="/about" style={{ color: "#FA243C", textDecoration: "none" }}>Sobre</Link>
          <Link href="/contact" style={{ color: "#FA243C", textDecoration: "none" }}>Contato</Link>
          <Link href="/terms-of-use" style={{ color: "#FA243C", textDecoration: "none" }}>Termos de Uso</Link>
          <Link href="/privacy-policy" style={{ color: "#FA243C", textDecoration: "none" }}>Privacidade</Link>
        </div>
      </article>
    </Shell>
  );
}
