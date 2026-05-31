import type { Command } from "commander";
import { readPredictionPolicy } from "@keiba-ai-assistant/storage";

interface AskCommandOptions {
  raceId: string;
  policyPath?: string;
}

export const registerAskCommand = (program: Command): void => {
  program
    .command("ask")
    .description("Ask a follow-up question about a race")
    .requiredOption("--race-id <raceId>", "Race ID")
    .option("--policy-path <path>", "Prediction policy file path")
    .argument("<question>", "Question")
    .action(async (question: string, options: AskCommandOptions) => {
      await readPredictionPolicy({ policyPath: options.policyPath });
      throw new Error("ask command is not implemented yet");
    });
};
