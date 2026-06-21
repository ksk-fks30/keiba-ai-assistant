import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parseRace, type Race } from "@keiba-ai-assistant/models";
import { readJockeyLeadingReferenceForRace } from "@keiba-ai-assistant/storage/jockey-leading-reference";

const tempRootDirs: string[] = [];
const jockeyLeadingReferencePathEnvName = "KEIBA_JOCKEY_LEADING_REFERENCE_PATH";
const originalJockeyLeadingReferencePath = process.env[jockeyLeadingReferencePathEnvName];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  restoreJockeyLeadingReferencePathEnv();
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("readJockeyLeadingReferenceForRace", () => {
  test("出走騎手だけをJSONから抽出してAI参照文にできる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const filePath = join(rootDir, "jockey-leading.json");
    await writeFile(filePath, createJockeyLeadingJson(), "utf8");
    const race = createRace(["ルメール", "岩田望", "未掲載太郎", "ルメール"]);

    // Act
    const actual = await readJockeyLeadingReferenceForRace(race, { filePath });

    // Assert
    expect(actual).toContain("データ基準日: 2026-06-14");
    expect(actual).toContain("参照URL: https://db.netkeiba.com/jockey/jockey_leading_jra.html");
    expect(actual).toContain("ルメール\tＣ．ルメール\t1\t294\t84\t54\t42\t114");
    expect(actual).toContain("岩田望\t岩田望来\t2\t371\t66\t50\t37\t218");
    expect(actual).toContain("0.612");
    expect(actual).toContain("0.412");
    expect(actual).toContain("照合できなかった騎手: 未掲載太郎");
    expect(actual?.match(/Ｃ．ルメール/g)).toHaveLength(1);
  });

  test("環境変数で参照ファイルを指定できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const filePath = join(rootDir, "jockey-leading.json");
    await writeFile(filePath, createJockeyLeadingJson(), "utf8");
    process.env[jockeyLeadingReferencePathEnvName] = filePath;
    const race = createRace(["ルメール"]);

    // Act
    const actual = await readJockeyLeadingReferenceForRace(race);

    // Assert
    expect(actual).toContain("ルメール\tＣ．ルメール\t1\t294\t84\t54\t42\t114");
  });

  test("参照ファイルが存在しない場合はundefinedを返す", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const race = createRace(["ルメール"]);

    // Act
    const actual = await readJockeyLeadingReferenceForRace(race, {
      filePath: join(rootDir, "missing.json")
    });

    // Assert
    expect(actual).toBeUndefined();
  });

  test("JSON構造が不正な場合はエラーにする", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const filePath = join(rootDir, "jockey-leading.json");
    await writeFile(
      filePath,
      JSON.stringify({ entries: [{ jockeyName: "Ｃ．ルメール" }] }),
      "utf8"
    );
    const race = createRace(["ルメール"]);

    // Act
    const actual = readJockeyLeadingReferenceForRace(race, { filePath });

    // Assert
    await expect(actual).rejects.toThrow("騎手リーディング参照データ");
  });
});

/** テスト用の騎手リーディングJSONを作る。 */
const createJockeyLeadingJson = (): string => {
  return JSON.stringify({
    dataAsOf: "2026-06-14",
    source: "netkeiba JRA騎手リーディング",
    sourceUrl: "https://db.netkeiba.com/jockey/jockey_leading_jra.html",
    netkeibaLabel: "2026/06/14現在",
    entries: [
      {
        rank: 1,
        jockeyName: "Ｃ．ルメール",
        firstPlaceCount: 84,
        secondPlaceCount: 54,
        thirdPlaceCount: 42,
        outOfFrameCount: 114,
        gradedRuns: 33,
        gradedWins: 9,
        specialRuns: 82,
        specialWins: 20,
        ordinaryRuns: 179,
        ordinaryWins: 55,
        turfRuns: 167,
        turfWins: 50,
        dirtRuns: 127,
        dirtWins: 34,
        winRate: 0.286,
        quinellaRate: 0.469,
        showRate: 0.612
      },
      {
        rank: 2,
        jockeyName: "岩田望来",
        firstPlaceCount: 66,
        secondPlaceCount: 50,
        thirdPlaceCount: 37,
        outOfFrameCount: 218,
        gradedRuns: 29,
        gradedWins: 2,
        specialRuns: 92,
        specialWins: 16,
        ordinaryRuns: 250,
        ordinaryWins: 48,
        turfRuns: 172,
        turfWins: 24,
        dirtRuns: 199,
        dirtWins: 42,
        winRate: 0.178,
        quinellaRate: 0.313,
        showRate: 0.412
      },
      {
        rank: 3,
        jockeyName: "岩田康誠",
        firstPlaceCount: 11,
        secondPlaceCount: 16,
        thirdPlaceCount: 25,
        outOfFrameCount: 212,
        gradedRuns: 23,
        gradedWins: 1,
        specialRuns: 60,
        specialWins: 3,
        ordinaryRuns: 181,
        ordinaryWins: 7,
        turfRuns: 110,
        turfWins: 5,
        dirtRuns: 154,
        dirtWins: 6,
        winRate: 0.042,
        quinellaRate: 0.102,
        showRate: 0.197
      }
    ]
  });
};

/** テスト用Raceを作る。 */
const createRace = (jockeyNames: string[]): Race => {
  return parseRace({
    id: "fixture-jockey-reference",
    sourceUrl: "https://example.test/race?race_id=fixture-jockey-reference",
    name: "騎手参照テスト",
    racecourse: "東京",
    surface: "turf",
    distanceMeters: 1600,
    horses: jockeyNames.map((jockeyName, index) => ({
      id: `fixture-horse-${index + 1}`,
      name: `架空馬${index + 1}`,
      horseNumber: index + 1,
      jockey: jockeyName
    })),
    collectedAt: "2026-06-14T12:00:00+09:00"
  });
};

/** 後片付け対象として記録した一時ディレクトリを作る。 */
const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-jockey-leading-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};

/** テストで変更した環境変数を元に戻す。 */
const restoreJockeyLeadingReferencePathEnv = (): void => {
  if (originalJockeyLeadingReferencePath === undefined) {
    delete process.env[jockeyLeadingReferencePathEnvName];
    return;
  }

  process.env[jockeyLeadingReferencePathEnvName] = originalJockeyLeadingReferencePath;
};
