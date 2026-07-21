import type { Metadata } from "next";
import {
  Briefcase,
  Bug,
  Mail,
  Shield,
} from "lucide-react";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalIconCard,
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("contact.metaTitle"),
    description: t("contact.metaDescription"),
    alternates: { canonical: "/contact" },
  };
}

export default async function ContactPage() {
  const { t } = await getServerTranslations();

  const CONTACT_ITEMS = [
    {
      icon: <Mail size={20} />,
      title: t("contact.itemEmailTitle"),
      description: t("contact.itemEmailDesc"),
    },
    {
      icon: <Shield size={20} />,
      title: t("contact.itemPrivacyTitle"),
      description: t("contact.itemPrivacyDesc"),
      href: "/data-deletion",
    },
    {
      icon: <Bug size={20} />,
      title: t("contact.itemBugTitle"),
      description: t("contact.itemBugDesc"),
    },
    {
      icon: <Briefcase size={20} />,
      title: t("contact.itemPartnersTitle"),
      description: t("contact.itemPartnersDesc"),
    },
  ];

  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle={t("contact.pageSubtitle")}>
        {t("contact.title")}
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
        {CONTACT_ITEMS.map((item) => (
          <InstitutionalIconCard
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
            href={"href" in item ? item.href : undefined}
            email={"href" in item ? undefined : "contato@chartfm.com.br"}
          />
        ))}
      </div>

      <InstitutionalMutedCallout>
        {t("contact.calloutPrefix")} <strong style={{ color: "var(--text)" }}>{t("contact.calloutBold")}</strong>
        {t("contact.calloutMiddle")} <InstitutionalInlineLink href="/guides">{t("contact.calloutLinkText")}</InstitutionalInlineLink>{" "}
        {t("contact.calloutSuffix")}
      </InstitutionalMutedCallout>
    </InstitutionalLayout>
  );
}
