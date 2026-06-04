import { LoaderCircle, Play, Search } from "lucide-react";
import type { FormEvent } from "react";
import { PredictJobConsole } from "@keiba-ai-assistant/web/components/home/PredictJobConsole";
import { PredictToastView } from "@keiba-ai-assistant/web/components/home/PredictToast";
import { usePredictRaceJob } from "@keiba-ai-assistant/web/components/home/use-predict-race-job";

/** netKeiba URL入力からレース解析ジョブを開始し、進捗を表示するパネル。 */
export const PredictRacePanel = () => {
  const predictRaceJob = usePredictRaceJob();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await predictRaceJob.start();
  };

  return (
    <>
      <section className="rounded-panel border border-app-border bg-app-surface p-5 shadow-sm xl:sticky xl:top-5 xl:self-start">
        <div className="flex items-center gap-2">
          <Play aria-hidden="true" className="text-turf" size={20} />
          <h1 className="text-xl font-bold text-app-text">レース解析</h1>
        </div>
        <form className="mt-5" method="post" action="/races/predict-jobs" onSubmit={handleSubmit}>
          <label className="text-xs font-semibold text-app-subtle" htmlFor="race-url">
            netKeiba レースURL
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="race-url"
              name="raceUrl"
              type="url"
              inputMode="url"
              value={predictRaceJob.raceUrl}
              disabled={predictRaceJob.isStartingJob || predictRaceJob.isJobActive}
              placeholder="https://race.netkeiba.com/race/..."
              className="min-w-0 flex-1 rounded-md border border-app-border bg-white px-3 py-2 text-sm text-app-text outline-none transition focus:border-info focus:ring-2 focus:ring-info-soft disabled:bg-app-muted disabled:text-app-subtle"
              onChange={(event) => {
                predictRaceJob.setRaceUrl(event.currentTarget.value);
              }}
            />
            <button
              type="submit"
              disabled={!predictRaceJob.canSubmit}
              className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md bg-turf px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-turf-dark disabled:cursor-not-allowed disabled:bg-app-border disabled:text-app-subtle"
              style={{ cursor: predictRaceJob.canSubmit ? "pointer" : "not-allowed" }}
            >
              {predictRaceJob.isStartingJob || predictRaceJob.isJobActive ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
              ) : (
                <Search aria-hidden="true" size={16} />
              )}
              <span>
                {predictRaceJob.isStartingJob || predictRaceJob.isJobActive ? "解析中" : "開始"}
              </span>
            </button>
          </div>
          {predictRaceJob.isStartingJob ? (
            <p className="mt-2 text-xs font-semibold leading-relaxed text-info">
              レース解析ジョブを作成しています。
            </p>
          ) : null}
          {predictRaceJob.clientError !== null ? (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold leading-relaxed text-rose-700">
              {predictRaceJob.clientError}
            </p>
          ) : null}
        </form>
        <PredictJobConsole job={predictRaceJob.activeJob} />
      </section>
      <PredictToastView toast={predictRaceJob.toast} onClose={predictRaceJob.closeToast} />
    </>
  );
};
