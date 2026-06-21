import type { Prediction } from "@keiba-ai-assistant/models";
import type { HorseDashboardView } from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";

/** AI分析エリアのprops。 */
export interface PredictionSummaryProps {
  /** 保存済みprediction.jsonを検証したdomain model。未生成の場合はnull。 */
  prediction: Prediction | null;
  /** レース側に表示している出走馬一覧。馬IDを馬名へ解決するために使う。 */
  horses: HorseDashboardView[];
}

/** prediction未生成時の表示状態。 */
export interface EmptyPredictionSummaryView {
  /** prediction.json が存在するかどうか。 */
  status: "empty";
  /** AI分析パネルの生成日時ラベル。 */
  generatedAtLabel: string;
}

/** prediction生成済み時の表示状態。 */
export interface ReadyPredictionSummaryView {
  /** prediction.json が存在するかどうか。 */
  status: "ready";
  /** AI分析パネルの生成日時ラベル。 */
  generatedAtLabel: string;
  /** AI分析の総評。 */
  summary: string;
  /** 馬別評価の件数ラベル。 */
  evaluationCountLabel: string;
  /** 画面表示用に整形した馬別評価一覧。 */
  evaluations: PredictionSummaryEvaluationView[];
  /** 買い目候補の件数ラベル。 */
  betCandidateCountLabel: string;
  /** 画面表示用に整形した買い目候補一覧。 */
  betCandidates: PredictionSummaryBetCandidateView[];
}

/** AI分析エリアの表示状態。 */
export type PredictionSummaryView = EmptyPredictionSummaryView | ReadyPredictionSummaryView;

/** 画面表示用に整形した馬別評価。 */
export interface PredictionSummaryEvaluationView {
  /** Reactのkeyに使う安定識別子。 */
  key: string;
  /** 表示用の馬名。 */
  horseName: string;
  /** AI評価の印ラベル。 */
  markLabel: string;
  /** AI評価の印チップ色。 */
  markColorClass: string;
  /** AI評価スコア。 */
  score: number;
  /** 評価理由。 */
  reasons: string[];
  /** リスク。 */
  risks: string[];
}

/** 画面表示用に整形した買い目候補。 */
export interface PredictionSummaryBetCandidateView {
  /** Reactのkeyに使う識別子。 */
  key: string;
  /** 表示用の券種名。 */
  typeLabel: string;
  /** 表示用の買い目。 */
  horsesLabel: string;
  /** 表示用の配分。 */
  stakeWeightLabel: string;
  /** 買い目候補の理由。 */
  reason: string;
}

type PredictionEvaluation = Prediction["evaluations"][number];
type PredictionBetCandidate = Prediction["betCandidates"][number];

/** PredictionSummaryの表示用データを組み立てる。 */
export const usePredictionSummary = (props: PredictionSummaryProps): PredictionSummaryView => {
  if (props.prediction === null) {
    const generatedAtLabel = "未生成";

    return {
      status: "empty",
      generatedAtLabel
    };
  }

  const horseNameById = buildHorseNameById(props.horses);
  const generatedAtLabel = formatGeneratedAt(props.prediction.generatedAt);
  const summary = props.prediction.summary;
  const evaluationCountLabel = `${props.prediction.evaluations.length}頭`;
  const evaluations = props.prediction.evaluations.map((evaluation) =>
    buildEvaluationView(evaluation, horseNameById)
  );
  const betCandidateCountLabel = `${props.prediction.betCandidates.length}件`;
  const betCandidates = props.prediction.betCandidates.map((candidate, index) =>
    buildBetCandidateView(candidate, horseNameById, index)
  );

  return {
    status: "ready",
    generatedAtLabel,
    summary,
    evaluationCountLabel,
    evaluations,
    betCandidateCountLabel,
    betCandidates
  };
};

/** Prediction内の馬別評価を画面表示用へ変換する。 */
const buildEvaluationView = (
  evaluation: PredictionEvaluation,
  horseNameById: Map<string, string>
): PredictionSummaryEvaluationView => {
  const horseName = resolveHorseName(evaluation.horseId, horseNameById);
  const markLabel = formatMark(evaluation.mark);
  const markColorClass = getMarkChipColorClass(evaluation.mark);

  return {
    key: evaluation.horseId,
    horseName,
    markLabel,
    markColorClass,
    score: evaluation.score,
    reasons: evaluation.reasons,
    risks: evaluation.risks
  };
};

/** Prediction内の買い目候補を画面表示用へ変換する。 */
const buildBetCandidateView = (
  candidate: PredictionBetCandidate,
  horseNameById: Map<string, string>,
  index: number
): PredictionSummaryBetCandidateView => {
  const typeLabel = formatBetType(candidate.type);
  const horsesLabel = candidate.horses
    .map((horseId) => resolveHorseName(horseId, horseNameById))
    .join(" / ");
  const stakeWeightLabel = `${candidate.stakeWeight}/100`;
  const key = `${index}-${candidate.type}-${candidate.horses.join("-")}-${candidate.stakeWeight}`;

  return {
    key,
    typeLabel,
    horsesLabel,
    stakeWeightLabel,
    reason: candidate.reason
  };
};

/** 馬IDから表示中の馬名を引けるMapを作る。 */
const buildHorseNameById = (horses: HorseDashboardView[]): Map<string, string> => {
  return new Map(horses.map((horse) => [horse.id, `${horse.horseNumberLabel} ${horse.name}`]));
};

/** Prediction内の馬IDを、表示可能な馬名へ解決する。 */
const resolveHorseName = (horseId: string, horseNameById: Map<string, string>): string => {
  return horseNameById.get(horseId) ?? horseId;
};

/** AI評価の印を画面表示用の日本語に変換する。 */
const formatMark = (mark: PredictionEvaluation["mark"]): string => {
  const labels = {
    favorite: "本命",
    second: "対抗",
    third: "単穴",
    longshot: "穴",
    watch: "注視",
    dismiss: "軽視"
  } as const;

  return labels[mark];
};

/** 印ごとにチップの色を変え、評価の強弱を視覚的に区別する。 */
const getMarkChipColorClass = (mark: PredictionEvaluation["mark"]): string => {
  const colorClasses = {
    favorite: "border-odds bg-odds-soft text-odds",
    second: "border-info bg-info-soft text-info",
    third: "border-yellow-300 bg-yellow-100 text-yellow-800",
    longshot: "border-rose-300 bg-rose-50 text-rose-700",
    watch: "border-app-border bg-app-muted text-app-text",
    dismiss: "border-app-border bg-white text-app-subtle"
  } as const;

  return colorClasses[mark];
};

/** 保存済みpredictionの券種を、買い目候補に表示するラベルへ変換する。 */
const formatBetType = (type: string): string => {
  const trimmed = type.trim();
  if (trimmed.length === 0) {
    return type;
  }

  const normalized = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
  return betTypeLabels[normalized] ?? trimmed;
};

/** 英語で保存された券種名を画面表示用の日本語へ変換する対応表。 */
const betTypeLabels: Record<string, string> = {
  win: "単勝",
  place: "複勝",
  show: "複勝",
  quinella: "馬連",
  exacta: "馬単",
  wide: "ワイド",
  quinellaplace: "ワイド",
  trio: "三連複",
  trifecta: "三連単",
  bracketquinella: "枠連"
};

/** AI分析の生成日時を YY/mm/dd HH:mm 形式に整形する。 */
const formatGeneratedAt = (generatedAt: string): string => {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) {
    return generatedAt;
  }

  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hour}:${minute}`;
};
