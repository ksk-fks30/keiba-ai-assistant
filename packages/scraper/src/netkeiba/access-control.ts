import type { SourcePageSnapshot } from "@keiba-ai-assistant/models";

/** netKeiba 側のアクセス制限や警告を検知した結果。 */
export interface NetkeibaRestriction {
  /** 停止理由として表示する短い説明。 */
  reason: string;
  /** 検知に使った文字列またはパターン名。 */
  matchedText: string;
}

const restrictionPatterns: Array<{ reason: string; pattern: RegExp }> = [
  { reason: "通信制限が表示されています", pattern: /通信制限/ },
  { reason: "スクレイピング警告が表示されています", pattern: /スクレイピング/ },
  { reason: "閲覧制限が表示されています", pattern: /閲覧ができない/ },
  { reason: "アクセス集中または待機案内が表示されています", pattern: /しばらく時間をおいて/ },
  { reason: "認証要求が表示されています", pattern: /ログインが必要/ },
  { reason: "有料導線が表示されています", pattern: /有料会員|プレミアム会員/ },
  { reason: "CAPTCHA が表示されています", pattern: /captcha|CAPTCHA|私はロボットではありません/ }
];

/** snapshot の可視テキストから、取得を止めるべき制限画面かどうかを判定する。 */
export const detectNetkeibaRestriction = (
  snapshot: SourcePageSnapshot
): NetkeibaRestriction | null => {
  const text = [snapshot.pageTitle, snapshot.visibleText, ...snapshot.headings].join("\n");

  for (const candidate of restrictionPatterns) {
    const matched = text.match(candidate.pattern);
    if (matched?.[0] !== undefined) {
      return {
        reason: candidate.reason,
        matchedText: matched[0]
      };
    }
  }

  return null;
};
