import { Hono } from "hono";

export const askRoutes = new Hono();

askRoutes.post("/races/:raceId/ask", (c) =>
  c.json({ error: "ask route is not implemented yet" }, 501)
);
