import { describe, expect, test } from "vitest";
import {
  createPredictRaceJobStore,
  type PredictRaceJobStore
} from "@keiba-ai-assistant/web/server/usecases/predict-race-job-store";

describe("createPredictRaceJobStore", () => {
  test("ジョブを開始して進捗と完了状態を取得できる", async () => {
    // Arrange
    const store = createPredictRaceJobStore({
      predictRaceUseCase: async (input) => {
        input.onProgress?.("レースページを開いています。");
        return { raceId: "fixture-race" };
      },
      createJobId: () => "predict-job-001",
      now: createFixedNow()
    });

    // Act
    const started = store.start({ raceUrl: "https://race.netkeiba.com/race?race_id=fixture" });
    const actual = await waitForJobStatus(store, "predict-job-001", "succeeded");

    // Assert
    expect(started).toMatchObject({
      id: "predict-job-001",
      status: "running"
    });
    expect(actual).toMatchObject({
      id: "predict-job-001",
      status: "succeeded",
      raceId: "fixture-race"
    });
    expect(actual.messages).toEqual([
      "レース解析ジョブを作成しました。",
      "レース解析を開始しています。",
      "レースページを開いています。",
      "レース解析が完了しました: fixture-race"
    ]);
  });

  test("ジョブが失敗した場合はエラー状態として保持する", async () => {
    // Arrange
    const store = createPredictRaceJobStore({
      predictRaceUseCase: async (input) => {
        input.onProgress?.("AIでレース情報を構造化しています。");
        throw new Error("Codexの実行に失敗しました。");
      },
      createJobId: () => "predict-job-002",
      now: createFixedNow()
    });

    // Act
    store.start({ raceUrl: "https://race.netkeiba.com/race?race_id=fixture" });
    const actual = await waitForJobStatus(store, "predict-job-002", "failed");

    // Assert
    expect(actual).toMatchObject({
      id: "predict-job-002",
      status: "failed",
      error: "Codexの実行に失敗しました。"
    });
    expect(actual.messages.at(-1)).toBe("レース解析に失敗しました: Codexの実行に失敗しました。");
  });
});

/** ジョブテスト用に固定日時を返す関数を作る。 */
const createFixedNow = () => {
  return () => new Date("2026-06-04T12:00:00.000Z");
};

/** 指定ジョブが期待状態になるまで短く待つ。 */
const waitForJobStatus = async (
  store: PredictRaceJobStore,
  jobId: string,
  status: "succeeded" | "failed"
) => {
  for (let index = 0; index < 10; index += 1) {
    const job = store.findById(jobId);
    if (job?.status === status) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(`ジョブが ${status} になりませんでした。`);
};
