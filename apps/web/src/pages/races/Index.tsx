interface RaceListItem {
  id: string;
  name: string;
}

interface RaceIndexProps {
  races: RaceListItem[];
}

export default function RaceIndex({ races }: RaceIndexProps) {
  return (
    <main className="app-shell">
      <h1>Races</h1>
      <ul>
        {races.map((race) => (
          <li key={race.id}>{race.name}</li>
        ))}
      </ul>
    </main>
  );
}
