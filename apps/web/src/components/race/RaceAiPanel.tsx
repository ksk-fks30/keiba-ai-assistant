import type { Prediction, QaEntry } from "@keiba-ai-assistant/models";
import { PredictionSummary } from "@keiba-ai-assistant/web/components/race/PredictionSummary";
import { QuestionHistory } from "@keiba-ai-assistant/web/components/race/QuestionHistory";
import { QuestionPanel } from "@keiba-ai-assistant/web/components/race/QuestionPanel";
import type { HorseDashboardView } from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";

/** レース詳細右カラムに表示するAI分析と追加質問エリアのprops。 */
interface RaceAiPanelProps {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
  /** 保存済みprediction.jsonを検証したdomain model。未生成の場合はnull。 */
  prediction: Prediction | null;
  /** レース側に表示している出走馬一覧。馬IDを馬名へ解決するために使う。 */
  horses: HorseDashboardView[];
  /** 保存済みqa.jsonlを検証したdomain model配列。 */
  qaEntries: QaEntry[];
  /** 直前の追加質問で発生したエラー。ない場合はnull。 */
  askError: string | null;
}

/** AI分析、Q&A履歴、質問フォームを右カラムの1つの作業パネルとして表示する。 */
export const RaceAiPanel = ({
  raceId,
  prediction,
  horses,
  qaEntries,
  askError
}: RaceAiPanelProps) => {
  return (
    <aside className="overflow-hidden rounded-panel border border-app-border bg-app-surface shadow-sm xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100vh-2rem)] xl:flex-col">
      <div className="min-h-0 xl:flex-1 xl:overflow-y-auto">
        <PredictionSummary prediction={prediction} horses={horses} />
        <QuestionHistory entries={qaEntries} />
      </div>
      <QuestionPanel raceId={raceId} canAsk={prediction !== null} askError={askError} />
    </aside>
  );
};
