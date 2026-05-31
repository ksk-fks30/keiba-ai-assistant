export const netkeibaSelectors = {
  /** ページ全体の可視テキストを読む対象。 */
  body: "body",
  /** レース名やページの主要情報として扱う見出し。 */
  headings: "h1, h2, h3",
  /** 出走表やレース条件を含む可能性がある表。 */
  tables: "table",
  /** 馬ページなどへの遷移先候補としてAI構造化に渡すリンク。 */
  links: "a[href]"
} as const;
