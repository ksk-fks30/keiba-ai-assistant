import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace } from "@keiba-ai-assistant/models";
import type { SavedRaceRun } from "@keiba-ai-assistant/web/server/repositories/run-repository";
import { createSavedRaceListView } from "@keiba-ai-assistant/web/components/home/saved-race-list-view";

describe("createSavedRaceListView", () => {
  test("存在する開催日だけを選択肢にし、今日以降の最も近い日付を初期表示にする", () => {
    // Arrange
    const pastRun = createSavedRaceRun({
      raceId: "202605030109",
      startTime: "2026-06-06T14:35:00+09:00"
    });
    const todayRun = createSavedRaceRun({
      raceId: "202605030110",
      startTime: "2026-06-07T15:10:00+09:00"
    });
    const futureRun = createSavedRaceRun({
      raceId: "202605030111",
      startTime: "2026-06-08T15:45:00+09:00"
    });

    // Act
    const actual = createSavedRaceListView({
      runs: [futureRun, todayRun, pastRun],
      selectedDate: null,
      now: new Date("2026-06-07T00:00:00+09:00")
    });

    // Assert
    expect(actual.dateOptions).toEqual([
      { value: "2026-06-06", label: "2026/06/06" },
      { value: "2026-06-07", label: "2026/06/07" },
      { value: "2026-06-08", label: "2026/06/08" }
    ]);
    expect(actual.selectedDate).toBe("2026-06-07");
    expect(actual.visibleRuns.map((run) => run.run.raceId)).toEqual(["202605030110"]);
  });

  test("ユーザーが選択した開催日で表示対象を絞れる", () => {
    // Arrange
    const todayRun = createSavedRaceRun({
      raceId: "202605030110",
      startTime: "2026-06-07T15:10:00+09:00"
    });
    const futureRun = createSavedRaceRun({
      raceId: "202605030111",
      startTime: "2026-06-08T15:45:00+09:00"
    });

    // Act
    const actual = createSavedRaceListView({
      runs: [futureRun, todayRun],
      selectedDate: "2026-06-08",
      now: new Date("2026-06-07T00:00:00+09:00")
    });

    // Assert
    expect(actual.selectedDate).toBe("2026-06-08");
    expect(actual.visibleRuns.map((run) => run.run.raceId)).toEqual(["202605030111"]);
  });

  test("今日以降の開催日がない場合は最新の過去日を初期表示にする", () => {
    // Arrange
    const oldRun = createSavedRaceRun({
      raceId: "202605030109",
      startTime: "2026-06-05T14:35:00+09:00"
    });
    const latestPastRun = createSavedRaceRun({
      raceId: "202605030110",
      startTime: "2026-06-06T15:10:00+09:00"
    });

    // Act
    const actual = createSavedRaceListView({
      runs: [latestPastRun, oldRun],
      selectedDate: null,
      now: new Date("2026-06-07T00:00:00+09:00")
    });

    // Assert
    expect(actual.selectedDate).toBe("2026-06-06");
    expect(actual.visibleRuns.map((run) => run.run.raceId)).toEqual(["202605030110"]);
  });

  test("日付不明のrunを日付不明選択肢から表示できる", () => {
    // Arrange
    const datedRun = createSavedRaceRun({
      raceId: "202605030110",
      startTime: "2026-06-07T15:10:00+09:00"
    });
    const unknownDateRun = createSavedRaceRunWithoutRace("fixture-missing-race");

    // Act
    const defaultView = createSavedRaceListView({
      runs: [unknownDateRun, datedRun],
      selectedDate: null,
      now: new Date("2026-06-07T00:00:00+09:00")
    });
    const unknownDateView = createSavedRaceListView({
      runs: [unknownDateRun, datedRun],
      selectedDate: "unknown",
      now: new Date("2026-06-07T00:00:00+09:00")
    });

    // Assert
    expect(defaultView.dateOptions).toContainEqual({ value: "unknown", label: "日付不明" });
    expect(defaultView.selectedDate).toBe("2026-06-07");
    expect(defaultView.visibleRuns.map((run) => run.run.raceId)).toEqual(["202605030110"]);
    expect(unknownDateView.selectedDate).toBe("unknown");
    expect(unknownDateView.visibleRuns.map((run) => run.run.raceId)).toEqual([
      "fixture-missing-race"
    ]);
  });

  test("一覧サマリに第何レースかと振り返り状態を保持できる", () => {
    // Arrange
    const run = createSavedRaceRun({
      raceId: "202605030112",
      startTime: "2026-06-07T16:30:00+09:00",
      hasReflection: true
    });

    // Act
    const actual = createSavedRaceListView({
      runs: [run],
      selectedDate: null,
      now: new Date("2026-06-07T00:00:00+09:00")
    });

    // Assert
    expect(actual.visibleRuns[0]?.summaryLabel).toContain("12R");
    expect(actual.visibleRuns[0]?.run.hasReflection).toBe(true);
  });
});

/** テスト用の保存済みrunを作る。 */
const createSavedRaceRun = (input: {
  raceId: string;
  startTime: string;
  hasReflection?: boolean | undefined;
}): SavedRaceRun => {
  return {
    raceId: input.raceId,
    race: parseRace({
      ...sampleRace,
      id: input.raceId,
      startTime: input.startTime
    }),
    hasPrediction: true,
    hasQa: false,
    hasResult: input.hasReflection ?? false,
    hasReflection: input.hasReflection ?? false,
    updatedAt: "2026-06-06T10:00:00.000Z"
  };
};

/** race.json がない保存済みrunを作る。 */
const createSavedRaceRunWithoutRace = (raceId: string): SavedRaceRun => {
  return {
    raceId,
    race: null,
    hasPrediction: false,
    hasQa: false,
    hasResult: false,
    hasReflection: false,
    updatedAt: "2026-06-06T10:00:00.000Z"
  };
};
