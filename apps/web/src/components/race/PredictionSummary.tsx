import type { Prediction } from "@keiba-ai-assistant/models";

interface PredictionSummaryProps {
  prediction: Prediction;
}

export function PredictionSummary({ prediction }: PredictionSummaryProps) {
  return <section>{prediction.summary}</section>;
}
