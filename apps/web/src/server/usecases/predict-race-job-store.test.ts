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

  test("実行中ジョブがある場合は新しいジョブを開始しない", async () => {
    // Arrange
    const runningJobGate = createDeferred<void>();
    const startedRaceUrls: string[] = [];
    const store = createPredictRaceJobStore({
      predictRaceUseCase: async (input) => {
        startedRaceUrls.push(input.raceUrl);
        await runningJobGate.promise;
        return { raceId: "fixture-race" };
      },
      createJobId: createSequentialJobId(),
      now: createFixedNow()
    });
    const firstJob = store.start({
      raceUrl: "https://race.netkeiba.com/race?race_id=fixture-first"
    });

    // Act
    const actual = () =>
      store.start({
        raceUrl: "https://race.netkeiba.com/race?race_id=fixture-second"
      });

    // Assert
    expect(actual).toThrow("別のレース解析ジョブが実行中です。");
    expect(startedRaceUrls).toEqual(["https://race.netkeiba.com/race?race_id=fixture-first"]);
    expect(store.findById(firstJob.id)).toMatchObject({
      id: firstJob.id,
      status: "running"
    });

    runningJobGate.resolve();
    await waitForJobStatus(store, firstJob.id, "succeeded");
  });
});

/** ジョブテスト用に固定日時を返す関数を作る。 */
const createFixedNow = () => {
  return () => new Date("2026-06-04T12:00:00.000Z");
};

/** 呼び出しごとに連番のジョブIDを返す関数を作る。 */
const createSequentialJobId = () => {
  let index = 0;

  return () => {
    index += 1;
    return `predict-job-${String(index).padStart(3, "0")}`;
  };
};

/** 非同期処理をテスト側から進めるためのDeferred。 */
interface Deferred<T> {
  /** 待機対象のPromise。 */
  promise: Promise<T>;
  /** Promiseを成功として解決する。 */
  resolve: (value: T | PromiseLike<T>) => void;
}

/** Promiseの解決タイミングをテスト側で制御できるDeferredを作る。 */
const createDeferred = <T>(): Deferred<T> => {
  let resolve: ((value: T | PromiseLike<T>) => void) | undefined;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  if (resolve === undefined) {
    throw new Error("Deferredの初期化に失敗しました。");
  }

  return { promise, resolve };
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
