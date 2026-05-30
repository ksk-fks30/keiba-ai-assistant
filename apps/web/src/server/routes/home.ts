import { Hono } from "hono";

export const homeRoutes = new Hono();

homeRoutes.get("/", (c) => c.render("Home", { projectName: "keiba-ai-assistant" }));
