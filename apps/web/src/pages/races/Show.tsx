import { AppLayout } from "@keiba-ai-assistant/web/components/layout/AppLayout";
import { HorseList } from "@keiba-ai-assistant/web/components/race/HorseList";
import { RaceSummary } from "@keiba-ai-assistant/web/components/race/RaceSummary";
import { useRaceDashboardView } from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";
import type { RaceShowPageProps } from "@keiba-ai-assistant/web/server/usecases/show-race";

const RaceShow = ({ raceId, race }: RaceShowPageProps) => {
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
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <RaceSummary race={raceView} />
        <HorseList horses={raceView.horses} />
      </main>
    </AppLayout>
  );
};

export default RaceShow;
