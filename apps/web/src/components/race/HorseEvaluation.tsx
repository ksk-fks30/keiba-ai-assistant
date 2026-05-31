import type { HorseEvaluation as HorseEvaluationModel } from "@keiba-ai-assistant/models";

interface HorseEvaluationProps {
  evaluation: HorseEvaluationModel;
}

export const HorseEvaluation = ({ evaluation }: HorseEvaluationProps) => {
  return <section>{evaluation.mark}</section>;
};
