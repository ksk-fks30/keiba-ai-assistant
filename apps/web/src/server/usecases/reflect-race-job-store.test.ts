import { describe, expect, test } from "vitest";
import {
  createReflectRaceJobStore,
  type ReflectRaceJobStore
} from "@keiba-ai-assistant/web/server/usecases/reflect-race-job-store";

describe("createReflectRaceJobStore", () => {
  test("ジョブを開始して進捗と完了状態を取得できる", async () => {
    // Arrange
    const store = createReflectRaceJobStore({
      reflectRaceUseCase: async (input) => {
        input.onProgress?.("レース結果ページを開いています。");
        return { raceId: input.raceId };
      },
      createJobId: () => "reflect-job-001",
      now: createFixedNow()
    });

    // Act
    const started = store.start({ raceId: "fixture-race" });
    const actual = await waitForJobStatus(store, "reflect-job-001", "succeeded");

    // Assert
    expect(started).toMatchObject({
      id: "reflect-job-001",
      status: "running",
      raceId: "fixture-race"
    });
    expect(actual).toMatchObject({
      id: "reflect-job-001",
      status: "succeeded",
      raceId: "fixture-race"
    });
    expect(actual.messages).toEqual([
      "レース振り返りジョブを作成しました。",
      "レース結果の取得と振り返りを開始しています。",
      "レース結果ページを開いています。",
      "レース振り返りが完了しました: fixture-race"
    ]);
  });

  test("ジョブが失敗した場合はエラー状態として保持する", async () => {
    // Arrange
    const store = createReflectRaceJobStore({
      reflectRaceUseCase: async (input) => {
        input.onProgress?.("Codexでレース結果を振り返っています。");
        throw new Error("Codexの実行に失敗しました。");
      },
      createJobId: () => "reflect-job-002",
      now: createFixedNow()
    });

    // Act
    store.start({ raceId: "fixture-race" });
    const actual = await waitForJobStatus(store, "reflect-job-002", "failed");

    // Assert
    expect(actual).toMatchObject({
      id: "reflect-job-002",
      status: "failed",
      raceId: "fixture-race",
      error: "Codexの実行に失敗しました。"
    });
    expect(actual.messages.at(-1)).toBe(
      "レース振り返りに失敗しました: Codexの実行に失敗しました。"
    );
  });

  test("実行中ジョブがある場合は新しいジョブを開始しない", async () => {
    // Arrange
    const runningJobGate = createDeferred<void>();
    const startedRaceIds: string[] = [];
    const store = createReflectRaceJobStore({
      reflectRaceUseCase: async (input) => {
        startedRaceIds.push(input.raceId);
        await runningJobGate.promise;
        return { raceId: input.raceId };
      },
      createJobId: createSequentialJobId(),
      now: createFixedNow()
    });
    const firstJob = store.start({ raceId: "fixture-first" });

    // Act
    const actual = () => store.start({ raceId: "fixture-second" });

    // Assert
    expect(actual).toThrow("別のレース振り返りジョブが実行中です。");
    expect(startedRaceIds).toEqual(["fixture-first"]);
    expect(store.findById(firstJob.id)).toMatchObject({
      id: firstJob.id,
      status: "running"
    });

    runningJobGate.resolve(undefined);
    await waitForJobStatus(store, firstJob.id, "succeeded");
  });
});

/** ジョブテスト用に固定日時を返す関数を作る。 */
const createFixedNow = () => {
  return () => new Date("2026-06-07T16:20:00.000Z");
};

/** 呼び出しごとに連番のジョブIDを返す関数を作る。 */
const createSequentialJobId = () => {
  let index = 0;

  return () => {
    index += 1;
    return `reflect-job-${String(index).padStart(3, "0")}`;
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
  store: ReflectRaceJobStore,
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
