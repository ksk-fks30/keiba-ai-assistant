import { useEffect, useRef } from "react";
import type { PredictRaceJobSnapshot } from "@keiba-ai-assistant/web/server/usecases/predict-race-job-store";

/** レース解析ジョブの進捗を固定高さのコンソールとして表示する。 */
export const PredictJobConsole = ({ job }: { job: PredictRaceJobSnapshot | null }) => {
  const consoleRef = useRef<HTMLDivElement>(null);
  const messages = job?.messages ?? ["レース解析ジョブはまだ開始されていません。"];

  useEffect(() => {
    const element = consoleRef.current;
    if (element === null) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  return (
    <section className="mt-4 rounded-md border border-app-border-soft bg-[#101915] p-3 text-xs text-white shadow-inner">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-white">console</h2>
        <span className="font-semibold text-white/60">{formatJobStatus(job?.status)}</span>
      </div>
      <div ref={consoleRef} className="mt-3 h-72 overflow-y-auto font-mono leading-relaxed">
        {messages.map((message, index) => (
          <p key={`${index}-${message}`} className="whitespace-pre-wrap text-white/80">
            <span className="text-turf-soft">$ </span>
            {message}
          </p>
        ))}
      </div>
    </section>
  );
};

/** ジョブ状態を短い表示文字列へ変換する。 */
const formatJobStatus = (status: PredictRaceJobSnapshot["status"] | undefined): string => {
  if (status === undefined) {
    return "idle";
  }

  const labels = {
    queued: "queued",
    running: "running",
    cancelling: "cancelling",
    succeeded: "done",
    failed: "failed"
  } as const;

  return labels[status];
};
