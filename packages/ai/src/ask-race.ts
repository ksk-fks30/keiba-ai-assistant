import type { Prediction, QaEntry, Race } from "@keiba-ai-assistant/models";

export interface AskRaceInput {
  race: Race;
  prediction: Prediction;
  history: QaEntry[];
  question: string;
}

export const askRace = async (_input: AskRaceInput): Promise<string> => {
  return "Race Q&A is not implemented yet.";
};
