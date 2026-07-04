import type { ReactNode } from "react";
import Link from "next/link";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

type Section = {
  title: string;
  body: ReactNode[];
};

export function LegalPage({
  title,
  subtitle,
  updatedAt,
  sections,
}: {
  title: string;
  subtitle?: string;
  updatedAt?: string;
  sections: Section[];
}) {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle={subtitle} updatedAt={updatedAt}>
        {title}
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {sections.map((section, index) => (
          <div key={section.title} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {index > 0 && <InstitutionalDivider />}
            <InstitutionalSection title={section.title}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {section.body.map((paragraph, i) => (
                  <InstitutionalParagraph key={i}>{paragraph}</InstitutionalParagraph>
                ))}
              </div>
            </InstitutionalSection>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <InstitutionalParagraph>
          <Link href="/guides" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            Guias
          </Link>
          {" · "}
          <Link href="/contact" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            Contato
          </Link>
        </InstitutionalParagraph>
      </div>
    </InstitutionalLayout>
  );
}
