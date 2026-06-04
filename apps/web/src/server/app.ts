import { serve } from "@hono/node-server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";
import { analyzeRoutes } from "@keiba-ai-assistant/web/server/routes/analyze";
import { createAskRoutes } from "@keiba-ai-assistant/web/server/routes/ask";
import { collectRoutes } from "@keiba-ai-assistant/web/server/routes/collect";
import { createHomeRoutes } from "@keiba-ai-assistant/web/server/routes/home";
import { createRaceRoutes } from "@keiba-ai-assistant/web/server/routes/races";
import { rootView } from "@keiba-ai-assistant/web/server/root";
import { createPolicyRepository } from "@keiba-ai-assistant/web/server/repositories/policy-repository";
import { createRunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";
import { createAskRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/ask-race";
import { createPredictRaceJobStore } from "@keiba-ai-assistant/web/server/usecases/predict-race-job-store";
import { createPredictRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/predict-race";
import { createShowHomeUseCase } from "@keiba-ai-assistant/web/server/usecases/show-home";
import { createShowRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/show-race";

const runRepository = createRunRepository();
const policyRepository = createPolicyRepository();
const showHomeUseCase = createShowHomeUseCase({ runRepository });
const showRaceUseCase = createShowRaceUseCase({ runRepository });
const askRaceUseCase = createAskRaceUseCase({ runRepository, policyRepository });
const predictRaceUseCase = createPredictRaceUseCase({ runRepository, policyRepository });
const predictRaceJobStore = createPredictRaceJobStore({ predictRaceUseCase });

export const app = new Hono();

app.use(
  "*",
  inertia({
    rootView
  })
);

app.route("/", createHomeRoutes({ showHomeUseCase, predictRaceJobStore }));
app.route("/", createRaceRoutes({ showRaceUseCase }));
app.route("/", collectRoutes);
app.route("/", analyzeRoutes);
app.route("/", createAskRoutes({ askRaceUseCase }));

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
