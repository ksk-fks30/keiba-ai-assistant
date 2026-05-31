import type { Command } from "commander";
import { readPredictionPolicy } from "@keiba-ai-assistant/storage";

interface AnalyzeCommandOptions {
  raceId: string;
  policyPath?: string;
}

export const registerAnalyzeCommand = (program: Command): void => {
  program
    .command("analyze")
    .description("Analyze a collected race")
    .requiredOption("--race-id <raceId>", "Race ID")
    .option("--policy-path <path>", "Prediction policy file path")
    .action(async (options: AnalyzeCommandOptions) => {
      await readPredictionPolicy({ policyPath: options.policyPath });
      throw new Error("analyze command is not implemented yet");
    });
};
