import type { PredictionPolicy, Race } from "@keiba-ai-assistant/models";

export interface RaceAnalysisPromptInput {
  race: Race;
  policy: PredictionPolicy;
}

export function buildRaceAnalysisPrompt(input: RaceAnalysisPromptInput): string {
  return [
    "Analyze the race using the user's policy.",
    "",
    "Policy:",
    input.policy.content,
    "",
    "Race data:",
    JSON.stringify(input.race, null, 2)
  ].join("\n");
}
