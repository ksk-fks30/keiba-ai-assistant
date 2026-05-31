import type { Command } from "commander";
import { collectRaceFromNetkeiba } from "@keiba-ai-assistant/scraper";

export const registerCollectCommand = (program: Command): void => {
  program
    .command("collect")
    .description("Collect race data")
    .requiredOption("--race-url <url>", "Race URL")
    .action(async (options: { raceUrl: string }) => {
      await collectRaceFromNetkeiba({ raceUrl: options.raceUrl });
    });
};
