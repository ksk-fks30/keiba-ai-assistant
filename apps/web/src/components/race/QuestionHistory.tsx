import type { QaEntry } from "@keiba-ai-assistant/models";

interface QuestionHistoryProps {
  entries: QaEntry[];
}

export function QuestionHistory({ entries }: QuestionHistoryProps) {
  return (
    <ol>
      {entries.map((entry) => (
        <li key={entry.id}>{entry.question}</li>
      ))}
    </ol>
  );
}
