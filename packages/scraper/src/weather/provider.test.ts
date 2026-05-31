import { describe, expect, test } from "vitest";
import {
  createOpenMeteoWeatherProvider,
  type OpenMeteoFetch
} from "@keiba-ai-assistant/scraper/weather/provider";

describe("createOpenMeteoWeatherProvider", () => {
  test("発走時刻に最も近いhourly予報を天気として返す", async () => {
    // Arrange
    const requestedUrls: string[] = [];
    const provider = createOpenMeteoWeatherProvider({
      fetch: createFetch(
        {
          hourly: {
            time: ["2026-05-31T15:00", "2026-05-31T16:00"],
            temperature_2m: [24.1, 24.8],
            precipitation_probability: [20, 35],
            weather_code: [1, 3],
            wind_speed_10m: [10.5, 12],
            wind_direction_10m: [180, 210]
          }
        },
        requestedUrls
      )
    });

    // Act
    const actual = await provider.getWeather({
      racecourse: "東京",
      raceStartTime: "2026-05-31T15:40:00+09:00"
    });

    // Assert
    expect(actual).toEqual({
      condition: "曇り",
      precipitationProbability: 35,
      temperatureCelsius: 24.8,
      wind: "南西 12km/h",
      source: requestedUrls[0],
      observedAt: "2026-05-31T16:00:00+09:00"
    });
    expect(readSearchParam(requestedUrls[0], "latitude")).toBe("35.6635");
    expect(readSearchParam(requestedUrls[0], "longitude")).toBe("139.4851");
    expect(readSearchParam(requestedUrls[0], "timezone")).toBe("Asia/Tokyo");
    expect(readSearchParam(requestedUrls[0], "hourly")).toContain("precipitation_probability");
    expect(readSearchParam(requestedUrls[0], "start_date")).toBe("2026-05-31");
    expect(readSearchParam(requestedUrls[0], "end_date")).toBe("2026-05-31");
  });

  test("発走時刻がない場合はcurrent天気を返す", async () => {
    // Arrange
    const requestedUrls: string[] = [];
    const provider = createOpenMeteoWeatherProvider({
      fetch: createFetch(
        {
          current: {
            time: "2026-05-31T10:15",
            temperature_2m: 22.5,
            weather_code: 61,
            wind_speed_10m: 8,
            wind_direction_10m: 90
          }
        },
        requestedUrls
      )
    });

    // Act
    const actual = await provider.getWeather({
      racecourse: "東京競馬場"
    });

    // Assert
    expect(actual).toEqual({
      condition: "雨",
      temperatureCelsius: 22.5,
      wind: "東 8km/h",
      source: requestedUrls[0],
      observedAt: "2026-05-31T10:15:00+09:00"
    });
    expect(readSearchParam(requestedUrls[0], "current")).toContain("temperature_2m");
    expect(readSearchParam(requestedUrls[0], "hourly")).toBeNull();
  });

  test("未対応の競馬場は取得前に失敗する", async () => {
    // Arrange
    const provider = createOpenMeteoWeatherProvider({
      fetch: async () => {
        throw new Error("fetch should not be called");
      }
    });

    // Act
    const actual = provider.getWeather({
      racecourse: "架空"
    });

    // Assert
    await expect(actual).rejects.toThrow("未対応の競馬場");
  });

  test("Open-Meteoのエラーレスポンスは失敗として扱う", async () => {
    // Arrange
    const provider = createOpenMeteoWeatherProvider({
      fetch: async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: true,
          reason: "Parameter latitude must be in range"
        })
      })
    });

    // Act
    const actual = provider.getWeather({
      racecourse: "東京"
    });

    // Assert
    await expect(actual).rejects.toThrow("Parameter latitude must be in range");
  });
});

/** テスト用のOpen-Meteo fetchを作る。 */
const createFetch = (payload: unknown, requestedUrls: string[]): OpenMeteoFetch => {
  return async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => payload
    };
  };
};

/** URLから検索パラメータを読む。 */
const readSearchParam = (url: string | undefined, name: string): string | null => {
  if (url === undefined) {
    return null;
  }

  return new URL(url).searchParams.get(name);
};
