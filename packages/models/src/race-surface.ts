import { z } from "zod";

/** 馬場種別モデル。芝、ダート、障害、不明のいずれかを表す。 */
export const raceSurfaceSchema = z.enum(["turf", "dirt", "jump", "unknown"]);

export type RaceSurface = z.infer<typeof raceSurfaceSchema>;

export const parseRaceSurface = (value: unknown): RaceSurface => {
  return raceSurfaceSchema.parse(value);
};
