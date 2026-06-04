import { AppLayout } from "@keiba-ai-assistant/web/components/layout/AppLayout";
import { HorseList } from "@keiba-ai-assistant/web/components/race/HorseList";
import { RaceSummary } from "@keiba-ai-assistant/web/components/race/RaceSummary";
import { RaceAiPanel } from "@keiba-ai-assistant/web/components/race/RaceAiPanel";
import { useRaceDashboardView } from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";
import type { RaceShowPageProps } from "@keiba-ai-assistant/web/server/usecases/show-race";

const RaceShow = ({ raceId, race, prediction, qaEntries, askError }: RaceShowPageProps) => {
  const raceView = useRaceDashboardView(race);

  if (raceView === null) {
    return (
      <AppLayout>
        <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
          <section className="w-full rounded-panel border border-app-border bg-app-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-subtle">
              {raceId}
            </p>
            <h1 className="mt-3 text-2xl font-bold text-app-text">race.json が見つかりません</h1>
            <p className="mt-3 text-sm text-app-subtle">
              runs 配下に対象race IDの保存済みレース情報がありません。
            </p>
          </section>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="grid min-h-screen gap-4 px-3 py-4 sm:px-4 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:min-h-0">
          <div className="flex min-w-0 flex-col gap-4 xl:h-full xl:overflow-y-auto xl:pr-1">
            <RaceSummary race={raceView} />
            <HorseList horses={raceView.horses} />
          </div>
        </div>
        <RaceAiPanel
          raceId={raceId}
          prediction={prediction}
          horses={raceView.horses}
          qaEntries={qaEntries}
          askError={askError}
        />
      </main>
    </AppLayout>
  );
};

export default RaceShow;
