interface HomeProps {
  projectName: string;
}

export default function Home({ projectName }: HomeProps) {
  return (
    <main className="app-shell">
      <h1>{projectName}</h1>
    </main>
  );
}
