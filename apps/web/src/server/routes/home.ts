import { Hono } from "hono";
import {
  isPredictRaceJobAlreadyRunningError,
  type PredictRaceJobStore
} from "@keiba-ai-assistant/web/server/usecases/predict-race-job-store";
import type { ShowHomeUseCase } from "@keiba-ai-assistant/web/server/usecases/show-home";

/** トップ画面routeの依存関係。 */
export interface HomeRoutesDependencies {
  /** トップ画面propsを取得するusecase。 */
  showHomeUseCase: ShowHomeUseCase;
  /** netKeiba URLからレース解析ジョブを実行するstore。 */
  predictRaceJobStore: PredictRaceJobStore;
}

/** usecaseを注入してトップ画面routeを作る。 */
export const createHomeRoutes = (dependencies: HomeRoutesDependencies): Hono => {
  const homeRoutes = new Hono();

  homeRoutes.get("/", async (c) => {
    const props = await dependencies.showHomeUseCase();
    return c.render("Home", props);
  });

  homeRoutes.post("/races/predict-jobs", async (c) => {
    try {
      const job = dependencies.predictRaceJobStore.start({
        raceUrl: await readRaceUrl({
          contentType: c.req.header("content-type"),
          readJson: async () => await c.req.json(),
          readFormData: async () => await c.req.formData()
        })
      });

      return c.json(job, 202);
    } catch (error) {
      if (isPredictRaceJobAlreadyRunningError(error)) {
        return c.json({ error: error.message, job: error.activeJob }, 409);
      }

      throw error;
    }
  });

  homeRoutes.get("/races/predict-jobs/:jobId", (c) => {
    const job = dependencies.predictRaceJobStore.findById(c.req.param("jobId"));
    if (job === null) {
      return c.json({ error: "レース解析ジョブが見つかりません。" }, 404);
    }

    return c.json(job);
  });

  return homeRoutes;
};

/** リクエスト本文からnetKeibaレースURLだけを取り出す。 */
const readRaceUrl = async (input: {
  contentType: string | undefined;
  readJson: () => Promise<unknown>;
  readFormData: () => Promise<FormData>;
}): Promise<string> => {
  if (input.contentType?.includes("application/json") === true) {
    return readRaceUrlFromJson(await input.readJson());
  }

  return readRaceUrlFromFormData(await input.readFormData());
};

/** JSON bodyからnetKeibaレースURLを取り出す。 */
const readRaceUrlFromJson = (value: unknown): string => {
  if (!isRecord(value)) {
    return "";
  }
  if (typeof value.raceUrl !== "string") {
    return "";
  }

  return value.raceUrl;
};

/** formDataからnetKeibaレースURLを取り出す。 */
const readRaceUrlFromFormData = (formData: FormData): string => {
  const value = formData.get("raceUrl");
  if (typeof value !== "string") {
    return "";
  }

  return value;
};

/** unknownが文字列キーを持つobjectかどうかを判定する。 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
