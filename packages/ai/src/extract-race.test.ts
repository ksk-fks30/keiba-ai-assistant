import { describe, expect, test } from "vitest";
import type { CodexJsonRuntime } from "@keiba-ai-assistant/ai/codex";
import { extractRaceFromSnapshot } from "@keiba-ai-assistant/ai/extract-race";
import type { RaceSourceSnapshot, SourcePageSnapshot } from "@keiba-ai-assistant/models";

describe("extractRaceFromSnapshot", () => {
  test("snapshotをRaceDraftとしてAI構造化しRaceとして返す", async () => {
    // Arrange
    const snapshot = createSnapshot();
    const runtime = createRuntime(
      {
        id: "fixture-aoba-mile-2026",
        name: "青葉架空マイル",
        racecourse: "東京",
        startTime: "2026-05-31T15:40:00+09:00",
        surface: "turf",
        distanceMeters: 1600,
        direction: "左 C",
        horses: [
          {
            id: "fixture-horse-001",
            name: "シラユキコード",
            horseNumber: 1,
            sex: "牝",
            age: 4,
            jockey: "架空 太郎",
            trainer: "架空 厩舎",
            bodyWeightKg: 480,
            bodyWeightDiffKg: 2,
            odds: 3.2,
            popularity: 1,
            pedigree: {
              sire: "フィクションキング",
              dam: "シラユキメモリー",
              damSire: "マイルクラフト",
              familyNotes: ["芝マイル向きの持続力を示す。"]
            },
            pastPerformances: [
              {
                date: "2026-04-12",
                raceName: "架空トライアル",
                racecourse: "東京",
                surface: "turf",
                distanceMeters: 1600,
                trackCondition: "良",
                finishPosition: 1,
                jockey: "架空 太郎",
                weightCarriedKg: 55,
                bodyWeightKg: 480,
                odds: 3.2,
                popularity: 1,
                margin: "0.2",
                runningStyle: "先行",
                note: "直線で余力があった。"
              }
            ]
          }
        ]
      },
      "fixture-codex-model"
    );

    // Act
    const actual = await extractRaceFromSnapshot({
      snapshot,
      runtime,
      model: "fixture-codex-model"
    });

    // Assert
    expect(actual).toEqual({
      id: "fixture-aoba-mile-2026",
      sourceUrl: snapshot.racePage.sourceUrl,
      name: "青葉架空マイル",
      racecourse: "東京",
      startTime: "2026-05-31T15:40:00+09:00",
      surface: "turf",
      distanceMeters: 1600,
      direction: "左 C",
      horses: [
        {
          id: "fixture-horse-001",
          name: "シラユキコード",
          horseNumber: 1,
          sex: "牝",
          age: 4,
          jockey: "架空 太郎",
          trainer: "架空 厩舎",
          bodyWeightKg: 480,
          bodyWeightDiffKg: 2,
          odds: 3.2,
          popularity: 1,
          pedigree: {
            sire: "フィクションキング",
            dam: "シラユキメモリー",
            damSire: "マイルクラフト",
            familyNotes: ["芝マイル向きの持続力を示す。"]
          },
          pastPerformances: [
            {
              date: "2026-04-12",
              raceName: "架空トライアル",
              racecourse: "東京",
              surface: "turf",
              distanceMeters: 1600,
              trackCondition: "良",
              finishPosition: 1,
              jockey: "架空 太郎",
              weightCarriedKg: 55,
              bodyWeightKg: 480,
              odds: 3.2,
              popularity: 1,
              margin: "0.2",
              runningStyle: "先行",
              note: "直線で余力があった。"
            }
          ]
        }
      ],
      collectedAt: snapshot.racePage.capturedAt
    });
  });

  test("AI出力がRaceDraftとして不正な場合は失敗する", async () => {
    // Arrange
    const snapshot = createSnapshot();
    const runtime = createRuntime({
      id: "fixture-aoba-mile-2026",
      name: "青葉架空マイル",
      racecourse: "東京",
      startTime: null,
      surface: "turf",
      distanceMeters: 1600,
      direction: null,
      horses: []
    });

    // Act
    const actual = extractRaceFromSnapshot({ snapshot, runtime });

    // Assert
    await expect(actual).rejects.toThrow();
  });

  test("不明な補助情報はRaceの任意項目として保存しない", async () => {
    // Arrange
    const snapshot = createSnapshot();
    const runtime = createRuntime({
      id: "fixture-aoba-mile-2026",
      name: "青葉架空マイル",
      racecourse: "東京",
      startTime: null,
      surface: "turf",
      distanceMeters: 1600,
      direction: null,
      horses: [
        {
          id: "fixture-horse-001",
          name: "シラユキコード",
          horseNumber: 1,
          sex: null,
          age: null,
          jockey: "架空 太郎",
          trainer: null,
          bodyWeightKg: null,
          bodyWeightDiffKg: null,
          odds: null,
          popularity: null,
          pedigree: {
            sire: "",
            dam: "",
            damSire: "",
            familyNotes: []
          },
          pastPerformances: []
        }
      ]
    });

    // Act
    const actual = await extractRaceFromSnapshot({ snapshot, runtime });

    // Assert
    expect(actual.direction).toBeUndefined();
    expect(actual.startTime).toBeUndefined();
    expect(actual.horses[0]).toEqual({
      id: "fixture-horse-001",
      name: "シラユキコード",
      horseNumber: 1,
      jockey: "架空 太郎",
      pedigree: { familyNotes: [] },
      pastPerformances: []
    });
  });
});

/** extract-race テスト用の Codex JSON runtime を作る。 */
const createRuntime = (response: unknown, expectedModel?: string): CodexJsonRuntime => {
  return {
    generateJson: async (request) => {
      expect(request.prompt).toContain("RaceDraft JSON");
      expect(request.outputSchema).toBeDefined();
      expect(request.model).toBe(expectedModel);
      return response;
    }
  };
};

/** extract-race テスト用のページsnapshotを作る。 */
const createSnapshot = (): RaceSourceSnapshot => {
  const racePage: SourcePageSnapshot = {
    sourceUrl: "https://example.test/race?race_id=fixture-aoba-mile-2026",
    pageTitle: "青葉架空マイル",
    visibleText: "青葉架空マイル\n東京 芝1600m\n1 シラユキコード 架空 太郎",
    headings: ["青葉架空マイル"],
    tableTexts: ["馬番 馬名 騎手\n1 シラユキコード 架空 太郎"],
    links: [
      {
        text: "シラユキコード",
        href: "https://example.test/horse/fixture-horse-001"
      }
    ],
    capturedAt: "2026-05-31T10:30:00.000Z"
  };

  return {
    racePage,
    horseDetailPages: [
      {
        ...racePage,
        sourceUrl: "https://example.test/horse/fixture-horse-001",
        pageTitle: "シラユキコード",
        visibleText:
          "シラユキコード\n父 フィクションキング\n母 シラユキメモリー\n2026-04-12 架空トライアル 1着"
      }
    ]
  };
};
