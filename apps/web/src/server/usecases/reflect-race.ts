import {
  extractRaceResultFromSnapshot as extractResult,
  reflectRace as generateRaceReflection,
  type ExtractRaceResultFromSnapshotInput,
  type ReflectRaceInput
} from "@keiba-ai-assistant/ai";
import {
  parseLessonEntry,
  parseRaceReflection,
  type LessonEntry,
  type RaceReflection,
  type RaceReflectionDraft,
  type RaceResult,
  type SourcePageSnapshot
} from "@keiba-ai-assistant/models";
import {
  buildNetkeibaRaceResultUrl,
  collectRaceResultSnapshotFromNetkeiba,
  type CollectRaceResultSnapshotInput
} from "@keiba-ai-assistant/scraper";
import type { LessonRepository } from "@keiba-ai-assistant/web/server/repositories/lesson-repository";
import type { PolicyRepository } from "@keiba-ai-assistant/web/server/repositories/policy-repository";
import type { RunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";

/** レース結果取得と振り返りを実行する入力。 */
export interface ReflectRaceUseCaseInput {
  /** 対象race ID。 */
  raceId: string;
  /** Codex SDKに渡すモデル名。未指定の場合は既定のモデルを使う。 */
  model?: string | undefined;
  /** 結果ページ表示後に最低限待機する時間。ミリ秒単位。 */
  minDelayMs?: number | undefined;
  /** レース結果構造化の最大待機時間。未指定の場合は既定値を使う。 */
  resultExtractTimeoutMs?: number | undefined;
  /** 振り返り生成の最大待機時間。未指定の場合は既定値を使う。 */
  reflectionTimeoutMs?: number | undefined;
  /** ジョブ中止など、呼び出し元からの中断通知。 */
  signal?: AbortSignal | undefined;
  /** ジョブコンソールなど呼び出し元へ処理状況を伝える関数。 */
  onProgress?: ((message: string) => void) | undefined;
}

/** レース結果取得と振り返りの実行結果。 */
export interface ReflectRaceUseCaseResult {
  /** 保存された race ID。 */
  raceId: string;
}

/** レース結果取得と振り返りusecaseの依存関係。 */
export interface ReflectRaceUseCaseDependencies {
  /** 保存済みrunを更新するrepository。 */
  runRepository: RunRepository;
  /** 予想方針を取得するrepository。 */
  policyRepository: PolicyRepository;
  /** Lessonを保存・参照するrepository。 */
  lessonRepository: LessonRepository;
  /** netKeiba 結果ページからsnapshotを取得する関数。 */
  collectRaceResultSnapshot?:
    | ((input: CollectRaceResultSnapshotInput) => Promise<SourcePageSnapshot>)
    | undefined;
  /** 結果ページsnapshotをRaceResultへ構造化する関数。 */
  extractRaceResultFromSnapshot?:
    | ((input: ExtractRaceResultFromSnapshotInput) => Promise<RaceResult>)
    | undefined;
  /** 保存済み予想と確定結果から振り返り下書きを生成する関数。 */
  reflectRace?: ((input: ReflectRaceInput) => Promise<RaceReflectionDraft>) | undefined;
  /** 現在日時を返す関数。テストで固定する。 */
  now?: (() => Date) | undefined;
  /** Lesson ID生成関数。テストで固定する。 */
  createLessonId?: ((input: CreateLessonIdInput) => string) | undefined;
}

/** Lesson ID生成に渡す入力。 */
export interface CreateLessonIdInput {
  /** 対象race ID。 */
  raceId: string;
  /** 0始まりのLesson候補index。 */
  index: number;
  /** 振り返り作成日時。 */
  reflectedAt: string;
}

/** レース結果取得とAI振り返りusecase。 */
export type ReflectRaceUseCase = (
  input: ReflectRaceUseCaseInput
) => Promise<ReflectRaceUseCaseResult>;

const defaultResultExtractTimeoutMs = 15 * 60 * 1000;
const defaultReflectionTimeoutMs = 30 * 60 * 1000;

/** 依存関係を注入してWeb版reflect usecaseを作る。 */
export const createReflectRaceUseCase = (
  dependencies: ReflectRaceUseCaseDependencies
): ReflectRaceUseCase => {
  const collectRaceResultSnapshot =
    dependencies.collectRaceResultSnapshot ?? collectRaceResultSnapshotFromNetkeiba;
  const extractRaceResultFromSnapshot = dependencies.extractRaceResultFromSnapshot ?? extractResult;
  const reflectRace = dependencies.reflectRace ?? generateRaceReflection;
  const now = dependencies.now ?? (() => new Date());
  const createLessonId = dependencies.createLessonId ?? buildLessonId;

  return async (input) => {
    throwIfAborted(input.signal);
    const existingReflection = await dependencies.runRepository.findRaceReflectionByRaceId(
      input.raceId
    );
    if (existingReflection !== null) {
      reportProgress(input, "保存済みの振り返りがあるため再取得は行いません。");
      return { raceId: input.raceId };
    }

    const race = await dependencies.runRepository.findRaceById(input.raceId);
    if (race === null) {
      throw new Error("race.json が見つかりません。先にレースを取得してください。");
    }
    const prediction = await dependencies.runRepository.findPredictionByRaceId(input.raceId);
    if (prediction === null) {
      throw new Error("prediction.json が見つかりません。先に予想を実行してください。");
    }

    const result = await loadOrCollectRaceResult({
      input,
      collectRaceResultSnapshot,
      extractRaceResultFromSnapshot,
      runRepository: dependencies.runRepository
    });
    throwIfAborted(input.signal);

    reportProgress(input, "予想方針を読み込んでいます。");
    const policy = await dependencies.policyRepository.readPredictionPolicy();
    throwIfAborted(input.signal);
    reportProgress(input, "Codexでレース結果を振り返っています。");
    const draft = await reflectRace(buildReflectRaceInput(input, race, prediction, result, policy));
    throwIfAborted(input.signal);

    const reflectedAt = now().toISOString();
    const lessons = draft.lessons.map((lesson, index) =>
      buildLessonEntry({
        raceId: race.id,
        lesson,
        index,
        reflectedAt,
        createLessonId
      })
    );
    reportProgress(input, `Lesson候補を保存しています: ${lessons.length}件`);
    for (const lesson of lessons) {
      await dependencies.lessonRepository.saveLessonEntry(lesson);
    }

    const reflection = buildRaceReflection({
      raceId: race.id,
      reflectedAt,
      draft,
      lessons
    });
    reportProgress(input, "reflection.json を保存しています。");
    await dependencies.runRepository.saveRaceReflection(reflection);

    return { raceId: race.id };
  };
};

const loadOrCollectRaceResult = async (input: {
  input: ReflectRaceUseCaseInput;
  collectRaceResultSnapshot: (input: CollectRaceResultSnapshotInput) => Promise<SourcePageSnapshot>;
  extractRaceResultFromSnapshot: (input: ExtractRaceResultFromSnapshotInput) => Promise<RaceResult>;
  runRepository: RunRepository;
}): Promise<RaceResult> => {
  const existingResult = await input.runRepository.findRaceResultByRaceId(input.input.raceId);
  if (existingResult !== null) {
    reportProgress(input.input, "保存済みのレース結果を使用します。");
    return existingResult;
  }

  const resultUrl = buildNetkeibaRaceResultUrl(input.input.raceId);
  reportProgress(input.input, "netKeibaからレース結果を取得しています。");
  const snapshot = await input.collectRaceResultSnapshot(
    buildCollectRaceResultSnapshotInput(input.input, resultUrl)
  );
  throwIfAborted(input.input.signal);
  reportProgress(input.input, "AIでレース結果を構造化しています。");
  const result = await input.extractRaceResultFromSnapshot(
    buildExtractRaceResultInput(input.input, snapshot)
  );
  throwIfAborted(input.input.signal);
  reportProgress(input.input, "result.json を保存しています。");
  await input.runRepository.saveRaceResult(result);

  return result;
};

/** Web入力から netKeiba 結果snapshot 取得入力を作る。 */
const buildCollectRaceResultSnapshotInput = (
  input: ReflectRaceUseCaseInput,
  resultUrl: string
): CollectRaceResultSnapshotInput => {
  const collectInput: CollectRaceResultSnapshotInput = {
    resultUrl,
    headless: true
  };

  if (input.onProgress !== undefined) {
    collectInput.onProgress = input.onProgress;
  }
  if (input.minDelayMs !== undefined) {
    collectInput.minDelayMs = input.minDelayMs;
  }
  if (input.signal !== undefined) {
    collectInput.signal = input.signal;
  }

  return collectInput;
};

/** Web入力とsnapshotからRaceResult構造化入力を作る。 */
const buildExtractRaceResultInput = (
  input: ReflectRaceUseCaseInput,
  snapshot: SourcePageSnapshot
): ExtractRaceResultFromSnapshotInput => {
  const extractInput: ExtractRaceResultFromSnapshotInput = {
    raceId: input.raceId,
    snapshot,
    timeoutMs: input.resultExtractTimeoutMs ?? defaultResultExtractTimeoutMs
  };
  if (input.model !== undefined) {
    extractInput.model = input.model;
  }
  if (input.signal !== undefined) {
    extractInput.signal = input.signal;
  }

  return extractInput;
};

/** Web入力、Race、予想結果、確定結果、予想方針からAI振り返り入力を作る。 */
const buildReflectRaceInput = (
  input: ReflectRaceUseCaseInput,
  race: ReflectRaceInput["race"],
  prediction: ReflectRaceInput["prediction"],
  result: ReflectRaceInput["result"],
  policy: ReflectRaceInput["policy"]
): ReflectRaceInput => {
  const reflectInput: ReflectRaceInput = {
    race,
    prediction,
    result,
    policy,
    timeoutMs: input.reflectionTimeoutMs ?? defaultReflectionTimeoutMs
  };
  if (input.model !== undefined) {
    reflectInput.model = input.model;
  }
  if (input.signal !== undefined) {
    reflectInput.signal = input.signal;
  }

  return reflectInput;
};

/** AI出力のLesson下書きに保存メタ情報を付与する。 */
const buildLessonEntry = (input: {
  raceId: string;
  lesson: RaceReflectionDraft["lessons"][number];
  index: number;
  reflectedAt: string;
  createLessonId: (input: CreateLessonIdInput) => string;
}): LessonEntry => {
  return parseLessonEntry({
    id: input.createLessonId({
      raceId: input.raceId,
      index: input.index,
      reflectedAt: input.reflectedAt
    }),
    sourceRaceId: input.raceId,
    status: "draft",
    title: input.lesson.title.trim(),
    situationKey: input.lesson.situationKey.trim(),
    tags: normalizeTextArray(input.lesson.tags),
    diaryText: input.lesson.diaryText.trim(),
    decisionGuidance: input.lesson.decisionGuidance.trim(),
    applicableWhen: normalizeTextArray(input.lesson.applicableWhen),
    notApplicableWhen: normalizeTextArray(input.lesson.notApplicableWhen),
    confidence: input.lesson.confidence,
    createdAt: input.reflectedAt,
    updatedAt: input.reflectedAt
  });
};

/** RaceReflectionを保存用domain modelとして組み立てる。 */
const buildRaceReflection = (input: {
  raceId: string;
  reflectedAt: string;
  draft: RaceReflectionDraft;
  lessons: LessonEntry[];
}): RaceReflection => {
  return parseRaceReflection({
    raceId: input.raceId,
    reflectedAt: input.reflectedAt,
    summary: input.draft.summary,
    lessonIds: input.lessons.map((lesson) => lesson.id)
  });
};

/** Lesson IDをrace ID、候補番号、振り返り日時から作る。 */
const buildLessonId = (input: CreateLessonIdInput): string => {
  const normalizedRaceId = input.raceId.replaceAll(/[^0-9A-Za-z_-]/g, "-");
  const sequence = String(input.index + 1).padStart(2, "0");
  const timestamp = input.reflectedAt.replaceAll(/\D/g, "");
  return `lesson-${normalizedRaceId}-${sequence}-${timestamp}`;
};

/** 空文字を落とし、順序を保って重複を除いた文字列配列にする。 */
const normalizeTextArray = (values: string[]): string[] => {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
};

/** 呼び出し元が進捗表示を要求している場合だけメッセージを渡す。 */
const reportProgress = (input: ReflectRaceUseCaseInput, message: string): void => {
  input.onProgress?.(message);
};

/** 呼び出し元から中断されている場合は、次の外部I/Oへ進む前に停止する。 */
const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted !== true) {
    return;
  }

  throw new Error("レース振り返りジョブを中止しました。");
};
