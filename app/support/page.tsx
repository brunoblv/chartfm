import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportClient } from "./SupportClient";

export const metadata: Metadata = {
  title: "Suporte | ChartFM",
  description: "Abra tickets de bugs e sugestões para a equipe do ChartFM.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <Suspense>
      <SupportClient />
    </Suspense>
  );
}
