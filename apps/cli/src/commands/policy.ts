import type { Command } from "commander";
import { readPredictionPolicy, type PolicyStoreOptions } from "@keiba-ai-assistant/storage";

interface PolicyCommandOptions {
  policyDir?: string | undefined;
  policyPath?: string | undefined;
}

export const registerPolicyCommand = (program: Command): void => {
  program
    .command("policy")
    .description("Show the prediction policy")
    .option("--policy-dir <path>", "Prediction policy directory path")
    .option("--policy-path <path>", "Prediction policy file path (compatibility)")
    .action(async (options: PolicyCommandOptions) => {
      const policy = await readPredictionPolicy(buildPolicyStoreOptions(options));
      console.log(policy.content);
    });
};

/** CLI オプションから予想方針の読み込み設定を組み立てる。 */
const buildPolicyStoreOptions = (options: PolicyCommandOptions): PolicyStoreOptions => {
  if (options.policyDir !== undefined && options.policyPath !== undefined) {
    throw new Error("--policy-dir と --policy-path は同時に指定できません。");
  }
  if (options.policyDir !== undefined) {
    return { policyDir: options.policyDir };
  }
  if (options.policyPath !== undefined) {
    return { policyPath: options.policyPath };
  }

  return {};
};
