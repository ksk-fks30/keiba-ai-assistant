import { Hono } from "hono";
import type { AskRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/ask-race";

/** 追加質問routeの依存関係。 */
export interface AskRoutesDependencies {
  /** 追加質問を実行してQ&A履歴へ保存するusecase。 */
  askRaceUseCase: AskRaceUseCase;
}

/** usecaseを注入して追加質問routeを作る。 */
export const createAskRoutes = (dependencies: AskRoutesDependencies): Hono => {
  const askRoutes = new Hono();

  askRoutes.post("/races/:raceId/ask", async (c) => {
    const raceId = c.req.param("raceId");
    try {
      await dependencies.askRaceUseCase({
        raceId,
        question: await readQuestion({
          contentType: c.req.header("content-type"),
          readJson: async () => await c.req.json(),
          readFormData: async () => await c.req.formData()
        })
      });
    } catch (error) {
      return c.redirect(buildAskErrorRedirectUrl(raceId, normalizeAskError(error)), 303);
    }

    return c.redirect(`/races/${raceId}`, 303);
  });

  return askRoutes;
};

/** リクエスト本文から質問本文だけを取り出す。InertiaのJSON送信と通常form送信の両方に対応する。 */
const readQuestion = async (input: {
  contentType: string | undefined;
  readJson: () => Promise<unknown>;
  readFormData: () => Promise<FormData>;
}): Promise<string> => {
  if (input.contentType?.includes("application/json") === true) {
    return readQuestionFromJson(await input.readJson());
  }

  return readQuestionFromFormData(await input.readFormData());
};

/** JSON bodyから質問本文だけを取り出す。 */
const readQuestionFromJson = (value: unknown): string => {
  if (!isRecord(value)) {
    return "";
  }
  if (typeof value.question !== "string") {
    return "";
  }

  return value.question;
};

/** formDataから質問本文だけを取り出す。 */
const readQuestionFromFormData = (formData: FormData): string => {
  const value = formData.get("question");
  if (typeof value !== "string") {
    return "";
  }

  return value;
};

/** unknownが文字列キーを持つobjectかどうかを判定する。 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/** 追加質問失敗時にレース詳細へ戻すURLを作る。 */
const buildAskErrorRedirectUrl = (raceId: string, message: string): string => {
  const params = new URLSearchParams({ askError: message });
  return `/races/${encodeURIComponent(raceId)}?${params.toString()}`;
};

/** routeで捕捉したエラーを画面表示用メッセージに変換する。 */
const normalizeAskError = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "追加質問の実行に失敗しました。";
};
