import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseQaAnswerDraft, parseQaEntry, type QaEntry } from "@keiba-ai-assistant/models";
import { isMissingFileError } from "@keiba-ai-assistant/storage/file-system";
import {
  ensureRunDir,
  getRunDir,
  type RunStoreOptions
} from "@keiba-ai-assistant/storage/run-store";

export const appendQaEntry = async (
  entry: QaEntry,
  options: RunStoreOptions = {}
): Promise<void> => {
  const runDir = await ensureRunDir(entry.raceId, options);
  await appendFile(
    join(runDir, "qa.jsonl"),
    `${JSON.stringify(normalizeQaEntry(entry))}\n`,
    "utf8"
  );
};

export const readQaEntries = async (
  raceId: string,
  options: RunStoreOptions = {}
): Promise<QaEntry[]> => {
  const path = join(getRunDir(raceId, options), "qa.jsonl");
  try {
    const content = await readFile(path, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => normalizeQaEntry(JSON.parse(line) as unknown));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
};

/** 保存済みQ&Aを検証し、answer 内の二重JSON文字列を回答本文へ正規化する。 */
const normalizeQaEntry = (value: unknown): QaEntry => {
  const entry = parseQaEntry(value);

  return parseQaEntry({
    ...entry,
    answer: normalizeAnswer(entry.answer)
  });
};

/** answer が `{\"answer\":\"...\"}` 形式の文字列なら本文だけを取り出す。 */
const normalizeAnswer = (answer: string): string => {
  const trimmedAnswer = answer.trim();
  try {
    const value = JSON.parse(trimmedAnswer) as unknown;
    return parseQaAnswerDraft(value).answer;
  } catch {
    return answer;
  }
};
