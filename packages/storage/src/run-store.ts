import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePrediction, parseRace, type Prediction, type Race } from "@keiba-ai-assistant/models";

export interface RunStoreOptions {
  rootDir?: string;
}

const defaultRootDir = "runs";

export function getRunDir(raceId: string, options: RunStoreOptions = {}): string {
  return join(options.rootDir ?? defaultRootDir, raceId);
}

export async function ensureRunDir(raceId: string, options: RunStoreOptions = {}): Promise<string> {
  const runDir = getRunDir(raceId, options);
  await mkdir(runDir, { recursive: true });
  return runDir;
}

export async function writeRace(race: Race, options: RunStoreOptions = {}): Promise<void> {
  const runDir = await ensureRunDir(race.id, options);
  await writeJson(join(runDir, "race.json"), parseRace(race));
}

export async function readRace(raceId: string, options: RunStoreOptions = {}): Promise<Race> {
  const json = await readJson(join(getRunDir(raceId, options), "race.json"));
  return parseRace(json);
}

export async function writePrediction(
  prediction: Prediction,
  options: RunStoreOptions = {}
): Promise<void> {
  const runDir = await ensureRunDir(prediction.raceId, options);
  await writeJson(join(runDir, "prediction.json"), parsePrediction(prediction));
}

export async function readPrediction(
  raceId: string,
  options: RunStoreOptions = {}
): Promise<Prediction> {
  const json = await readJson(join(getRunDir(raceId, options), "prediction.json"));
  return parsePrediction(json);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
