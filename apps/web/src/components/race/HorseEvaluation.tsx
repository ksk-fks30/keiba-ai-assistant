import type { HorseEvaluation as HorseEvaluationModel } from "@keiba-ai-assistant/models";

interface HorseEvaluationProps {
  evaluation: HorseEvaluationModel;
}

export function HorseEvaluation({ evaluation }: HorseEvaluationProps) {
  return <section>{evaluation.mark}</section>;
}
