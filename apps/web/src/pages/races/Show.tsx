interface RaceShowProps {
  raceId: string;
}

const RaceShow = ({ raceId }: RaceShowProps) => {
  return (
    <main className="app-shell">
      <h1>{raceId}</h1>
    </main>
  );
};

export default RaceShow;
