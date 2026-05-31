interface HomeProps {
  projectName: string;
}

const Home = ({ projectName }: HomeProps) => {
  return (
    <main className="app-shell">
      <h1>{projectName}</h1>
    </main>
  );
};

export default Home;
