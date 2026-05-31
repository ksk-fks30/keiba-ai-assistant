import type { Prediction, PredictionPolicy, QaEntry, Race } from "@keiba-ai-assistant/models";

export interface AskRaceInput {
  race: Race;
  prediction: Prediction;
  policy: PredictionPolicy;
  history: QaEntry[];
  question: string;
}

export const askRace = async (_input: AskRaceInput): Promise<string> => {
  return "Race Q&A is not implemented yet.";
};
