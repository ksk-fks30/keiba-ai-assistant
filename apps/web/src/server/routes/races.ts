import { Hono } from "hono";

export const raceRoutes = new Hono();

raceRoutes.get("/races", (c) => c.render("races/Index", { races: [] }));

raceRoutes.get("/races/:raceId", (c) =>
  c.render("races/Show", {
    raceId: c.req.param("raceId")
  })
);
