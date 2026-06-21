import { describe, expect, test } from "vitest";
import type { Prediction } from "@keiba-ai-assistant/models";
import type { HorseDashboardView } from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";
import { usePredictionSummary } from "@keiba-ai-assistant/web/components/race/use-prediction-summary";

describe("usePredictionSummary", () => {
  test("prediction未生成時の表示状態を返す", () => {
    // Arrange
    const prediction = null;
    const horses: HorseDashboardView[] = [];

    // Act
    const actual = usePredictionSummary({ prediction, horses });

    // Assert
    expect(actual).toEqual({
      status: "empty",
      generatedAtLabel: "未生成"
    });
  });

  test("馬別評価と買い目候補を表示用データへ変換できる", () => {
    // Arrange
    const prediction = createPrediction();
    const horses = [
      createHorseDashboardView("fixture-horse-001", "1", "シラユキコード"),
      createHorseDashboardView("fixture-horse-002", "2", "アオゾラコード")
    ];

    // Act
    const actual = usePredictionSummary({ prediction, horses });

    // Assert
    expect(actual.status).toBe("ready");
    if (actual.status !== "ready") {
      throw new Error("prediction生成済みの表示状態が返されていません。");
    }
    expect(actual.generatedAtLabel).toBe("26/05/31 14:40");
    expect(actual.summary).toBe("ワイド中心で組み立てる。");
    expect(actual.evaluationCountLabel).toBe("1頭");
    expect(actual.evaluations).toEqual([
      {
        key: "fixture-horse-001",
        horseName: "1 シラユキコード",
        markLabel: "本命",
        markColorClass: "border-odds bg-odds-soft text-odds",
        score: 88,
        reasons: ["安定している。"],
        risks: ["人気しすぎる可能性がある。"]
      }
    ]);
    expect(actual.betCandidateCountLabel).toBe("4件");
    expect(actual.betCandidates).toEqual([
      {
        key: "0-wide-fixture-horse-001-fixture-horse-002-40",
        typeLabel: "ワイド",
        horsesLabel: "1 シラユキコード / 2 アオゾラコード",
        stakeWeightLabel: "40/100",
        reason: "複勝圏を重視する。"
      },
      {
        key: "1-quinella-fixture-horse-001-fixture-horse-002-25",
        typeLabel: "馬連",
        horsesLabel: "1 シラユキコード / 2 アオゾラコード",
        stakeWeightLabel: "25/100",
        reason: "相手関係が安定している。"
      },
      {
        key: "2-trio-fixture-horse-001-fixture-horse-002-missing-horse-25",
        typeLabel: "三連複",
        horsesLabel: "1 シラユキコード / 2 アオゾラコード / missing-horse",
        stakeWeightLabel: "25/100",
        reason: "三着候補を押さえる。"
      },
      {
        key: "3-ワイド-fixture-horse-001-fixture-horse-002-10",
        typeLabel: "ワイド",
        horsesLabel: "1 シラユキコード / 2 アオゾラコード",
        stakeWeightLabel: "10/100",
        reason: "日本語券種はそのまま表示する。"
      }
    ]);
  });
});

/** usePredictionSummary の変換確認で使う Prediction fixture を作る。 */
const createPrediction = (): Prediction => {
  return {
    raceId: "fixture-race-001",
    summary: "ワイド中心で組み立てる。",
    evaluations: [
      {
        horseId: "fixture-horse-001",
        mark: "favorite",
        score: 88,
        reasons: ["安定している。"],
        risks: ["人気しすぎる可能性がある。"]
      }
    ],
    betCandidates: [
      {
        type: "wide",
        horses: ["fixture-horse-001", "fixture-horse-002"],
        reason: "複勝圏を重視する。",
        stakeWeight: 40
      },
      {
        type: "quinella",
        horses: ["fixture-horse-001", "fixture-horse-002"],
        reason: "相手関係が安定している。",
        stakeWeight: 25
      },
      {
        type: "trio",
        horses: ["fixture-horse-001", "fixture-horse-002", "missing-horse"],
        reason: "三着候補を押さえる。",
        stakeWeight: 25
      },
      {
        type: "ワイド",
        horses: ["fixture-horse-001", "fixture-horse-002"],
        reason: "日本語券種はそのまま表示する。",
        stakeWeight: 10
      }
    ],
    referencedLessons: [],
    generatedAt: "2026-05-31T14:40:00+09:00"
  };
};

/** usePredictionSummary の馬名解決確認で使う HorseDashboardView fixture を作る。 */
const createHorseDashboardView = (
  id: string,
  horseNumberLabel: string,
  name: string
): HorseDashboardView => {
  return {
    id,
    gateNumberLabel: "-",
    horseNumberLabel,
    name,
    sexAgeLabel: "牡3",
    jockeyLabel: "架空 太郎",
    trainerLabel: "架空 厩舎",
    bodyWeightLabel: "480kg",
    oddsLabel: "3.2倍",
    popularity: 1,
    popularityLabel: "1",
    pedigreeLabel: "父 架空サイアー",
    pedigreeLineageItems: [],
    pedigreeNotes: [],
    pastPerformances: []
  };
};
