import { z } from "zod";

/** 情報取得元ページ内のリンクsnapshotモデル。AI構造化に必要なリンク文字列と遷移先だけを表す。 */
export const sourcePageLinkSchema = z.object({
  // 画面上に表示されるリンクテキスト。
  text: z.string(),
  // リンク先URL。
  href: z.string()
});

export type SourcePageLink = z.infer<typeof sourcePageLinkSchema>;

export const parseSourcePageLink = (value: unknown): SourcePageLink => {
  return sourcePageLinkSchema.parse(value);
};
