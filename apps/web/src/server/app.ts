import { serve } from "@hono/node-server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";
import { analyzeRoutes } from "@keiba-ai-assistant/web/server/routes/analyze";
import { askRoutes } from "@keiba-ai-assistant/web/server/routes/ask";
import { collectRoutes } from "@keiba-ai-assistant/web/server/routes/collect";
import { homeRoutes } from "@keiba-ai-assistant/web/server/routes/home";
import { createRaceRoutes } from "@keiba-ai-assistant/web/server/routes/races";
import { rootView } from "@keiba-ai-assistant/web/server/root";
import { createRunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";
import { createShowRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/show-race";

const runRepository = createRunRepository();
const showRaceUseCase = createShowRaceUseCase({ runRepository });

export const app = new Hono();

app.use(
  "*",
  inertia({
    rootView
  })
);

app.route("/", homeRoutes);
app.route("/", createRaceRoutes({ showRaceUseCase }));
app.route("/", collectRoutes);
app.route("/", analyzeRoutes);
app.route("/", askRoutes);

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  serve(
    {
      fetch: app.fetch,
      port: Number(process.env.PORT ?? 3000)
    },
    (info) => {
      console.log(`Listening on http://localhost:${info.port}`);
    }
  );
}
