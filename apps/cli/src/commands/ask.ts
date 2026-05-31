import type { Command } from "commander";

export const registerAskCommand = (program: Command): void => {
  program
    .command("ask")
    .description("Ask a follow-up question about a race")
    .requiredOption("--race-id <raceId>", "Race ID")
    .argument("<question>", "Question")
    .action(() => {
      throw new Error("ask command is not implemented yet");
    });
};
