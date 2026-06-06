import { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { createHomeRoutes } from "@keiba-ai-assistant/web/server/routes/home";
import type { PredictRaceJobSnapshot } from "@keiba-ai-assistant/web/server/usecases/predict-race-job-store";
import type { HomePageProps } from "@keiba-ai-assistant/web/server/usecases/show-home";

describe("createHomeRoutes", () => {
  test("トップ画面propsをrenderへ渡す", async () => {
    // Arrange
    const props: HomePageProps = { runs: [] };
    const app = createTestApp({
      showHomeUseCase: async () => props,
      predictRaceJobStore: {
        start: () => {
          throw new Error("GETではジョブを開始しない");
        },
        findById: () => {
          throw new Error("GETではジョブ状態を読まない");
        },
        abort: () => {
          throw new Error("GETではジョブを中止しない");
        }
      }
    });

    // Act
    const response = await app.request("/");
    const actual = (await response.json()) as unknown;

    // Assert
    expect(response.status).toBe(200);
    expect(actual).toEqual({
      page: "Home",
      props
    });
  });

  test("フォームのURLでレース解析ジョブを開始できる", async () => {
    // Arrange
    const raceUrl = "https://race.netkeiba.com/race/shutuba.html?race_id=202605030211";
    const job = createPredictRaceJobSnapshot();
    let actualRaceUrl: string | null = null;
    const app = createTestApp({
      showHomeUseCase: async () => {
        throw new Error("POSTではトップpropsを読まない");
      },
      predictRaceJobStore: {
        start: (input) => {
          actualRaceUrl = input.raceUrl;
          return job;
        },
        findById: () => {
          throw new Error("POSTではジョブ状態を読まない");
        },
        abort: () => {
          throw new Error("POSTではジョブを中止しない");
        }
      }
    });
    const formData = new FormData();
    formData.set("raceUrl", raceUrl);

    // Act
    const response = await app.request("/races/predict-jobs", {
      method: "POST",
      body: formData
    });
    const actual = (await response.json()) as unknown;

    // Assert
    expect(response.status).toBe(202);
    expect(actual).toEqual(job);
    expect(actualRaceUrl).toBe(raceUrl);
  });

  test("JSONのURLでレース解析ジョブを開始できる", async () => {
    // Arrange
    const raceUrl = "https://race.netkeiba.com/race/shutuba.html?race_id=202605030211";
    const job = createPredictRaceJobSnapshot();
    let actualRaceUrl: string | null = null;
    const app = createTestApp({
      showHomeUseCase: async () => {
        throw new Error("POSTではトップpropsを読まない");
      },
      predictRaceJobStore: {
        start: (input) => {
          actualRaceUrl = input.raceUrl;
          return job;
        },
        findById: () => {
          throw new Error("POSTではジョブ状態を読まない");
        },
        abort: () => {
          throw new Error("POSTではジョブを中止しない");
        }
      }
    });

    // Act
    const response = await app.request("/races/predict-jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raceUrl })
    });
    const actual = (await response.json()) as unknown;

    // Assert
    expect(response.status).toBe(202);
    expect(actual).toEqual(job);
    expect(actualRaceUrl).toBe(raceUrl);
  });

  test("実行中ジョブがある場合は409で既存ジョブを返す", async () => {
    // Arrange
    const activeJob = createPredictRaceJobSnapshot();
    const app = createTestApp({
      showHomeUseCase: async () => {
        throw new Error("POSTではトップpropsを読まない");
      },
      predictRaceJobStore: {
        start: () => {
          throw createAlreadyRunningError(activeJob);
        },
        findById: () => {
          throw new Error("POSTではジョブ状態を読まない");
        },
        abort: () => {
          throw new Error("POSTではジョブを中止しない");
        }
      }
    });

    // Act
    const response = await app.request("/races/predict-jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        raceUrl: "https://race.netkeiba.com/race/shutuba.html?race_id=202605030211"
      })
    });
    const actual = (await response.json()) as unknown;

    // Assert
    expect(response.status).toBe(409);
    expect(actual).toEqual({
      error: "別のレース解析ジョブが実行中です。",
      job: activeJob
    });
  });

  test("ジョブIDからレース解析ジョブ状態を取得できる", async () => {
    // Arrange
    const job = createPredictRaceJobSnapshot();
    const app = createTestApp({
      showHomeUseCase: async () => {
        throw new Error("ジョブ状態取得ではトップpropsを読まない");
      },
      predictRaceJobStore: {
        start: () => {
          throw new Error("ジョブ状態取得ではジョブを開始しない");
        },
        findById: (jobId) => (jobId === job.id ? job : null),
        abort: () => {
          throw new Error("ジョブ状態取得ではジョブを中止しない");
        }
      }
    });

    // Act
    const response = await app.request(`/races/predict-jobs/${job.id}`);
    const actual = (await response.json()) as unknown;

    // Assert
    expect(response.status).toBe(200);
    expect(actual).toEqual(job);
  });

  test("存在しないジョブIDでは404を返す", async () => {
    // Arrange
    const app = createTestApp({
      showHomeUseCase: async () => {
        throw new Error("ジョブ状態取得ではトップpropsを読まない");
      },
      predictRaceJobStore: {
        start: () => {
          throw new Error("ジョブ状態取得ではジョブを開始しない");
        },
        findById: () => null,
        abort: () => {
          throw new Error("ジョブ状態取得ではジョブを中止しない");
        }
      }
    });

    // Act
    const response = await app.request("/races/predict-jobs/missing-job");
    const actual = (await response.json()) as unknown;

    // Assert
    expect(response.status).toBe(404);
    expect(actual).toEqual({ error: "レース解析ジョブが見つかりません。" });
  });

  test("ジョブIDからレース解析ジョブを中止できる", async () => {
    // Arrange
    const job = {
      ...createPredictRaceJobSnapshot(),
      status: "cancelling" as const,
      messages: [
        "レース解析を開始しています。",
        "レース解析ジョブを中止しています。実行中の処理が止まるまで待機します。"
      ]
    };
    const app = createTestApp({
      showHomeUseCase: async () => {
        throw new Error("ジョブ中止ではトップpropsを読まない");
      },
      predictRaceJobStore: {
        start: () => {
          throw new Error("ジョブ中止ではジョブを開始しない");
        },
        findById: () => {
          throw new Error("ジョブ中止ではジョブ状態を読まない");
        },
        abort: (jobId) => (jobId === job.id ? job : null)
      }
    });

    // Act
    const response = await app.request(`/races/predict-jobs/${job.id}`, { method: "DELETE" });
    const actual = (await response.json()) as unknown;

    // Assert
    expect(response.status).toBe(200);
    expect(actual).toEqual(job);
  });

  test("存在しないジョブIDの中止では404を返す", async () => {
    // Arrange
    const app = createTestApp({
      showHomeUseCase: async () => {
        throw new Error("ジョブ中止ではトップpropsを読まない");
      },
      predictRaceJobStore: {
        start: () => {
          throw new Error("ジョブ中止ではジョブを開始しない");
        },
        findById: () => {
          throw new Error("ジョブ中止ではジョブ状態を読まない");
        },
        abort: () => null
      }
    });

    // Act
    const response = await app.request("/races/predict-jobs/missing-job", { method: "DELETE" });
    const actual = (await response.json()) as unknown;

    // Assert
    expect(response.status).toBe(404);
    expect(actual).toEqual({ error: "レース解析ジョブが見つかりません。" });
  });
});

/** routeテスト用のPredictRaceJobSnapshotを作る。 */
const createPredictRaceJobSnapshot = (): PredictRaceJobSnapshot => {
  return {
    id: "predict-job-001",
    status: "running",
    messages: ["レース解析を開始しています。"],
    createdAt: "2026-06-04T12:00:00.000Z",
    updatedAt: "2026-06-04T12:00:00.000Z"
  };
};

/** routeテスト用の実行中ジョブErrorを作る。 */
const createAlreadyRunningError = (activeJob: PredictRaceJobSnapshot): Error => {
  const error = new Error("別のレース解析ジョブが実行中です。") as Error & {
    activeJob: PredictRaceJobSnapshot;
  };
  error.activeJob = activeJob;

  return error;
};

/** HonoのrenderをJSONへ差し替えたrouteテスト用アプリを作る。 */
const createTestApp = (dependencies: Parameters<typeof createHomeRoutes>[0]): Hono => {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.setRenderer((page, props) => c.json({ page, props }) as never);
    await next();
  });
  app.route("/", createHomeRoutes(dependencies));
  return app;
};
