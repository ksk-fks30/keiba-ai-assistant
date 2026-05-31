#!/usr/bin/env -S tsx
import { Command } from "commander";
import { registerAnalyzeCommand } from "@keiba-ai-assistant/cli/commands/analyze";
import { registerAskCommand } from "@keiba-ai-assistant/cli/commands/ask";
import { registerCollectCommand } from "@keiba-ai-assistant/cli/commands/collect";
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
registerAnalyzeCommand(program);
registerAskCommand(program);

await program.parseAsync();
