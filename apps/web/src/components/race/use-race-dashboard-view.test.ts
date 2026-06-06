import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace } from "@keiba-ai-assistant/models";
import { useRaceDashboardView } from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";

describe("useRaceDashboardView", () => {
  test("Raceをダッシュボード表示用viewに変換できる", () => {
    // Arrange
    const race = parseRace(sampleRace);

    // Act
    const actual = useRaceDashboardView(race);

    // Assert
    expect(actual).toMatchObject({
      id: race.id,
      name: race.name,
      sourceUrl: race.sourceUrl,
      racecourse: race.racecourse,
      startTimeLabel: "26/06/07 15:40",
      surfaceLabel: "芝",
      distanceLabel: "1600m",
      directionLabel: "左回り",
      trackConditionLabel: "良",
      collectedAtLabel: "26/05/31 11:58",
      weather: {
        conditionLabel: "晴",
        temperatureLabel: "24℃",
        precipitationLabel: "10%",
        windLabel: "南東 2m",
        observedAtLabel: "26/06/07 12:00",
        sourceLabel: "fixture",
        sourceUrl: undefined
      },
      horses: expect.arrayContaining([
        expect.objectContaining({
          id: "fixture-horse-001",
          name: "アオバライト",
          bodyWeightLabel: "486kg (+2)",
          oddsLabel: "3.8倍",
          popularity: 2,
          popularityLabel: "2",
          pedigreeLabel: "父 ミドリノカゼ / 母 ライトステップ / 母父 サンプルスター",
          pedigreeLineageItems: [
            { label: "父系", value: "ミドリ系" },
            { label: "母父系", value: "サンプル系" },
            { label: "牝系", value: "FNo.[1-a]" }
          ],
          pastPerformances: expect.arrayContaining([
            expect.objectContaining({
              dateLabel: "26/05/10",
              raceName: "若葉特別",
              conditionLabel: "緑丘競馬場 芝 1600m 良",
              finishPositionLabel: "2着"
            })
          ])
        })
      ])
    });
  });

  test("Raceがnullの場合はnullを返す", () => {
    // Arrange
    const race = null;

    // Act
    const actual = useRaceDashboardView(race);

    // Assert
    expect(actual).toBeNull();
  });

  test("天気sourceがOpen-Meteo URLの場合はリンク用URLと短い表示名に変換できる", () => {
    // Arrange
    const source = "https://api.open-meteo.com/v1/forecast?latitude=35.6&longitude=139.4";
    const race = parseRace({
      ...sampleRace,
      weather: {
        ...sampleRace.weather,
        source
      }
    });

    // Act
    const actual = useRaceDashboardView(race);

    // Assert
    expect(actual?.weather).toMatchObject({
      sourceLabel: "Open-Meteo",
      sourceUrl: source
    });
  });
});
