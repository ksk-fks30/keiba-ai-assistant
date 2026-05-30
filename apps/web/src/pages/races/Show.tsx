interface RaceShowProps {
  raceId: string;
}

export default function RaceShow({ raceId }: RaceShowProps) {
  return (
    <main className="app-shell">
      <h1>{raceId}</h1>
    </main>
  );
}
