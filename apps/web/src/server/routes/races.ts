import { Hono } from "hono";
import type { ShowRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/show-race";

/** race route の依存関係。 */
export interface RaceRoutesDependencies {
  /** race詳細ページpropsを取得するusecase。 */
  showRaceUseCase: ShowRaceUseCase;
}

/** usecaseを注入してrace関連routeを作る。 */
export const createRaceRoutes = (dependencies: RaceRoutesDependencies): Hono => {
  const raceRoutes = new Hono();

  raceRoutes.get("/races", (c) => c.render("races/Index", { races: [] }));

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

  return raceRoutes;
};
