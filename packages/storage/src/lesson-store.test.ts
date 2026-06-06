import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { LessonEntry, PredictionLessonReference } from "@keiba-ai-assistant/models";
import {
  findLessonEntriesByIds,
  findLessonEntryById,
  initializeLessonDatabase,
  listLessonEntries,
  listPredictionLessonReferences,
  recordPredictionLessonReferences,
  saveLessonEntry,
  searchLessonEntries,
  updateLessonEntryStatus,
  type LessonStoreOptions
} from "@keiba-ai-assistant/storage/lesson-store";

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("initializeLessonDatabase", () => {
  test("SQLite DBを作成してmigrationを適用できる", async () => {
    // Arrange
    const options = await createTempLessonStoreOptions();

    // Act
    await initializeLessonDatabase(options);
    const actual = await stat(options.dbPath);

    // Assert
    expect(actual.isFile()).toBe(true);
  });
});

describe("searchLessonEntries", () => {
  test("approvedのLessonだけをFTS5とタグで検索できる", async () => {
    // Arrange
    const options = await createTempLessonStoreOptions();
    const approved = createLessonEntry({
      id: "lesson-approved",
      status: "approved",
      title: "前残り傾向では人気薄先行馬を残す",
      tags: ["芝", "前残り", "先行", "人気薄"],
      diaryText: "架空レースでは前残り傾向で先行馬を軽視した。",
      decisionGuidance: "前残り傾向が明確な場合は人気薄でも先行馬を相手に残す。"
    });
    const draft = createLessonEntry({
      id: "lesson-draft",
      status: "draft",
      title: "未承認の差し馬Lesson",
      tags: ["差し"],
      diaryText: "差し馬を評価する候補。",
      decisionGuidance: "未承認なので予想時には使わない。"
    });
    await saveLessonEntry(approved, options);
    await saveLessonEntry(draft, options);

    // Act
    const actual = await searchLessonEntries(
      { query: "前残り 先行馬", tags: ["前残り", "差し"], limit: 10 },
      options
    );

    // Assert
    expect(actual).toHaveLength(1);
    expect(actual[0]?.lesson.id).toBe("lesson-approved");
    expect(actual[0]?.matchedTags).toEqual(["前残り"]);
    expect(actual[0]?.score).toBeGreaterThan(0);
  });

  test("Lessonの状態をapprovedへ更新すると予想時候補にできる", async () => {
    // Arrange
    const options = await createTempLessonStoreOptions();
    const lesson = createLessonEntry({
      id: "lesson-to-approve",
      status: "draft",
      title: "道悪では持久力を重視する",
      tags: ["道悪", "持久力"],
      diaryText: "道悪で切れ味だけを重視して失敗した。",
      decisionGuidance: "道悪では持久力評価を上げる。"
    });
    await saveLessonEntry(lesson, options);

    // Act
    await updateLessonEntryStatus("lesson-to-approve", "approved", options);
    const actual = await searchLessonEntries({ tags: ["道悪"], limit: 5 }, options);
    const listed = await listLessonEntries({ status: "approved" }, options);

    // Assert
    expect(actual.map((result) => result.lesson.id)).toEqual(["lesson-to-approve"]);
    expect(listed.map((entry) => entry.id)).toEqual(["lesson-to-approve"]);
  });

  test("Lesson ID指定で入力順のまま取得できる", async () => {
    // Arrange
    const options = await createTempLessonStoreOptions();
    await saveLessonEntry(createLessonEntry({ id: "lesson-a", title: "A" }), options);
    await saveLessonEntry(createLessonEntry({ id: "lesson-b", title: "B" }), options);

    // Act
    const actual = await findLessonEntriesByIds(["lesson-b", "missing", "lesson-a"], options);
    const single = await findLessonEntryById("lesson-a", options);

    // Assert
    expect(actual.map((lesson) => lesson.id)).toEqual(["lesson-b", "lesson-a"]);
    expect(single?.id).toBe("lesson-a");
  });
});

describe("recordPredictionLessonReferences", () => {
  test("予想が採用したLesson参照履歴を保存して置き換えられる", async () => {
    // Arrange
    const options = await createTempLessonStoreOptions();
    await saveLessonEntry(createLessonEntry({ id: "lesson-a", status: "approved" }), options);
    await saveLessonEntry(createLessonEntry({ id: "lesson-b", status: "approved" }), options);
    const first = createPredictionLessonReference({
      lessonId: "lesson-a",
      reason: "前残り傾向が近いため。"
    });
    const second = createPredictionLessonReference({
      lessonId: "lesson-b",
      reason: "道悪の持久力評価が近いため。"
    });
    await recordPredictionLessonReferences([first], options);

    // Act
    await recordPredictionLessonReferences([second], options);
    const actual = await listPredictionLessonReferences("fixture-aoba-mile-2026", options);

    // Assert
    expect(actual).toEqual([second]);
  });
});

const createTempLessonStoreOptions = async (): Promise<Required<LessonStoreOptions>> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-lesson-store-"));
  tempRootDirs.push(rootDir);
  return { dbPath: join(rootDir, "data", "keiba.sqlite") };
};

const createLessonEntry = (overrides: Partial<LessonEntry> = {}): LessonEntry => {
  return {
    id: "lesson-fixture-001",
    sourceRaceId: "fixture-aoba-mile-2026",
    status: "approved",
    title: "前残り傾向では人気薄先行馬を残す",
    situationKey: "芝1600m・前残り・人気薄先行馬",
    tags: ["芝", "1600m", "前残り", "人気薄", "先行"],
    diaryText: "架空レースでは前が止まりにくい馬場で先行馬を軽視した。",
    decisionGuidance: "前残り傾向が明確な場合は、人気薄でも先行力を相手評価に残す。",
    applicableWhen: ["前が止まりにくい馬場", "同型逃げ馬が少ない"],
    notApplicableWhen: ["差しが届く馬場", "同型先行馬が多い"],
    confidence: "medium",
    createdAt: "2026-06-06T12:00:00.000Z",
    updatedAt: "2026-06-06T12:00:00.000Z",
    ...overrides
  };
};

const createPredictionLessonReference = (
  overrides: Partial<PredictionLessonReference> = {}
): PredictionLessonReference => {
  return {
    raceId: "fixture-aoba-mile-2026",
    predictionId: "fixture-aoba-mile-2026:2026-06-06T12:30:00.000Z",
    lessonId: "lesson-a",
    reason: "前残り傾向が近いため。",
    usedAt: "2026-06-06T12:30:00.000Z",
    ...overrides
  };
};
