import { describe, expect, test } from "vitest";
import { buildRaceDraftJsonSchema, parseRaceDraft } from "@keiba-ai-assistant/models/race-draft";

describe("parseRaceDraft", () => {
  test("AIが抽出した最小限のレース情報を parse できる", () => {
    // Arrange
    const input = {
      id: "fixture-aoba-mile-2026",
      name: "青葉架空マイル",
      racecourse: "東京",
      surface: "turf",
      distanceMeters: 1600,
      horses: [
        {
          id: "fixture-horse-001",
          name: "シラユキコード",
          horseNumber: 1,
          jockey: "架空 太郎",
          pedigree: {
            sire: "フィクションキング",
            dam: "シラユキメモリー",
            damSire: "マイルクラフト",
            familyNotes: []
          },
          pastPerformances: []
        }
      ]
    };

    // Act
    const actual = parseRaceDraft(input);

    // Assert
    expect(actual).toEqual(input);
  });
});

describe("buildRaceDraftJsonSchema", () => {
  test("Codex structured output が要求する required を満たす", () => {
    // Arrange
    const schema = buildRaceDraftJsonSchema();

    // Act
    const actual = findMissingRequiredKeys(schema);

    // Assert
    expect(actual).toEqual([]);
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
