import type { Command } from "commander";
import { readPredictionPolicy } from "@keiba-ai-assistant/storage";

interface PolicyCommandOptions {
  policyPath?: string;
}

export const registerPolicyCommand = (program: Command): void => {
  program
    .command("policy")
    .description("Show the prediction policy")
    .option("--policy-path <path>", "Prediction policy file path")
    .action(async (options: PolicyCommandOptions) => {
      const policy = await readPredictionPolicy({ policyPath: options.policyPath });
      console.log(policy.content);
    });
};
