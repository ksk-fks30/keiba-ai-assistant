import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Race } from "@keiba-ai-assistant/models";
import { isMissingFileError } from "@keiba-ai-assistant/storage/file-system";

/** 騎手リーディング参照データを読み込む設定。 */
export interface JockeyLeadingReferenceOptions {
  /** 参照するJSONファイルのパス。未指定時は環境変数か `data/reference/` の2026年JRA騎手データを使う。 */
  filePath?: string | undefined;
}

interface JockeyLeadingData {
  dataAsOf: string;
  source: string;
  sourceUrl: string;
  netkeibaLabel: string;
  entries: JockeyLeadingRow[];
}

interface JockeyLeadingRow {
  rank: number;
  jockeyName: string;
  firstPlaceCount: number;
  secondPlaceCount: number;
  thirdPlaceCount: number;
  outOfFrameCount: number;
  turfRuns: number;
  turfWins: number;
  dirtRuns: number;
  dirtWins: number;
  winRate: number;
  quinellaRate: number;
  showRate: number;
  aliases: string[];
}

interface JockeyLeadingMatch {
  raceJockeyName: string;
  row: JockeyLeadingRow;
}

const defaultJockeyLeadingFilePath = fileURLToPath(
  new URL("../../../data/reference/jockey-leading-jra-2026-06-14.json", import.meta.url)
);

/** 騎手リーディング参照JSONのパスを上書きする環境変数名。 */
const jockeyLeadingReferencePathEnvName = "KEIBA_JOCKEY_LEADING_REFERENCE_PATH";

/**
 * レースに出走する騎手だけをJRA騎手リーディングJSONから抽出し、AIプロンプト用の短い参照文を返す。
 */
export const readJockeyLeadingReferenceForRace = async (
  race: Race,
  options: JockeyLeadingReferenceOptions = {}
): Promise<string | undefined> => {
  const jockeyNames = collectRaceJockeyNames(race);
  if (jockeyNames.length === 0) {
    return undefined;
  }

  const filePath = resolveJockeyLeadingFilePath(options);
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }

  const data = parseJockeyLeadingData(content, filePath);
  const matches: JockeyLeadingMatch[] = [];
  const missingJockeyNames: string[] = [];
  for (const jockeyName of jockeyNames) {
    const row = findJockeyLeadingRow(jockeyName, data.entries);
    if (row === undefined) {
      missingJockeyNames.push(jockeyName);
    } else {
      matches.push({ raceJockeyName: jockeyName, row });
    }
  }

  if (matches.length === 0 && missingJockeyNames.length === 0) {
    return undefined;
  }

  return buildPromptReference(data, matches, missingJockeyNames);
};

/** オプション、環境変数、既定値の順で参照JSONのパスを決める。 */
const resolveJockeyLeadingFilePath = (options: JockeyLeadingReferenceOptions): string => {
  return options.filePath ?? readJockeyLeadingFilePathFromEnv() ?? defaultJockeyLeadingFilePath;
};

/** 空文字の環境変数は未指定として扱い、既定ファイルへfallbackする。 */
const readJockeyLeadingFilePathFromEnv = (): string | undefined => {
  const filePath = process.env[jockeyLeadingReferencePathEnvName]?.trim();
  if (filePath === undefined || filePath.length === 0) {
    return undefined;
  }

  return filePath;
};

/** Raceから重複を除いた騎手名を出走順に取り出す。 */
const collectRaceJockeyNames = (race: Race): string[] => {
  const jockeyNames: string[] = [];
  const seen = new Set<string>();
  for (const horse of race.horses) {
    const jockeyName = horse.jockey?.trim();
    if (jockeyName === undefined || jockeyName.length === 0) {
      continue;
    }

    const normalized = normalizeJockeyName(jockeyName);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    jockeyNames.push(jockeyName);
  }

  return jockeyNames;
};

/** JSON本文をAI参照用の騎手リーディングデータへ変換する。 */
const parseJockeyLeadingData = (content: string, filePath: string): JockeyLeadingData => {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    throw new Error(`騎手リーディング参照データのJSONが不正です: ${filePath}`, {
      cause: error
    });
  }

  const root = readObject(value, filePath, "root");
  const entries = readArrayProperty(root, "entries", filePath).map((entry, index) =>
    parseJockeyLeadingRow(entry, filePath, `entries[${index}]`)
  );

  return {
    dataAsOf: readStringProperty(root, "dataAsOf", filePath),
    source: readStringProperty(root, "source", filePath),
    sourceUrl: readStringProperty(root, "sourceUrl", filePath),
    netkeibaLabel: readStringProperty(root, "netkeibaLabel", filePath),
    entries
  };
};

/** JSONの1要素を騎手リーディング行へ変換する。 */
const parseJockeyLeadingRow = (
  value: unknown,
  filePath: string,
  location: string
): JockeyLeadingRow => {
  const entry = readObject(value, filePath, location);
  const jockeyName = readStringProperty(entry, "jockeyName", filePath, location);

  return {
    rank: readNumberProperty(entry, "rank", filePath, location),
    jockeyName,
    firstPlaceCount: readNumberProperty(entry, "firstPlaceCount", filePath, location),
    secondPlaceCount: readNumberProperty(entry, "secondPlaceCount", filePath, location),
    thirdPlaceCount: readNumberProperty(entry, "thirdPlaceCount", filePath, location),
    outOfFrameCount: readNumberProperty(entry, "outOfFrameCount", filePath, location),
    turfRuns: readNumberProperty(entry, "turfRuns", filePath, location),
    turfWins: readNumberProperty(entry, "turfWins", filePath, location),
    dirtRuns: readNumberProperty(entry, "dirtRuns", filePath, location),
    dirtWins: readNumberProperty(entry, "dirtWins", filePath, location),
    winRate: readNumberProperty(entry, "winRate", filePath, location),
    quinellaRate: readNumberProperty(entry, "quinellaRate", filePath, location),
    showRate: readNumberProperty(entry, "showRate", filePath, location),
    aliases: buildJockeyNameAliases(jockeyName)
  };
};

/** 対象騎手名に対応するリーディング行を、完全一致か一意の前方一致で探す。 */
const findJockeyLeadingRow = (
  raceJockeyName: string,
  rows: JockeyLeadingRow[]
): JockeyLeadingRow | undefined => {
  const raceAliases = buildJockeyNameAliases(raceJockeyName);
  const exactMatches = uniqueRows(
    rows.filter((row) => raceAliases.some((alias) => row.aliases.includes(alias)))
  );
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const prefixMatches = uniqueRows(
    rows.filter((row) =>
      raceAliases.some(
        (alias) => alias.length >= 2 && row.aliases.some((rowAlias) => rowAlias.startsWith(alias))
      )
    )
  );
  if (prefixMatches.length === 1) {
    return prefixMatches[0];
  }

  return undefined;
};

/** 騎手名表記ゆれを吸収する照合用エイリアスを作る。 */
const buildJockeyNameAliases = (jockeyName: string): string[] => {
  const normalized = normalizeJockeyName(jockeyName);
  const aliases = new Set<string>([normalized, normalized.replace(/\./g, "")]);
  const withoutInitial = normalized.replace(/^[A-Z]\./, "");
  aliases.add(withoutInitial);
  aliases.add(withoutInitial.replace(/\./g, ""));

  return [...aliases].filter((alias) => alias.length > 0);
};

/** 全角英数字や空白差を吸収した騎手名へ正規化する。 */
const normalizeJockeyName = (jockeyName: string): string => {
  return jockeyName
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[．･・]/g, ".")
    .toUpperCase();
};

/** 複数候補のうち、同一騎手名の重複だけを除く。 */
const uniqueRows = (rows: JockeyLeadingRow[]): JockeyLeadingRow[] => {
  const unique = new Map<string, JockeyLeadingRow>();
  for (const row of rows) {
    unique.set(row.jockeyName, row);
  }

  return [...unique.values()];
};

/** AIプロンプトへ差し込む短い参照文を作る。 */
const buildPromptReference = (
  data: JockeyLeadingData,
  matches: JockeyLeadingMatch[],
  missingJockeyNames: string[]
): string => {
  const header = [
    "レース騎手名",
    "リーディング騎手名",
    "順位",
    "騎乗数",
    "1着",
    "2着",
    "3着",
    "着外",
    "勝率",
    "連対率",
    "複勝率",
    "芝(出走/勝利)",
    "ダート(出走/勝利)"
  ];
  const tableRows = matches.map(({ raceJockeyName, row }) => [
    raceJockeyName,
    row.jockeyName,
    String(row.rank),
    String(row.firstPlaceCount + row.secondPlaceCount + row.thirdPlaceCount + row.outOfFrameCount),
    String(row.firstPlaceCount),
    String(row.secondPlaceCount),
    String(row.thirdPlaceCount),
    String(row.outOfFrameCount),
    formatRate(row.winRate),
    formatRate(row.quinellaRate),
    formatRate(row.showRate),
    `${row.turfRuns}/${row.turfWins}`,
    `${row.dirtRuns}/${row.dirtWins}`
  ]);
  const lines = [
    `データ基準日: ${data.dataAsOf}`,
    `参照元: ${data.source} ${data.netkeibaLabel}`,
    `参照URL: ${data.sourceUrl}`,
    "勝率、連対率、複勝率は小数表記です。例: 0.612 は 61.2% を表します。",
    "",
    [header, ...tableRows].map((row) => row.map(escapePromptTableCell).join("\t")).join("\n")
  ];

  if (missingJockeyNames.length > 0) {
    lines.push("", `照合できなかった騎手: ${missingJockeyNames.join(", ")}`);
  }

  return lines.join("\n");
};

/** 率の数値をAIが読みやすい小数3桁表記へ整える。 */
const formatRate = (value: number): string => {
  return value.toFixed(3);
};

/** プロンプト用の表セル内の改行とタブを空白へ寄せる。 */
const escapePromptTableCell = (value: string): string => {
  return value.replace(/[\t\r\n]+/g, " ").trim();
};

/** JSON値がオブジェクトであることを検証する。 */
const readObject = (
  value: unknown,
  filePath: string,
  location: string
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`騎手リーディング参照データのJSON構造が不正です: ${filePath}:${location}`);
  }

  return value as Record<string, unknown>;
};

/** JSONオブジェクトから文字列プロパティを取り出す。 */
const readStringProperty = (
  object: Record<string, unknown>,
  propertyName: string,
  filePath: string,
  location = "root"
): string => {
  const value = object[propertyName];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `騎手リーディング参照データの文字列項目が不正です: ${filePath}:${location}.${propertyName}`
    );
  }

  return value;
};

/** JSONオブジェクトから数値プロパティを取り出す。 */
const readNumberProperty = (
  object: Record<string, unknown>,
  propertyName: string,
  filePath: string,
  location: string
): number => {
  const value = object[propertyName];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `騎手リーディング参照データの数値項目が不正です: ${filePath}:${location}.${propertyName}`
    );
  }

  return value;
};

/** JSONオブジェクトから配列プロパティを取り出す。 */
const readArrayProperty = (
  object: Record<string, unknown>,
  propertyName: string,
  filePath: string
): unknown[] => {
  const value = object[propertyName];
  if (!Array.isArray(value)) {
    throw new Error(
      `騎手リーディング参照データの配列項目が不正です: ${filePath}:root.${propertyName}`
    );
  }

  return value;
};
