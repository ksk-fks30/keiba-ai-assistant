interface RaceListItem {
  id: string;
  name: string;
}

interface RaceIndexProps {
  races: RaceListItem[];
}

const RaceIndex = ({ races }: RaceIndexProps) => {
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
};

export default RaceIndex;
