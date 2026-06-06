#!/usr/bin/env -S tsx
import { Command } from "commander";
import { registerAnalyzeCommand } from "@keiba-ai-assistant/cli/commands/analyze";
import { registerAskCommand, registerQaHistoryCommand } from "@keiba-ai-assistant/cli/commands/ask";
import { registerCollectCommand } from "@keiba-ai-assistant/cli/commands/collect";
import { registerImportRaceCommand } from "@keiba-ai-assistant/cli/commands/import-race";
import { registerLessonsCommand } from "@keiba-ai-assistant/cli/commands/lessons";
import { registerPolicyCommand } from "@keiba-ai-assistant/cli/commands/policy";
import { registerPredictCommand } from "@keiba-ai-assistant/cli/commands/predict";
import { registerServeCommand } from "@keiba-ai-assistant/cli/commands/serve";

const program = new Command();

/** CLI action で発生した例外を、スタックトレースではなく利用者向けメッセージに整形する。 */
const formatCliError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

program
  .name("keiba-ai-assistant")
  .description("Local horse-racing prediction assistant")
  .version("0.0.0");

registerServeCommand(program);
registerCollectCommand(program);
registerPredictCommand(program);
registerPolicyCommand(program);
registerImportRaceCommand(program);
registerAnalyzeCommand(program);
registerLessonsCommand(program);
registerAskCommand(program);
registerQaHistoryCommand(program);

try {
  await program.parseAsync();
} catch (error) {
  console.error(formatCliError(error));
  process.exitCode = 1;
}
