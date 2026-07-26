/**
 * Regra: após upload OK no YouTube (ou redes), apagar o(s) arquivo(s) local(is)
 * na VPS — o render final e artefatos regeneráveis (props, clipes em public/).
 * Marcadores `.uploaded.json` não devem ser passados aqui.
 */
import { unlink } from "node:fs/promises";

export type CleanupAfterPublishResult = {
  deleted: string[];
  missing: string[];
  failed: Array<{ path: string; error: string }>;
};

export async function cleanupLocalFilesAfterSuccessfulPublish(
  paths: Array<string | null | undefined>,
): Promise<CleanupAfterPublishResult> {
  const deleted: string[] = [];
  const missing: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];
  const seen = new Set<string>();

  for (const raw of paths) {
    if (!raw) continue;
    const filePath = raw.trim();
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);

    try {
      await unlink(filePath);
      deleted.push(filePath);
      console.log(`[videoparada/cleanup] apagado: ${filePath}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        missing.push(filePath);
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ path: filePath, error: message });
      console.warn(`[videoparada/cleanup] falha ao apagar ${filePath}: ${message}`);
    }
  }

  return { deleted, missing, failed };
}
