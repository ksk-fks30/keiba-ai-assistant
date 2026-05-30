import type { Weather } from "@keiba-ai-assistant/models";

export interface WeatherProvider {
  getWeather: (racecourse: string, raceDate?: string) => Promise<Weather>;
}

export class UnconfiguredWeatherProvider implements WeatherProvider {
  async getWeather(): Promise<Weather> {
    return {};
  }
}
