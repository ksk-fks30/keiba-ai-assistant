import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace } from "@keiba-ai-assistant/models";
import { createShowRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/show-race";

describe("createShowRaceUseCase", () => {
  test("保存済みRaceをrace詳細ページpropsに変換できる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const showRaceUseCase = createShowRaceUseCase({
      runRepository: {
        findRaceById: async (raceId) => {
          expect(raceId).toBe(race.id);
          return race;
        }
      }
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      race
    });
  });

  test("Raceが存在しない場合はraceをnullにする", async () => {
    // Arrange
    const raceId = "missing-race";
    const showRaceUseCase = createShowRaceUseCase({
      runRepository: {
        findRaceById: async () => null
      }
    });

    // Act
    const actual = await showRaceUseCase({ raceId });

    // Assert
    expect(actual).toEqual({
      raceId,
      race: null
    });
  });
});
