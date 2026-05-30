import type { Horse } from "@keiba-ai-assistant/models";

interface HorseListProps {
  horses: Horse[];
}

export function HorseList({ horses }: HorseListProps) {
  return (
    <ul>
      {horses.map((horse) => (
        <li key={horse.id}>{horse.name}</li>
      ))}
    </ul>
  );
}
