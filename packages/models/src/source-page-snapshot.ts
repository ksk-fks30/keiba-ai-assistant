import { z } from "zod";
import { sourcePageLinkSchema } from "@keiba-ai-assistant/models/source-page-link";

/** 情報取得元ページsnapshotモデル。HTMLや生DOMを保存せず、AI構造化に必要な可視情報だけを表す。 */
export const sourcePageSnapshotSchema = z.object({
  // snapshotを取得したページURL。
  sourceUrl: z.url(),
  // ブラウザが取得したページタイトル。
  pageTitle: z.string(),
  // ページ上の可視テキストを正規化した本文。
  visibleText: z.string(),
  // h1からh3相当の見出しテキスト。
  headings: z.array(z.string()),
  // 表として表示されている領域のテキスト。
  tableTexts: z.array(z.string()),
  // AI構造化に使う最小限のリンク一覧。
  links: z.array(sourcePageLinkSchema),
  // snapshotを取得した日時。
  capturedAt: z.string()
});

export type SourcePageSnapshot = z.infer<typeof sourcePageSnapshotSchema>;

export const parseSourcePageSnapshot = (value: unknown): SourcePageSnapshot => {
  return sourcePageSnapshotSchema.parse(value);
};
