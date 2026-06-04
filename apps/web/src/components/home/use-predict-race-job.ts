import { router } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import type { PredictToast } from "@keiba-ai-assistant/web/components/home/PredictToast";
import type { PredictRaceJobSnapshot } from "@keiba-ai-assistant/web/server/usecases/predict-race-job-store";

/** レース解析ジョブUIが扱う状態と操作。 */
export interface UsePredictRaceJobResult {
  /** 入力中の netKeiba レースURL。 */
  raceUrl: string;
  /** netKeiba レースURLを更新する。 */
  setRaceUrl: (raceUrl: string) => void;
  /** 送信できる状態かどうか。 */
  canSubmit: boolean;
  /** ジョブ作成リクエスト中かどうか。 */
  isStartingJob: boolean;
  /** ジョブが実行中かどうか。 */
  isJobActive: boolean;
  /** 現在追跡しているジョブのsnapshot。 */
  activeJob: PredictRaceJobSnapshot | null;
  /** クライアント側に表示するエラーメッセージ。 */
  clientError: string | null;
  /** 完了または失敗通知の状態。 */
  toast: PredictToast | null;
  /** レース解析ジョブを開始する。 */
  start: () => Promise<void>;
  /** toastを閉じる。 */
  closeToast: () => void;
}

/** レース解析ジョブの開始、ポーリング、完了通知をまとめて扱うhook。 */
export const usePredictRaceJob = (): UsePredictRaceJobResult => {
  const [raceUrl, setRaceUrl] = useState("");
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [activeJob, setActiveJob] = useState<PredictRaceJobSnapshot | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [toast, setToast] = useState<PredictToast | null>(null);
  const notifiedJobIdsRef = useRef<Set<string>>(new Set());
  const trimmedRaceUrl = raceUrl.trim();
  const isJobActive = activeJob !== null && isPredictJobActive(activeJob);
  const canSubmit = trimmedRaceUrl.length > 0 && !isStartingJob && !isJobActive;

  const start = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }

    setIsStartingJob(true);
    setClientError(null);
    setToast(null);
    try {
      const job = await startPredictJob(trimmedRaceUrl);
      setActiveJob(job);
    } catch (error) {
      setClientError(readErrorMessage(error));
    } finally {
      setIsStartingJob(false);
    }
  };

  useEffect(() => {
    if (activeJob === null || !isPredictJobActive(activeJob)) {
      return;
    }

    let isCancelled = false;
    let timeoutId: number | undefined;

    /** 最新のジョブ状態を取得し、まだ実行中なら次のポーリングを予約する。 */
    const pollJob = async (): Promise<void> => {
      const nextJob = await fetchPredictJob(activeJob.id);
      if (isCancelled) {
        return;
      }

      setActiveJob(nextJob);
      if (isPredictJobActive(nextJob)) {
        timeoutId = window.setTimeout(runPollJob, 2000);
      }
    };

    /** setTimeout から async 処理を安全に呼ぶため、エラーを画面状態へ落とし込む。 */
    const runPollJob = (): void => {
      const pendingPoll = pollJob();
      pendingPoll.catch((error: unknown) => {
        if (!isCancelled) {
          setClientError(readErrorMessage(error));
        }
      });
    };

    timeoutId = window.setTimeout(runPollJob, 1000);
    return () => {
      isCancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeJob]);

  useEffect(() => {
    if (activeJob === null || isPredictJobActive(activeJob)) {
      return;
    }
    if (notifiedJobIdsRef.current.has(activeJob.id)) {
      return;
    }

    notifiedJobIdsRef.current.add(activeJob.id);
    setToast(buildPredictToast(activeJob));
    if (activeJob.status === "succeeded") {
      router.reload({ only: ["runs"] });
    }
  }, [activeJob]);

  return {
    raceUrl,
    setRaceUrl,
    canSubmit,
    isStartingJob,
    isJobActive,
    activeJob,
    clientError,
    toast,
    start,
    closeToast: () => {
      setToast(null);
    }
  };
};

/** レース解析ジョブを開始する。 */
const startPredictJob = async (raceUrl: string): Promise<PredictRaceJobSnapshot> => {
  const response = await fetch("/races/predict-jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({ raceUrl })
  });
  const value = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(readErrorResponse(value));
  }

  return parsePredictJobSnapshot(value);
};

/** レース解析ジョブの現在状態を取得する。 */
const fetchPredictJob = async (jobId: string): Promise<PredictRaceJobSnapshot> => {
  const response = await fetch(`/races/predict-jobs/${encodeURIComponent(jobId)}`, {
    headers: { accept: "application/json" }
  });
  const value = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(readErrorResponse(value));
  }

  return parsePredictJobSnapshot(value);
};

/** unknownからPredictRaceJobSnapshotを検証して取り出す。 */
const parsePredictJobSnapshot = (value: unknown): PredictRaceJobSnapshot => {
  if (!isRecord(value)) {
    throw new Error("レース解析ジョブの状態を取得できませんでした。");
  }
  if (
    typeof value.id !== "string" ||
    !isPredictJobStatus(value.status) ||
    !Array.isArray(value.messages) ||
    !value.messages.every((message) => typeof message === "string") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("レース解析ジョブの状態を取得できませんでした。");
  }

  const snapshot: PredictRaceJobSnapshot = {
    id: value.id,
    status: value.status,
    messages: value.messages,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
  if (typeof value.raceId === "string") {
    snapshot.raceId = value.raceId;
  }
  if (typeof value.error === "string") {
    snapshot.error = value.error;
  }

  return snapshot;
};

/** ジョブ状態が実行中かどうかを返す。 */
const isPredictJobActive = (job: PredictRaceJobSnapshot): boolean => {
  return job.status === "queued" || job.status === "running";
};

/** unknownがPredictRaceJobStatusかどうかを判定する。 */
const isPredictJobStatus = (value: unknown): value is PredictRaceJobSnapshot["status"] => {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed";
};

/** 完了または失敗したジョブからtoast表示を作る。 */
const buildPredictToast = (job: PredictRaceJobSnapshot): PredictToast => {
  if (job.status === "succeeded") {
    const toast: PredictToast = {
      kind: "success",
      message: "レース解析が完了しました。"
    };
    if (job.raceId !== undefined) {
      toast.raceId = job.raceId;
    }

    return toast;
  }

  return {
    kind: "error",
    message: job.error ?? "レース解析に失敗しました。"
  };
};

/** JSON error responseから表示用メッセージを取り出す。 */
const readErrorResponse = (value: unknown): string => {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  return "レース解析ジョブの通信に失敗しました。";
};

/** unknownが文字列キーを持つobjectかどうかを判定する。 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/** unknown の例外値から表示用メッセージを取り出す。 */
const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "レース解析ジョブの開始に失敗しました。";
};
