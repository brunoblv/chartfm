import type { Metadata } from "next";
import { WhatsNewClient } from "./WhatsNewClient";

export const metadata: Metadata = {
  title: "O que há de novo | ChartFM",
  description: "Registro das mudanças e melhorias feitas no ChartFM.",
  alternates: { canonical: "/whats-new" },
};

export default function WhatsNewPage() {
  return <WhatsNewClient />;
}
