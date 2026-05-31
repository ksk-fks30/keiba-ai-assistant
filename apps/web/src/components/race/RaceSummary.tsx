import type { Race } from "@keiba-ai-assistant/models";

interface RaceSummaryProps {
  race: Race;
}

export const RaceSummary = ({ race }: RaceSummaryProps) => {
  return <section>{race.name}</section>;
};
