"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "@/hooks/useTranslations";

export function InstitutionalTitle({
  children,
  updatedAt,
  subtitle,
}: {
  children: ReactNode;
  updatedAt?: string;
  subtitle?: string;
}) {
  const { t } = useTranslations();
  return (
    <>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          marginBottom: 8,
          color: "var(--text)",
          marginTop: 0,
        }}
      >
        {children}
      </h1>
      {subtitle && (
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 32, marginTop: 0 }}>
          {subtitle}
        </p>
      )}
      {updatedAt && !subtitle && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32, marginTop: 0 }}>
          {t("legal.lastUpdated", { date: updatedAt })}
        </p>
      )}
      {updatedAt && subtitle && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 32px 0" }}>
          {t("legal.lastUpdated", { date: updatedAt })}
        </p>
      )}
    </>
  );
}

export function InstitutionalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 10,
          letterSpacing: "-0.02em",
          marginTop: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function InstitutionalDivider() {
  return <div style={{ height: 1, background: "var(--divider)" }} />;
}

export function InstitutionalParagraph({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 15,
        lineHeight: 1.75,
        color: "var(--text-subtle)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

export function InstitutionalList({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        paddingLeft: 20,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        margin: 0,
        fontSize: 15,
        lineHeight: 1.8,
        color: "var(--text-subtle)",
      }}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function InstitutionalCallout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        borderRadius: 14,
        padding: "20px 22px",
      }}
    >
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

export function InstitutionalMutedCallout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--fill-subtle)",
        borderRadius: 14,
        padding: "20px 22px",
      }}
    >
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

export function InstitutionalIconCard({
  icon,
  title,
  description,
  href,
  email,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href?: string;
  email?: string;
}) {
  const content = (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        borderRadius: 14,
        padding: "20px 22px",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "var(--accent-tint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "var(--accent)",
        }}
      >
        {icon}
      </div>
      <div>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: 6,
            letterSpacing: "-0.02em",
            marginTop: 0,
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-muted)", margin: "0 0 4px 0" }}>
          {description}
        </p>
        {email && (
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>{email}</span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {content}
      </Link>
    );
  }

  return content;
}

export function InstitutionalInlineLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        color: "var(--accent)",
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
