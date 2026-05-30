import { Hono } from "hono";

export const analyzeRoutes = new Hono();

analyzeRoutes.post("/races/:raceId/analyze", (c) =>
  c.json({ error: "analyze route is not implemented yet" }, 501)
);
