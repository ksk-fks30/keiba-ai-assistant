import {
  parseRace,
  parseRaceDraft,
  type Race,
  type RaceDraft,
  type RaceDraftHorse,
  type RaceDraftPastPerformance,
  type RaceDraftPedigree,
  type RaceSourceSnapshot
} from "@keiba-ai-assistant/models";
import {
  createCodexSdkRuntime,
  type CodexJsonRuntime,
  type CodexSdkRuntimeOptions
} from "@keiba-ai-assistant/ai/codex";
import {
  buildRaceDraftOutputSchema,
  buildRaceExtractionPrompt
} from "@keiba-ai-assistant/ai/prompts";

/** ページsnapshotからRaceを構造化する入力。 */
export interface ExtractRaceFromSnapshotInput {
  /** ブラウザ操作で取得した、レースページと馬詳細ページの軽量snapshot。 */
  snapshot: RaceSourceSnapshot;
  /** この抽出で利用する Codex モデル名。 */
  model?: string;
  /** 取得日時を差し替える関数。テストや再実行で日時を固定する場合に使う。 */
  now?: () => Date;
  /** テストや差し替え実行で使う AI runtime。未指定なら Codex SDK runtime を使う。 */
  runtime?: CodexJsonRuntime;
}

/** ブラウザsnapshotをCodexに構造化させ、保存可能なRaceとして検証して返す。 */
export const extractRaceFromSnapshot = async (
  input: ExtractRaceFromSnapshotInput
): Promise<Race> => {
  const prompt = buildRaceExtractionPrompt({ snapshot: input.snapshot });
  const runtime = input.runtime ?? createCodexSdkRuntime(buildCodexSdkRuntimeOptions(input));

  // Codexには保存メタ情報を含まない下書きを要求し、URLと取得日時はアプリ側で事実値を付与する。
  const value = await runtime.generateJson({
    prompt,
    outputSchema: buildRaceDraftOutputSchema(),
    model: input.model
  });
  const draft = parseRaceDraft(value);

  return buildRace(input, draft);
};

/** extractRaceFromSnapshot の入力から Codex SDK runtime の初期化オプションだけを抽出する。 */
const buildCodexSdkRuntimeOptions = (
  input: ExtractRaceFromSnapshotInput
): CodexSdkRuntimeOptions => {
  const options: CodexSdkRuntimeOptions = {};

  if (input.model !== undefined) {
    options.model = input.model;
  }

  return options;
};

/** AIのレース下書きにブラウザ取得由来のメタ情報を付与し、保存用Raceにする。 */
const buildRace = (input: ExtractRaceFromSnapshotInput, draft: RaceDraft): Race => {
  const { startTime, direction, ...raceDraft } = draft;

  return parseRace({
    ...raceDraft,
    sourceUrl: input.snapshot.racePage.sourceUrl,
    collectedAt: buildCollectedAt(input),
    ...buildNullableStringProperty("startTime", startTime),
    ...buildNullableStringProperty("direction", direction),
    horses: draft.horses.map(mapDraftHorse)
  });
};

/** レースデータに記録する取得日時をISO 8601文字列で作る。 */
const buildCollectedAt = (input: ExtractRaceFromSnapshotInput): string => {
  return (input.now?.() ?? new Date(input.snapshot.racePage.capturedAt)).toISOString();
};

/** AI出力用の出走馬下書きを、保存用RaceのHorseに変換する。 */
const mapDraftHorse = (horse: RaceDraftHorse) => {
  return {
    id: horse.id,
    name: horse.name,
    horseNumber: horse.horseNumber,
    ...buildNullableStringProperty("sex", horse.sex),
    ...buildNullableNumberProperty("age", horse.age),
    jockey: horse.jockey,
    ...buildNullableStringProperty("trainer", horse.trainer),
    ...buildNullableNumberProperty("bodyWeightKg", horse.bodyWeightKg),
    ...buildNullableNumberProperty("bodyWeightDiffKg", horse.bodyWeightDiffKg),
    ...buildNullableNumberProperty("odds", horse.odds),
    ...buildNullableNumberProperty("popularity", horse.popularity),
    pedigree: mapDraftPedigree(horse.pedigree),
    pastPerformances: horse.pastPerformances.map(mapDraftPastPerformance)
  };
};

/** AI出力用の血統下書きを、保存用RaceのPedigreeに変換する。 */
const mapDraftPedigree = (pedigree: RaceDraftPedigree) => {
  return {
    ...buildOptionalStringProperty("sire", pedigree.sire),
    ...buildOptionalStringProperty("dam", pedigree.dam),
    ...buildOptionalStringProperty("damSire", pedigree.damSire),
    familyNotes: pedigree.familyNotes.filter(isNonEmptyText)
  };
};

/** AI出力用の過去走下書きを、保存用RaceのPastPerformanceに変換する。 */
const mapDraftPastPerformance = (performance: RaceDraftPastPerformance) => {
  return {
    date: performance.date,
    raceName: performance.raceName,
    ...buildOptionalStringProperty("racecourse", performance.racecourse),
    surface: performance.surface,
    ...buildNullableNumberProperty("distanceMeters", performance.distanceMeters),
    ...buildOptionalStringProperty("trackCondition", performance.trackCondition),
    ...buildNullableNumberProperty("finishPosition", performance.finishPosition),
    ...buildOptionalStringProperty("jockey", performance.jockey),
    ...buildNullableNumberProperty("weightCarriedKg", performance.weightCarriedKg),
    ...buildNullableNumberProperty("bodyWeightKg", performance.bodyWeightKg),
    ...buildNullableNumberProperty("odds", performance.odds),
    ...buildNullableNumberProperty("popularity", performance.popularity),
    ...buildOptionalStringProperty("margin", performance.margin),
    ...buildOptionalStringProperty("runningStyle", performance.runningStyle),
    ...buildOptionalStringProperty("note", performance.note)
  };
};

/** 空文字でない文字列だけを指定キーのプロパティとして返す。 */
const buildOptionalStringProperty = <Key extends string>(
  key: Key,
  value: string
): Partial<Record<Key, string>> => {
  if (!isNonEmptyText(value)) {
    return {};
  }

  return { [key]: value } as Partial<Record<Key, string>>;
};

/** nullではなく空文字でもない文字列だけを指定キーのプロパティとして返す。 */
const buildNullableStringProperty = <Key extends string>(
  key: Key,
  value: string | null
): Partial<Record<Key, string>> => {
  if (value === null) {
    return {};
  }

  return buildOptionalStringProperty(key, value);
};

/** nullではない数値だけを指定キーのプロパティとして返す。 */
const buildNullableNumberProperty = <Key extends string>(
  key: Key,
  value: number | null
): Partial<Record<Key, number>> => {
  if (value === null) {
    return {};
  }

  return { [key]: value } as Partial<Record<Key, number>>;
};

/** 空ではない文字列かどうかを判定する。 */
const isNonEmptyText = (value: string): boolean => {
  return value.trim().length > 0;
};
