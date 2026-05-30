import type { Command } from "commander";

export function registerAnalyzeCommand(program: Command): void {
  program
    .command("analyze")
    .description("Analyze a collected race")
    .requiredOption("--race-id <raceId>", "Race ID")
    .action(() => {
      throw new Error("analyze command is not implemented yet");
    });
}
