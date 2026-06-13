import { router } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import type { ReflectRaceJobSnapshot } from "@keiba-ai-assistant/web/server/usecases/reflect-race-job-store";

/** レース振り返りtoast。 */
export interface ReflectRaceToast {
  /** 表示の種類。 */
  kind: "success" | "error";
  /** 表示メッセージ。 */
  message: string;
}

/** レース振り返りジョブUIが扱う状態と操作。 */
export interface UseReflectRaceJobResult {
  /** ジョブ作成リクエスト中かどうか。 */
  isStartingJob: boolean;
  /** ジョブが実行中かどうか。 */
  isJobActive: boolean;
  /** 現在追跡しているジョブのsnapshot。 */
  activeJob: ReflectRaceJobSnapshot | null;
  /** クライアント側に表示するエラーメッセージ。 */
  clientError: string | null;
  /** 完了または失敗通知の状態。 */
  toast: ReflectRaceToast | null;
  /** レース振り返りジョブを開始する。 */
  start: () => Promise<void>;
  /** toastを閉じる。 */
  closeToast: () => void;
}

/** レース振り返りジョブの開始、ポーリング、完了通知をまとめて扱うhook。 */
export const useReflectRaceJob = (raceId: string): UseReflectRaceJobResult => {
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [activeJob, setActiveJob] = useState<ReflectRaceJobSnapshot | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [toast, setToast] = useState<ReflectRaceToast | null>(null);
  const notifiedJobIdsRef = useRef<Set<string>>(new Set());
  const isJobActive = activeJob !== null && isReflectJobActive(activeJob);

  const start = async (): Promise<void> => {
    if (isStartingJob || isJobActive) {
      return;
    }

    setIsStartingJob(true);
    setClientError(null);
    setToast(null);
    try {
      const job = await startReflectJob(raceId);
      saveStoredReflectJobId(raceId, job.id);
      setActiveJob(job);
    } catch (error) {
      const message = readErrorMessage(error);
      setClientError(message);
      setToast({ kind: "error", message });
    } finally {
      setIsStartingJob(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    /** リロードや画面遷移から戻った直後に、同じタブで追跡中だったジョブを復元する。 */
    const restoreJob = async (): Promise<void> => {
      try {
        const jobId = readStoredReflectJobId(raceId);
        if (jobId === null) {
          return;
        }

        const job = await fetchReflectJob(raceId, jobId);
        if (isCancelled) {
          return;
        }

        setClientError(null);
        setActiveJob(job);
        if (!isReflectJobActive(job)) {
          clearStoredReflectJobId(raceId);
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        clearStoredReflectJobId(raceId);
        if (!isReflectJobNotFoundError(error)) {
          const message = readErrorMessage(error);
          setClientError(message);
          setToast({ kind: "error", message });
        }
      }
    };

    window.setTimeout(async () => {
      await restoreJob();
    }, 0);

    return () => {
      isCancelled = true;
    };
  }, [raceId]);

  useEffect(() => {
    if (activeJob === null || !isReflectJobActive(activeJob)) {
      return;
    }

    let isCancelled = false;
    let timeoutId: number | undefined;

    /** 指定時間後に最新のジョブ状態を取得する。 */
    const schedulePollJob = (delayMs: number): void => {
      timeoutId = window.setTimeout(async () => {
        await runPollJob();
      }, delayMs);
    };

    /** 最新のジョブ状態を取得し、まだ実行中なら次のポーリングを予約する。 */
    const pollJob = async (): Promise<void> => {
      const nextJob = await fetchReflectJob(raceId, activeJob.id);
      if (isCancelled) {
        return;
      }

      setClientError(null);
      setActiveJob(nextJob);
      if (isReflectJobActive(nextJob)) {
        schedulePollJob(2000);
      }
    };

    /** setTimeout から async 処理を安全に呼ぶため、エラーを画面状態へ落とし込む。 */
    const runPollJob = async (): Promise<void> => {
      try {
        await pollJob();
      } catch (error) {
        if (!isCancelled) {
          if (isReflectJobNotFoundError(error)) {
            clearStoredReflectJobId(raceId);
            setActiveJob(null);
            const message = readErrorMessage(error);
            setClientError(message);
            setToast({ kind: "error", message });
            return;
          }
          const message = readErrorMessage(error);
          setClientError(message);
          setToast({ kind: "error", message });
          schedulePollJob(5000);
        }
      }
    };

    schedulePollJob(1000);
    return () => {
      isCancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeJob, raceId]);

  useEffect(() => {
    if (activeJob === null || isReflectJobActive(activeJob)) {
      return;
    }
    if (notifiedJobIdsRef.current.has(activeJob.id)) {
      return;
    }

    notifiedJobIdsRef.current.add(activeJob.id);
    clearStoredReflectJobId(raceId);
    const nextToast = buildReflectToast(activeJob);
    setToast(nextToast);
    if (activeJob.status === "succeeded") {
      router.reload({
        only: ["raceResult", "raceReflection", "reflectionLessons", "canStartReflection"]
      });
    }
  }, [activeJob, raceId]);

  return {
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

/** レース振り返りジョブを開始する。 */
const startReflectJob = async (raceId: string): Promise<ReflectRaceJobSnapshot> => {
  const response = await fetch(`/races/${encodeURIComponent(raceId)}/reflection-jobs`, {
    method: "POST",
    headers: { accept: "application/json" }
  });
  const value = (await response.json()) as unknown;
  if (!response.ok) {
    throw createReflectJobRequestError(readErrorResponse(value), response.status);
  }

  return parseReflectJobSnapshot(value);
};

/** レース振り返りジョブの現在状態を取得する。 */
const fetchReflectJob = async (raceId: string, jobId: string): Promise<ReflectRaceJobSnapshot> => {
  const response = await fetch(
    `/races/${encodeURIComponent(raceId)}/reflection-jobs/${encodeURIComponent(jobId)}`,
    { headers: { accept: "application/json" } }
  );
  const value = (await response.json()) as unknown;
  if (!response.ok) {
    throw createReflectJobRequestError(readErrorResponse(value), response.status);
  }

  return parseReflectJobSnapshot(value);
};

/** unknownからReflectRaceJobSnapshotを検証して取り出す。 */
const parseReflectJobSnapshot = (value: unknown): ReflectRaceJobSnapshot => {
  if (!isRecord(value)) {
    throw new Error("レース振り返りジョブの状態を取得できませんでした。");
  }
  if (
    typeof value.id !== "string" ||
    !isReflectJobStatus(value.status) ||
    !Array.isArray(value.messages) ||
    !value.messages.every((message) => typeof message === "string") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.raceId !== "string"
  ) {
    throw new Error("レース振り返りジョブの状態を取得できませんでした。");
  }

  const snapshot: ReflectRaceJobSnapshot = {
    id: value.id,
    status: value.status,
    messages: value.messages,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    raceId: value.raceId
  };
  if (typeof value.error === "string") {
    snapshot.error = value.error;
  }

  return snapshot;
};

/** ジョブ状態が実行中かどうかを返す。 */
const isReflectJobActive = (job: ReflectRaceJobSnapshot): boolean => {
  return job.status === "queued" || job.status === "running";
};

/** unknownがReflectRaceJobStatusかどうかを判定する。 */
const isReflectJobStatus = (value: unknown): value is ReflectRaceJobSnapshot["status"] => {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed";
};

/** 同じタブで追跡中のレース振り返りジョブIDを保存するsessionStorageキーを作る。 */
const buildActiveReflectJobIdStorageKey = (raceId: string): string => {
  return `keiba-ai-assistant.activeReflectJobId.${raceId}`;
};

/** sessionStorageから同じタブで追跡していたレース振り返りジョブIDを読む。 */
const readStoredReflectJobId = (raceId: string): string | null => {
  try {
    const jobId = window.sessionStorage.getItem(buildActiveReflectJobIdStorageKey(raceId));
    if (jobId === null || jobId.length === 0) {
      return null;
    }

    return jobId;
  } catch {
    // sessionStorageが使えない環境でも、振り返りジョブ自体はサーバー側で進められる。
    return null;
  }
};

/** 同じタブのリロード後に復元できるよう、追跡中のレース振り返りジョブIDを保存する。 */
const saveStoredReflectJobId = (raceId: string, jobId: string): void => {
  try {
    window.sessionStorage.setItem(buildActiveReflectJobIdStorageKey(raceId), jobId);
  } catch {
    // sessionStorage保存に失敗しても、進捗復元だけを諦めればよい。
  }
};

/** 完了・失敗・404になったレース振り返りジョブIDをsessionStorageから消す。 */
const clearStoredReflectJobId = (raceId: string): void => {
  try {
    window.sessionStorage.removeItem(buildActiveReflectJobIdStorageKey(raceId));
  } catch {
    // sessionStorage削除に失敗しても、次回復元時にジョブAPIの結果で再判定する。
  }
};

/** ジョブAPIのHTTP statusを保持する内部Error。 */
interface ReflectJobRequestError extends Error {
  /** HTTP status code。 */
  status: number;
}

/** ジョブAPIのHTTPエラーをstatus付きErrorとして作る。 */
const createReflectJobRequestError = (message: string, status: number): ReflectJobRequestError => {
  const error = new Error(message) as ReflectJobRequestError;
  error.status = status;

  return error;
};

/** unknownがジョブAPIのHTTPエラーかどうかを判定する。 */
const isReflectJobRequestError = (error: unknown): error is ReflectJobRequestError => {
  return error instanceof Error && "status" in error && typeof error.status === "number";
};

/** ジョブAPIが404を返したかどうかを判定する。 */
const isReflectJobNotFoundError = (error: unknown): boolean => {
  return isReflectJobRequestError(error) && error.status === 404;
};

/** 完了または失敗したジョブからtoast表示を作る。 */
const buildReflectToast = (job: ReflectRaceJobSnapshot): ReflectRaceToast => {
  if (job.status === "succeeded") {
    return {
      kind: "success",
      message: "振り返りが完了しました。"
    };
  }

  return {
    kind: "error",
    message: job.error ?? "振り返りに失敗しました。"
  };
};

/** JSON error responseから表示用メッセージを取り出す。 */
const readErrorResponse = (value: unknown): string => {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  return "レース振り返りジョブの通信に失敗しました。";
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

  return "レース振り返りジョブの開始に失敗しました。";
};
