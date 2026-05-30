import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseQaEntry, type QaEntry } from "@keiba-ai-assistant/models";
import {
  ensureRunDir,
  getRunDir,
  type RunStoreOptions
} from "@keiba-ai-assistant/storage/run-store";

export async function appendQaEntry(entry: QaEntry, options: RunStoreOptions = {}): Promise<void> {
  const runDir = await ensureRunDir(entry.raceId, options);
  await appendFile(join(runDir, "qa.jsonl"), `${JSON.stringify(parseQaEntry(entry))}\n`, "utf8");
}

export async function readQaEntries(
  raceId: string,
  options: RunStoreOptions = {}
): Promise<QaEntry[]> {
  const path = join(getRunDir(raceId, options), "qa.jsonl");
  try {
    const content = await readFile(path, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => parseQaEntry(JSON.parse(line) as unknown));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
