import { askRace as generateRaceAnswer, type AskRaceInput } from "@keiba-ai-assistant/ai";
import type { Prediction, PredictionPolicy, QaEntry, Race } from "@keiba-ai-assistant/models";
import type { PolicyRepository } from "@keiba-ai-assistant/web/server/repositories/policy-repository";
import type { RunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";

/** race詳細ページから追加質問を送る入力。 */
export interface AskRaceUseCaseInput {
  /** 追加質問対象のrace ID。 */
  raceId: string;
  /** ユーザーが入力した質問本文。 */
  question: string;
  /** Codex SDKに渡すモデル名。未指定の場合は既定のモデルを使う。 */
  model?: string | undefined;
  /** Codex SDK 実行を待つ最大時間。未指定の場合はusecase既定値を使う。 */
  timeoutMs?: number | undefined;
}

/** 追加質問usecaseの依存関係。 */
export interface AskRaceUseCaseDependencies {
  /** 保存済みrunを取得・更新するrepository。 */
  runRepository: RunRepository;
  /** 予想方針を取得するrepository。 */
  policyRepository: PolicyRepository;
  /** 追加質問をAIへ渡す関数。テストでは差し替える。 */
  askRace?: ((input: AskRaceInput) => Promise<QaEntry>) | undefined;
  /** WebリクエストでCodex SDK実行を待つ最大時間。 */
  timeoutMs?: number | undefined;
}

/** race詳細ページから追加質問を実行し、保存されたQ&Aを返すusecase。 */
export type AskRaceUseCase = (input: AskRaceUseCaseInput) => Promise<QaEntry>;

/** packages/ai の追加質問入力を組み立てるための中間入力。 */
interface BuildAskRaceInput {
  /** 構造化済みのレース情報。 */
  race: Race;
  /** 保存済みの予想結果。 */
  prediction: Prediction;
  /** ユーザーが管理する予想方針。 */
  policy: PredictionPolicy;
  /** 同じレースに対する過去のQ&A履歴。 */
  history: QaEntry[];
  /** 今回の追加質問。 */
  question: string;
  /** この質問で利用する Codex モデル名。 */
  model?: string | undefined;
  /** Codex SDK 実行を待つ最大時間。 */
  timeoutMs?: number | undefined;
}

const defaultAskTimeoutMs = 180_000;

/** repositoryとAI実行関数を注入して、追加質問usecaseを作る。 */
export const createAskRaceUseCase = (dependencies: AskRaceUseCaseDependencies): AskRaceUseCase => {
  const askRace = dependencies.askRace ?? generateRaceAnswer;
  const timeoutMs = dependencies.timeoutMs ?? defaultAskTimeoutMs;

  return async (input) => {
    const question = input.question.trim();
    if (question.length === 0) {
      throw new Error("質問を入力してください。");
    }

    const race = await dependencies.runRepository.findRaceById(input.raceId);
    if (race === null) {
      throw new Error(`race.json が見つかりません: ${input.raceId}`);
    }

    const prediction = await dependencies.runRepository.findPredictionByRaceId(input.raceId);
    if (prediction === null) {
      throw new Error(`prediction.json が見つかりません: ${input.raceId}`);
    }

    const [history, policy] = await Promise.all([
      dependencies.runRepository.findQaEntriesByRaceId(input.raceId),
      dependencies.policyRepository.readPredictionPolicy()
    ]);
    const entry = await askRace(
      buildAskRaceInput({
        race,
        prediction,
        policy,
        history,
        question,
        model: input.model,
        timeoutMs: input.timeoutMs ?? timeoutMs
      })
    );

    // AI回答は生成後すぐqa.jsonlへ追記し、画面再表示時に同じ履歴として読める状態にする。
    await dependencies.runRepository.appendQaEntry(entry);

    return entry;
  };
};

/** Web入力と保存済みデータを packages/ai の追加質問入力へ変換する。 */
const buildAskRaceInput = (input: BuildAskRaceInput): AskRaceInput => {
  const askRaceInput: AskRaceInput = {
    race: input.race,
    prediction: input.prediction,
    policy: input.policy,
    history: input.history,
    question: input.question
  };

  if (input.model !== undefined) {
    askRaceInput.model = input.model;
  }
  if (input.timeoutMs !== undefined) {
    askRaceInput.timeoutMs = input.timeoutMs;
  }

  return askRaceInput;
};
