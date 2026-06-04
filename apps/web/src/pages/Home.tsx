import { PredictRacePanel } from "@keiba-ai-assistant/web/components/home/PredictRacePanel";
import { SavedRaceList } from "@keiba-ai-assistant/web/components/home/SavedRaceList";
import { AppLayout } from "@keiba-ai-assistant/web/components/layout/AppLayout";
import type { HomePageProps } from "@keiba-ai-assistant/web/server/usecases/show-home";

/** 保存済みレース一覧とnetKeiba URL入力フォームを表示するトップ画面。 */
const Home = ({ runs }: HomePageProps) => {
  return (
    <AppLayout>
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6">
        <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
          <PredictRacePanel />
          <SavedRaceList runs={runs} />
        </div>
      </main>
    </AppLayout>
  );
};

export default Home;
