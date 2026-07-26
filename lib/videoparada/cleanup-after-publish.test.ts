import { mkdtemp, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupLocalFilesAfterSuccessfulPublish } from "./cleanup-after-publish";

describe("cleanupLocalFilesAfterSuccessfulPublish", () => {
  it("apaga arquivos existentes e ignora ausentes", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "videoparada-cleanup-"));
    const a = path.join(dir, "a.mp4");
    const b = path.join(dir, "b.json");
    const ghost = path.join(dir, "missing.mp4");
    await writeFile(a, "video");
    await writeFile(b, "{}");

    const result = await cleanupLocalFilesAfterSuccessfulPublish([a, b, ghost, a, null, ""]);

    expect(result.deleted.sort()).toEqual([a, b].sort());
    expect(result.missing).toEqual([ghost]);
    expect(result.failed).toEqual([]);
    await expect(access(a)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(b)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
