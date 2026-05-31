import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parsePredictionPolicy, parseRace } from "@keiba-ai-assistant/models";
import {
  buildPredictionOutputSchema,
  buildRaceAnalysisPrompt
} from "@keiba-ai-assistant/ai/prompts";

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
