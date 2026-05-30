import type { Prediction, QaEntry, Race } from "@keiba-ai-assistant/models";

export interface AskRaceInput {
  race: Race;
  prediction: Prediction;
  history: QaEntry[];
  question: string;
}

export async function askRace(_input: AskRaceInput): Promise<string> {
  return "Race Q&A is not implemented yet.";
}
