import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parsePredictionPolicy, parseRace } from "@keiba-ai-assistant/models";
import {
  buildPredictionOutputSchema,
  buildQaAnswerOutputSchema,
  buildRaceDraftOutputSchema,
  buildRaceExtractionPrompt,
  buildRaceQuestionPrompt,
  buildRaceAnalysisPrompt
} from "@keiba-ai-assistant/ai/prompts";

describe("buildRaceExtractionPrompt", () => {
  test("ページsnapshotだけを使う構造化指示を含める", () => {
    // Arrange
    const racePage = {
      sourceUrl: "https://example.test/race?race_id=fixture-aoba-mile-2026",
      pageTitle: "青葉架空マイル",
      visibleText: "青葉架空マイル\n東京 芝1600m",
      headings: ["青葉架空マイル"],
      tableTexts: ["馬番 馬名 騎手\n1 シラユキコード 架空太郎"],
      links: [],
      capturedAt: "2026-05-31T10:30:00.000Z"
    };
    const snapshot = {
      racePage,
      horseDetailPages: [
        {
          ...racePage,
          sourceUrl: "https://example.test/horse/fixture-horse-001",
          pageTitle: "シラユキコード",
          visibleText: "シラユキコード\n父 フィクションキング\n2026-04-12 架空トライアル"
        }
      ]
    };

    // Act
    const actual = buildRaceExtractionPrompt({ snapshot });

    // Assert
    expect(actual).toContain("RaceDraft JSON");
    expect(actual).toContain("sourceUrl と collectedAt はアプリ側で付与する");
    expect(actual).toContain("追加取得や自由巡回");
    expect(actual).toContain("horse-number-{馬番}");
    expect(actual).toContain("pastPerformances");
    expect(actual).toContain("pedigree");
    expect(actual).toContain("青葉架空マイル");
  });
});

describe("buildRaceAnalysisPrompt", () => {
  test("生成時刻を含めず買い目配分の整数条件をプロンプトで指定する", () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });

    // Act
    const actual = buildRaceAnalysisPrompt({ race, policy });

    // Assert
    expect(actual).toContain("PredictionDraft Zodスキーマ");
    expect(actual).toContain("generatedAt はアプリ側で付与する");
    expect(actual).toContain("type, horses, reason, stakeWeight");
    expect(actual).toContain("stakeWeight は0から100の整数");
    expect(actual).toContain("合計が100");
  });
});

describe("buildRaceQuestionPrompt", () => {
  test("追加質問と過去のQ&A履歴をプロンプトに含める", () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });

    // Act
    const actual = buildRaceQuestionPrompt({
      race,
      prediction: {
        raceId: race.id,
        summary: "シラユキコードを中心に評価する。",
        evaluations: [],
        betCandidates: [],
        generatedAt: "2026-05-31T05:40:00.000Z"
      },
      policy,
      history: [
        {
          id: "qa-0001",
          raceId: race.id,
          question: "本命のリスクは？",
          answer: "折り合い面がリスクです。",
          createdAt: "2026-05-31T06:00:00.000Z"
        }
      ],
      question: "馬場が悪化した場合は？"
    });

    // Assert
    expect(actual).toContain("QaAnswerDraft Zodスキーマ");
    expect(actual).toContain("id, raceId, question, createdAt はアプリ側で付与する");
    expect(actual).toContain("answer には回答本文だけを入れ");
    expect(actual).toContain("本命のリスクは？");
    expect(actual).toContain("馬場が悪化した場合は？");
  });
});

describe("buildRaceDraftOutputSchema", () => {
  test("Codex structured output が要求する required を満たす", () => {
    // Arrange
    const schema = buildRaceDraftOutputSchema();

    // Act
    const actual = findMissingRequiredKeys(schema);

    // Assert
    expect(actual).toEqual([]);
  });
});

describe("buildPredictionOutputSchema", () => {
  test("Codex structured output が要求する required を満たす", () => {
    // Arrange
    const schema = buildPredictionOutputSchema();

    // Act
    const actual = findMissingRequiredKeys(schema);

    // Assert
    expect(actual).toEqual([]);
  });

  test("Codex structured output に不要な schema メタ情報を含めない", () => {
    // Arrange
    const schema = buildPredictionOutputSchema();

    // Act
    const actual = isSchemaObject(schema) ? "$schema" in schema : false;

    // Assert
    expect(actual).toBe(false);
  });

  test("Codex structured output に generatedAt を含めない", () => {
    // Arrange
    const schema = buildPredictionOutputSchema();

    // Act
    const actual = isSchemaObject(schema) ? schema.properties?.generatedAt : undefined;

    // Assert
    expect(actual).toBeUndefined();
  });
});

describe("buildQaAnswerOutputSchema", () => {
  test("Codex structured output が回答本文だけを要求する", () => {
    // Arrange
    const schema = buildQaAnswerOutputSchema();

    // Act
    const actual = isSchemaObject(schema) ? Object.keys(schema.properties ?? {}) : [];

    // Assert
    expect(actual).toEqual(["answer"]);
    expect(findMissingRequiredKeys(schema)).toEqual([]);
  });
});

interface JsonSchemaObject {
  properties?: Record<string, unknown>;
  required?: string[];
  items?: unknown;
}

/** properties に存在するが required に含まれないキーを再帰的に集める。 */
const findMissingRequiredKeys = (schema: unknown, path = "schema"): string[] => {
  if (!isSchemaObject(schema)) {
    return [];
  }

  const missingKeys =
    schema.properties === undefined
      ? []
      : Object.keys(schema.properties)
          .filter((key) => !(schema.required ?? []).includes(key))
          .map((key) => `${path}.${key}`);

  const propertyMissingKeys = Object.entries(schema.properties ?? {}).flatMap(([key, value]) =>
    findMissingRequiredKeys(value, `${path}.${key}`)
  );
  const itemMissingKeys = findMissingRequiredKeys(schema.items, `${path}[]`);

  return [...missingKeys, ...propertyMissingKeys, ...itemMissingKeys];
};

/** JSON Schema として辿れる object かどうかを判定する。 */
const isSchemaObject = (value: unknown): value is JsonSchemaObject => {
  return typeof value === "object" && value !== null;
};
