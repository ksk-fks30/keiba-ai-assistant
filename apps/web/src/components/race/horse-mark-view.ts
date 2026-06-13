import type { HorseEvaluationMark, HorseMemoMark } from "@keiba-ai-assistant/models";

/** AI評価markを出走馬一覧に表示する印へ変換する対応表。 */
export const aiHorseEvaluationMarkSymbols = {
  favorite: "◎",
  second: "◯",
  third: "▲",
  longshot: "△",
  watch: "☆",
  dismiss: "✗"
} satisfies Record<HorseEvaluationMark, HorseMemoMark>;

/** 手動印の選択肢に添える短いラベル。 */
export const horseMemoMarkLabels = {
  "◎": "本命",
  "◯": "対抗",
  "▲": "単穴",
  "△": "連下",
  "☆": "注目",
  "✓": "押さえ",
  "✗": "消し"
} satisfies Record<HorseMemoMark, string>;

/** AI評価markを出走馬一覧に表示する印へ変換する。 */
export const formatAiHorseEvaluationMark = (mark: HorseEvaluationMark): HorseMemoMark => {
  return aiHorseEvaluationMarkSymbols[mark];
};
