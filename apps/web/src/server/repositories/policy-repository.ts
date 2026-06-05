import type { PredictionPolicy } from "@keiba-ai-assistant/models";
import { readPredictionPolicy, type PolicyStoreOptions } from "@keiba-ai-assistant/storage";

/** Webのusecaseから予想方針をdomain modelとして取得するrepository。 */
export interface PolicyRepository {
  /** 予想方針ファイルを読み込み、PredictionPolicyとして返す。 */
  readPredictionPolicy: () => Promise<PredictionPolicy>;
}

/** policy repository の生成オプション。 */
export interface CreatePolicyRepositoryOptions {
  /** `packages/storage` に渡す予想方針読込設定。 */
  policyStoreOptions?: PolicyStoreOptions;
}

/** `policies/` 配下の予想方針ファイルをstorage経由で読み込むrepositoryを作る。 */
export const createPolicyRepository = (
  options: CreatePolicyRepositoryOptions = {}
): PolicyRepository => {
  const policyStoreOptions = options.policyStoreOptions ?? {};

  return {
    readPredictionPolicy: async () => {
      return await readPredictionPolicy(policyStoreOptions);
    }
  };
};
