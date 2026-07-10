import { EditorialPostPreviewCard } from "@/components/editorial/EditorialPostPreviewCard";
import type { EditorialPick } from "@/lib/editorial-picks-data";

export function FeedEditorialCard({ pick }: { pick: EditorialPick }) {
  return <EditorialPostPreviewCard pick={pick} previewImage={pick.previewImage ?? null} />;
}
