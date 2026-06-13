import { useState } from "react";
import { AppLayout } from "@keiba-ai-assistant/web/components/layout/AppLayout";
import { HorseList } from "@keiba-ai-assistant/web/components/race/HorseList";
import { RaceSummary } from "@keiba-ai-assistant/web/components/race/RaceSummary";
import { RaceAiPanel } from "@keiba-ai-assistant/web/components/race/RaceAiPanel";
import { RaceResultCard } from "@keiba-ai-assistant/web/components/race/RaceResultCard";
import {
  useReflectRaceJob,
  type ReflectRaceToast
} from "@keiba-ai-assistant/web/components/race/use-reflect-race-job";
import { useRaceDashboardView } from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";
import { Button } from "@keiba-ai-assistant/web/components/ui/Button";
import { Modal } from "@keiba-ai-assistant/web/components/ui/Modal";
import { Toast } from "@keiba-ai-assistant/web/components/ui/Toast";
import type { RaceShowPageProps } from "@keiba-ai-assistant/web/server/usecases/show-race";

const RaceShow = ({
  raceId,
  race,
  prediction,
  qaEntries,
  horseMemos,
  raceResult,
  raceReflection,
  reflectionLessons,
  canStartReflection,
  askError
}: RaceShowPageProps) => {
  const raceView = useRaceDashboardView(race);
  const reflectionJob = useReflectRaceJob(raceId);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

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

  const isReflectionActionLoading = reflectionJob.isStartingJob || reflectionJob.isJobActive;
  const showReflectionAction = canStartReflection || isReflectionActionLoading;
  const handleConfirmReflection = async (): Promise<void> => {
    setIsConfirmModalOpen(false);
    await reflectionJob.start();
  };

  return (
    <AppLayout>
      <main className="grid min-h-screen gap-4 px-3 py-4 sm:px-4 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:min-h-0">
          <div className="flex min-w-0 flex-col gap-4 xl:h-full xl:overflow-y-auto xl:pr-1">
            <RaceSummary
              race={raceView}
              showReflectionAction={showReflectionAction}
              isReflectionActionLoading={isReflectionActionLoading}
              onReflectionActionClick={() => {
                setIsConfirmModalOpen(true);
              }}
            />
            {raceResult !== null && raceReflection !== null ? (
              <RaceResultCard
                result={raceResult}
                reflection={raceReflection}
                lessons={reflectionLessons}
              />
            ) : null}
            <HorseList
              raceId={raceId}
              horses={raceView.horses}
              prediction={prediction}
              horseMemos={horseMemos}
            />
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
      <ReflectionConfirmModal
        isOpen={isConfirmModalOpen}
        onCancel={() => {
          setIsConfirmModalOpen(false);
        }}
        onConfirm={handleConfirmReflection}
      />
      <ReflectionToast toast={reflectionJob.toast} onClose={reflectionJob.closeToast} />
    </AppLayout>
  );
};

/** 結果取得と振り返り開始前の確認モーダル。 */
const ReflectionConfirmModal = ({
  isOpen,
  onCancel,
  onConfirm
}: {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      footer={
        <>
          <Button onClick={onCancel} type="button" variant="neutral">
            キャンセル
          </Button>
          <Button
            onClick={async () => {
              await onConfirm();
            }}
            type="button"
            variant="primary"
          >
            振り返る
          </Button>
        </>
      }
      isOpen={isOpen}
      title="結果取得と振り返り"
    >
      このレースの結果を取得し振り返りますか？
    </Modal>
  );
};

/** 振り返りジョブの完了または失敗toast。 */
const ReflectionToast = ({
  toast,
  onClose
}: {
  toast: ReflectRaceToast | null;
  onClose: () => void;
}) => {
  if (toast === null) {
    return null;
  }

  return (
    <Toast
      closeLabel="閉じる"
      kind={toast.kind}
      message={toast.message}
      onClose={onClose}
      presentation="tinted"
    />
  );
};

export default RaceShow;
