import {
  parsePrediction,
  type Prediction,
  type PredictionPolicy,
  type Race
} from "@keiba-ai-assistant/models";
import { buildRaceAnalysisPrompt } from "@keiba-ai-assistant/ai/prompts";

export interface AnalyzeRaceInput {
  race: Race;
  policy: PredictionPolicy;
  model?: string;
}

export async function analyzeRace(input: AnalyzeRaceInput): Promise<Prediction> {
  buildRaceAnalysisPrompt({ race: input.race, policy: input.policy });

  return parsePrediction({
    raceId: input.race.id,
    summary: "AI analysis is not implemented yet.",
    evaluations: [],
    betCandidates: [],
    generatedAt: new Date().toISOString(),
    model: input.model
  });
}
