import { Hono } from "hono";

export const collectRoutes = new Hono();

collectRoutes.post("/races/collect", (c) =>
  c.json({ error: "collect route is not implemented yet" }, 501)
);
