import { Command } from "commander";
import { describe, expect, test } from "vitest";
import type { LessonEntry, LessonStatus } from "@keiba-ai-assistant/models";
import { registerLessonsCommand } from "@keiba-ai-assistant/cli/commands/lessons";

describe("registerLessonsCommand", () => {
  test("Lesson一覧を状態と件数指定で表示できる", async () => {
    // Arrange
    const lesson = createLessonEntry({ id: "lesson-list-001", status: "draft" });
    const logs: string[] = [];
    const calls: unknown[] = [];
    const program = createLessonsProgram({
      listLessonEntries: async (input, options) => {
        calls.push({ input, options });
        return [lesson];
      },
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync([
      "node",
      "test",
      "lessons",
      "list",
      "--status",
      "draft",
      "--limit",
      "3",
      "--lesson-db",
      "/tmp/keiba.sqlite"
    ]);

    // Assert
    expect(calls).toEqual([
      {
        input: { status: "draft", limit: 3 },
        options: { dbPath: "/tmp/keiba.sqlite" }
      }
    ]);
    expect(logs.join("\n")).toContain("lesson-list-001 [draft]");
  });

  test("Lesson検索をqueryとtagで実行できる", async () => {
    // Arrange
    const lesson = createLessonEntry({ id: "lesson-search-001" });
    const logs: string[] = [];
    const calls: unknown[] = [];
    const program = createLessonsProgram({
      searchLessonEntries: async (input, options) => {
        calls.push({ input, options });
        return [{ lesson, score: 12.5, matchedTags: ["芝", "前残り"] }];
      },
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync([
      "node",
      "test",
      "lessons",
      "search",
      "前残り 先行馬",
      "--tag",
      "芝",
      "--tag",
      "前残り",
      "--limit",
      "5"
    ]);

    // Assert
    expect(calls).toEqual([
      {
        input: { query: "前残り 先行馬", limit: 5, tags: ["芝", "前残り"] },
        options: {}
      }
    ]);
    expect(logs.join("\n")).toContain("lesson-search-001 [approved]");
    expect(logs.join("\n")).toContain("score: 12.50");
    expect(logs.join("\n")).toContain("matchedTags: 芝, 前残り");
  });

  test("Lessonを承認できる", async () => {
    // Arrange
    const updates: Array<{ lessonId: string; status: LessonStatus; dbPath?: string }> = [];
    const logs: string[] = [];
    const program = createLessonsProgram({
      updateLessonEntryStatus: async (lessonId, status, options) => {
        const update: { lessonId: string; status: LessonStatus; dbPath?: string } = {
          lessonId,
          status
        };
        if (options?.dbPath !== undefined) {
          update.dbPath = options.dbPath;
        }
        updates.push(update);
      },
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync([
      "node",
      "test",
      "lessons",
      "approve",
      "lesson-fixture-001",
      "--lesson-db",
      "/tmp/keiba.sqlite"
    ]);

    // Assert
    expect(updates).toEqual([
      { lessonId: "lesson-fixture-001", status: "approved", dbPath: "/tmp/keiba.sqlite" }
    ]);
    expect(logs).toEqual(["Lessonを承認しました: lesson-fixture-001"]);
  });

  test("Lessonをアーカイブできる", async () => {
    // Arrange
    const updates: Array<{ lessonId: string; status: LessonStatus }> = [];
    const logs: string[] = [];
    const program = createLessonsProgram({
      updateLessonEntryStatus: async (lessonId, status) => {
        updates.push({ lessonId, status });
      },
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync(["node", "test", "lessons", "archive", "lesson-fixture-001"]);

    // Assert
    expect(updates).toEqual([{ lessonId: "lesson-fixture-001", status: "archived" }]);
    expect(logs).toEqual(["Lessonをアーカイブしました: lesson-fixture-001"]);
  });
});

const createLessonsProgram = (
  dependencies: Parameters<typeof registerLessonsCommand>[1]
): Command => {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {}
  });
  registerLessonsCommand(program, dependencies);
  return program;
};

const createLessonEntry = (overrides: Partial<LessonEntry> = {}): LessonEntry => {
  return {
    id: "lesson-fixture-001",
    sourceRaceId: "fixture-aoba-mile-2026",
    status: "approved",
    title: "前残り傾向では人気薄先行馬を残す",
    situationKey: "芝1600m・前残り・人気薄先行馬",
    tags: ["芝", "前残り", "先行"],
    diaryText: "架空レースでは前残り傾向で先行馬を軽視した。",
    decisionGuidance: "前残り傾向が明確なら人気薄でも先行馬を相手に残す。",
    applicableWhen: ["前が止まりにくい馬場"],
    notApplicableWhen: ["差しが届く馬場"],
    confidence: "medium",
    createdAt: "2026-06-06T12:00:00.000Z",
    updatedAt: "2026-06-06T12:00:00.000Z",
    ...overrides
  };
};
