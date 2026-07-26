/**
 * Upload do MP4 já renderizado (teste Top 20 Global).
 * Uso: npx tsx scripts/_tmp_upload_global_top20.ts
 */
import { prisma } from "../lib/prisma";
import { uploadVideoToChartFmYouTube } from "../lib/videoparada/youtube-upload";
import path from "node:path";

async function main() {
  const filePath = path.join(process.cwd(), "out", "videoparada-global-top20-landscape.mp4");
  const title = "ChartFM Top 20 Global - Semana 29, 2026 (teste)";
  const description = [
    "Teste de geração automática — Top 20 da Parada Global ChartFM.",
    "Semana: Semana 29 - 2026.",
    "",
    "https://chartfm.com",
    "",
    "#ChartFM #Global100 #teste",
  ].join("\n");

  console.log(`Uploading ${filePath}`);
  console.log(`Title: ${title}`);
  const uploaded = await uploadVideoToChartFmYouTube({
    filePath,
    title,
    description,
    tags: ["ChartFM", "Global 100", "parada", "teste"],
    privacyStatus: "public",
  });
  console.log(`OK: ${uploaded.url}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
