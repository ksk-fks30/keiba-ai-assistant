#!/usr/bin/env -S tsx
import { Command } from "commander";
import { registerAnalyzeCommand } from "@keiba-ai-assistant/cli/commands/analyze";
import { registerAskCommand, registerQaHistoryCommand } from "@keiba-ai-assistant/cli/commands/ask";
import { registerCollectCommand } from "@keiba-ai-assistant/cli/commands/collect";
import { registerImportRaceCommand } from "@keiba-ai-assistant/cli/commands/import-race";
import { registerPolicyCommand } from "@keiba-ai-assistant/cli/commands/policy";
import { registerServeCommand } from "@keiba-ai-assistant/cli/commands/serve";

const program = new Command();

program
  .name("keiba-ai-assistant")
  .description("Local horse-racing prediction assistant")
  .version("0.0.0");

registerServeCommand(program);
registerCollectCommand(program);
registerPolicyCommand(program);
registerImportRaceCommand(program);
registerAnalyzeCommand(program);
registerAskCommand(program);
registerQaHistoryCommand(program);

await program.parseAsync();
