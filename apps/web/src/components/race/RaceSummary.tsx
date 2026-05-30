import type { Race } from "@keiba-ai-assistant/models";

interface RaceSummaryProps {
  race: Race;
}

export function RaceSummary({ race }: RaceSummaryProps) {
  return <section>{race.name}</section>;
}
