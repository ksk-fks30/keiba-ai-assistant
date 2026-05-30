import type { Command } from "commander";

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start the local web app")
    .action(() => {
      throw new Error("serve command is not implemented yet");
    });
}
