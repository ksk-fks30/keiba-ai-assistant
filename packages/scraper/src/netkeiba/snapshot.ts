import type { Locator, Page } from "playwright";
import {
  parseSourcePageSnapshot,
  type SourcePageLink,
  type SourcePageSnapshot
} from "@keiba-ai-assistant/models";
import { netkeibaSelectors } from "@keiba-ai-assistant/scraper/netkeiba/selectors";

/** 取得元ページsnapshotを作るときの設定。 */
export interface SourcePageSnapshotOptions {
  /** snapshot取得時刻を差し替える関数。テストで時刻を固定する場合に使う。 */
  now?: () => Date;
  /** 可視テキストの最大文字数。 */
  visibleTextLimit?: number;
  /** 表テキスト1件あたりの最大文字数。 */
  tableTextLimit?: number;
  /** AIに渡す表の最大件数。 */
  tableLimit?: number;
  /** AIに渡すリンクの最大件数。 */
  linkLimit?: number;
  /** リンク上限に関わらず優先して残すhref/textのパターン。 */
  priorityLinkPatterns?: RegExp[];
}

const defaultVisibleTextLimit = 20_000;
const defaultTableTextLimit = 4_000;
const defaultTableLimit = 20;
const defaultLinkLimit = 80;

/** Playwright page からHTMLや生DOMを保存しない軽量 snapshot を作る。 */
export const createSourcePageSnapshot = async (
  page: Page,
  options: SourcePageSnapshotOptions = {}
): Promise<SourcePageSnapshot> => {
  const pageTitle = await page.title();
  const bodyText = await readLocatorText(page.locator(netkeibaSelectors.body));
  const headings = await readLocatorTexts(page.locator(netkeibaSelectors.headings));
  const tableTexts = await readLocatorTexts(page.locator(netkeibaSelectors.tables));
  const links = await readPageLinks(
    page,
    options.linkLimit ?? defaultLinkLimit,
    options.priorityLinkPatterns ?? []
  );

  return parseSourcePageSnapshot({
    sourceUrl: page.url(),
    pageTitle: normalizeInlineText(pageTitle),
    visibleText: truncateText(
      normalizeBlockText(bodyText),
      options.visibleTextLimit ?? defaultVisibleTextLimit
    ),
    headings: headings.map(normalizeInlineText).filter(isNonEmptyText),
    tableTexts: tableTexts
      .slice(0, options.tableLimit ?? defaultTableLimit)
      .map((text) =>
        truncateText(normalizeBlockText(text), options.tableTextLimit ?? defaultTableTextLimit)
      )
      .filter(isNonEmptyText),
    links,
    capturedAt: (options.now?.() ?? new Date()).toISOString()
  });
};

/** Locator の innerText を読み、取得できない場合は空文字として扱う。 */
const readLocatorText = async (locator: Locator): Promise<string> => {
  try {
    return await locator.innerText({ timeout: 5_000 });
  } catch {
    return "";
  }
};

/** 複数要素の innerText を読み、取得できない場合は空配列として扱う。 */
const readLocatorTexts = async (locator: Locator): Promise<string[]> => {
  try {
    return await locator.allInnerTexts();
  } catch {
    return [];
  }
};

/** ページ上のリンクを、AI構造化に必要なテキストとhrefだけへ削る。 */
const readPageLinks = async (
  page: Page,
  limit: number,
  priorityLinkPatterns: RegExp[]
): Promise<SourcePageLink[]> => {
  if (limit <= 0 && priorityLinkPatterns.length === 0) {
    return [];
  }

  const links = await page.locator(netkeibaSelectors.links).evaluateAll((elements) =>
    elements.map((element) => {
      const anchor = element as HTMLAnchorElement;
      return {
        text: anchor.innerText,
        href: anchor.href
      };
    })
  );

  const normalizedLinks = links
    .map((link) => ({
      text: normalizeInlineText(link.text),
      href: normalizeInlineText(link.href)
    }))
    .filter((link) => isNonEmptyText(link.text) && isNonEmptyText(link.href));

  return selectPageLinks(normalizedLinks, limit, priorityLinkPatterns);
};

/** 重要リンクを落とさないように、優先リンクを先に確保してから上限まで通常リンクを足す。 */
const selectPageLinks = (
  links: SourcePageLink[],
  limit: number,
  priorityLinkPatterns: RegExp[]
): SourcePageLink[] => {
  if (priorityLinkPatterns.length === 0) {
    return links.slice(0, limit);
  }

  const selectedLinks: SourcePageLink[] = [];
  const selectedKeys = new Set<string>();
  const addLink = (link: SourcePageLink): void => {
    const key = `${link.text}\n${link.href}`;
    if (selectedKeys.has(key)) {
      return;
    }

    selectedKeys.add(key);
    selectedLinks.push(link);
  };

  for (const link of links) {
    if (isPriorityLink(link, priorityLinkPatterns)) {
      addLink(link);
    }
  }

  const targetLimit = Math.max(limit, selectedLinks.length);
  for (const link of links) {
    if (selectedLinks.length >= targetLimit) {
      break;
    }

    addLink(link);
  }

  return selectedLinks;
};

/** hrefまたは表示テキストが優先パターンに一致するリンクかどうかを判定する。 */
const isPriorityLink = (link: SourcePageLink, priorityLinkPatterns: RegExp[]): boolean => {
  return priorityLinkPatterns.some(
    (pattern) => matchesPattern(pattern, link.href) || matchesPattern(pattern, link.text)
  );
};

/** RegExp の lastIndex に影響されずに文字列一致を判定する。 */
const matchesPattern = (pattern: RegExp, value: string): boolean => {
  pattern.lastIndex = 0;
  return pattern.test(value);
};

/** 複数行の可視テキストを、行単位の意味が残る形で正規化する。 */
const normalizeBlockText = (value: string): string => {
  return value.split("\n").map(normalizeInlineText).filter(isNonEmptyText).join("\n");
};

/** DOM由来の余分な空白を1つにまとめる。 */
const normalizeInlineText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

/** AIに渡す snapshot が過度に大きくならないように文字数を制限する。 */
const truncateText = (value: string, limit: number): string => {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}\n[truncated]`;
};

/** 空ではない文字列かどうかを判定する。 */
const isNonEmptyText = (value: string): boolean => {
  return value.length > 0;
};
