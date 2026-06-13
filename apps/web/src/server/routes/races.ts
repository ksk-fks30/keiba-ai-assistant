import { Hono } from "hono";
import { horseMemoMarkSchema, type HorseMemoMark } from "@keiba-ai-assistant/models";
import type { ApproveLessonUseCase } from "@keiba-ai-assistant/web/server/usecases/approve-lesson";
import {
  isReflectRaceJobAlreadyRunningError,
  type ReflectRaceJobStore
} from "@keiba-ai-assistant/web/server/usecases/reflect-race-job-store";
import type { SaveHorseMemoUseCase } from "@keiba-ai-assistant/web/server/usecases/save-horse-memo";
import type { ShowRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/show-race";

/** race route の依存関係。 */
export interface RaceRoutesDependencies {
  /** race詳細ページpropsを取得するusecase。 */
  showRaceUseCase: ShowRaceUseCase;
  /** race IDから結果取得と振り返りジョブを実行するstore。 */
  reflectRaceJobStore: ReflectRaceJobStore;
  /** Lessonを採用状態へ更新するusecase。 */
  approveLessonUseCase: ApproveLessonUseCase;
  /** 出走馬メモを保存または削除するusecase。 */
  saveHorseMemoUseCase: SaveHorseMemoUseCase;
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

  raceRoutes.post("/races/:raceId/horse-memos", async (c) => {
    const raceId = c.req.param("raceId");
    let input: HorseMemoRequestInput;
    try {
      input = parseHorseMemoRequest(await c.req.json());
    } catch {
      return c.json({ error: "出走馬メモの入力が不正です。" }, 400);
    }

    try {
      const memo = await dependencies.saveHorseMemoUseCase({
        raceId,
        horseId: input.horseId,
        mark: input.mark
      });

      return c.json({ memo });
    } catch (error) {
      if (isHorseMemoNotFoundError(error)) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
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

interface HorseMemoRequestInput {
  /** 印を付ける馬ID。 */
  horseId: string;
  /** 保存する手動印。nullの場合は既存メモを削除する。 */
  mark: HorseMemoMark | null;
}

/** JSON bodyから出走馬メモ保存に必要な値だけを取り出す。 */
const parseHorseMemoRequest = (value: unknown): HorseMemoRequestInput => {
  if (!isRecord(value)) {
    throw new Error("request body is not object");
  }
  if (typeof value.horseId !== "string" || value.horseId.length === 0) {
    throw new Error("horseId is required");
  }
  if (value.mark === null) {
    return {
      horseId: value.horseId,
      mark: null
    };
  }

  return {
    horseId: value.horseId,
    mark: horseMemoMarkSchema.parse(value.mark)
  };
};

/** unknownが文字列キーを持つobjectかどうかを判定する。 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/** 出走馬メモ保存時に、対象raceまたは馬が見つからないエラーかどうかを判定する。 */
const isHorseMemoNotFoundError = (error: unknown): error is Error => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.startsWith("race.json が見つかりません:") ||
    error.message.startsWith("出走馬が見つかりません:")
  );
};
