import {
  Disc3,
  Headphones,
  Megaphone,
  Music2,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { MomentType } from "@/lib/moments-feed";

export type MomentTypeMeta = {
  labelKey: string;
  Icon: LucideIcon;
};

/** Metadados de exibição dos tipos de Momento publicáveis. */
export const MOMENT_TYPE_META: Record<MomentType, MomentTypeMeta> = {
  loop: { labelKey: "moments.typeLoop", Icon: Headphones },
  descobri: { labelKey: "moments.typeDescobri", Icon: Search },
  recomendo: { labelKey: "moments.typeRecomendo", Icon: Disc3 },
  lancamento: { labelKey: "moments.typeLancamento", Icon: Megaphone },
  review: { labelKey: "moments.typeReview", Icon: Star },
  throwback: { labelKey: "moments.typeThrowback", Icon: Music2 },
};

/** Metadados dos tipos automáticos (gerados pelo sistema, não publicáveis). */
export const AUTO_MOMENT_TYPE_META: Record<"subiu" | "caiu", MomentTypeMeta> = {
  subiu: { labelKey: "moments.typeSubiu", Icon: TrendingUp },
  caiu: { labelKey: "moments.typeCaiu", Icon: TrendingDown },
};
