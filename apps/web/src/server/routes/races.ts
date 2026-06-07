import { Hono } from "hono";
import type { ApproveLessonUseCase } from "@keiba-ai-assistant/web/server/usecases/approve-lesson";
import {
  isReflectRaceJobAlreadyRunningError,
  type ReflectRaceJobStore
} from "@keiba-ai-assistant/web/server/usecases/reflect-race-job-store";
import type { ShowRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/show-race";

/** race route の依存関係。 */
export interface RaceRoutesDependencies {
  /** race詳細ページpropsを取得するusecase。 */
  showRaceUseCase: ShowRaceUseCase;
  /** race IDから結果取得と振り返りジョブを実行するstore。 */
  reflectRaceJobStore: ReflectRaceJobStore;
  /** Lessonを採用状態へ更新するusecase。 */
  approveLessonUseCase: ApproveLessonUseCase;
}

/** usecaseを注入してrace関連routeを作る。 */
export const createRaceRoutes = (dependencies: RaceRoutesDependencies): Hono => {
  const raceRoutes = new Hono();

  raceRoutes.get("/races", (c) => c.redirect("/", 302));

  raceRoutes.get("/races/:raceId", async (c) => {
    const props = await dependencies.showRaceUseCase({
      raceId: c.req.param("raceId"),
      askError: c.req.query("askError")
    });

    if (props.race === null) {
      c.status(404);
    }

    return c.render("races/Show", props);
  });

  raceRoutes.post("/races/:raceId/reflection-jobs", (c) => {
    try {
      const job = dependencies.reflectRaceJobStore.start({
        raceId: c.req.param("raceId")
      });

      return c.json(job, 202);
    } catch (error) {
      if (isReflectRaceJobAlreadyRunningError(error)) {
        return c.json({ error: error.message, job: error.activeJob }, 409);
      }

      throw error;
    }
  });

  raceRoutes.get("/races/:raceId/reflection-jobs/:jobId", (c) => {
    const job = dependencies.reflectRaceJobStore.findById(c.req.param("jobId"));
    if (job === null || job.raceId !== c.req.param("raceId")) {
      return c.json({ error: "レース振り返りジョブが見つかりません。" }, 404);
    }

    return c.json(job);
  });

  raceRoutes.post("/lessons/:lessonId/approve", async (c) => {
    const lesson = await dependencies.approveLessonUseCase({
      lessonId: c.req.param("lessonId")
    });

    return c.json(lesson);
  });

  return raceRoutes;
};
