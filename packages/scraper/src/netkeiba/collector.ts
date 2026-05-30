import { parseRace, type Race } from "@keiba-ai-assistant/models";
import { createBrowserSession } from "@keiba-ai-assistant/scraper/netkeiba/browser";
import { waitForNextPage } from "@keiba-ai-assistant/scraper/netkeiba/rate-limit";

export interface CollectRaceInput {
  raceUrl: string;
  minDelayMs?: number;
}

export async function collectRaceFromNetkeiba(input: CollectRaceInput): Promise<Race> {
  const session = await createBrowserSession();

  try {
    await session.page.goto(input.raceUrl, { waitUntil: "domcontentloaded" });
    await waitForNextPage({ minDelayMs: input.minDelayMs ?? 3000 });

    throw new Error("netKeiba collector is not implemented yet");
  } finally {
    await session.close();
  }
}

export function parseCollectedRace(value: unknown): Race {
  return parseRace(value);
}
