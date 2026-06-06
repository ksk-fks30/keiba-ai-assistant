import { randomUUID } from "node:crypto";
import type { PredictRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/predict-race";

/** レース解析ジョブの状態。 */
export type PredictRaceJobStatus = "queued" | "running" | "succeeded" | "failed";

/** 画面へ返すレース解析ジョブの状態snapshot。 */
export interface PredictRaceJobSnapshot {
  /** ジョブID。 */
  id: string;
  /** 現在のジョブ状態。 */
  status: PredictRaceJobStatus;
  /** 固定コンソールに表示する進捗メッセージ。 */
  messages: string[];
  /** 作成日時。 */
  createdAt: string;
  /** 更新日時。 */
  updatedAt: string;
  /** 完了時に保存されたrace ID。 */
  raceId?: string;
  /** 失敗時のエラーメッセージ。 */
  error?: string;
}

/** レース解析ジョブ開始入力。 */
export interface StartPredictRaceJobInput {
  /** 解析対象の netKeiba レースURL。 */
  raceUrl: string;
}

/** レース解析ジョブをオンメモリで管理するstore。 */
export interface PredictRaceJobStore {
  /** レース解析ジョブを作成し、バックグラウンドで実行開始する。 */
  start: (input: StartPredictRaceJobInput) => PredictRaceJobSnapshot;
  /** 指定IDのジョブ状態を返す。存在しない場合はnull。 */
  findById: (jobId: string) => PredictRaceJobSnapshot | null;
  /** 指定IDの実行中ジョブを中止し、次のジョブを開始できる状態にする。 */
  abort: (jobId: string) => PredictRaceJobSnapshot | null;
}

/** 実行中ジョブがあるため新規ジョブを開始できないことを表すError。 */
export interface PredictRaceJobAlreadyRunningError extends Error {
  /** 実行中のジョブsnapshot。 */
  activeJob: PredictRaceJobSnapshot;
}

/** レース解析ジョブstoreの依存関係。 */
export interface CreatePredictRaceJobStoreDependencies {
  /** 実際のレース取得とAI分析を行うusecase。 */
  predictRaceUseCase: PredictRaceUseCase;
  /** ジョブID生成関数。テストで固定する。 */
  createJobId?: (() => string) | undefined;
  /** 現在日時を返す関数。テストで固定する。 */
  now?: (() => Date) | undefined;
  /** 保持する進捗メッセージの最大件数。 */
  maxMessages?: number | undefined;
}

interface PredictRaceJobRecord {
  id: string;
  status: PredictRaceJobStatus;
  messages: string[];
  createdAt: string;
  updatedAt: string;
  abortController: AbortController;
  raceId?: string;
  error?: string;
}

const defaultMaxMessages = 200;

/** unknownが実行中ジョブによる開始拒否Errorかどうかを判定する。 */
export const isPredictRaceJobAlreadyRunningError = (
  error: unknown
): error is PredictRaceJobAlreadyRunningError => {
  return (
    error instanceof Error && "activeJob" in error && isPredictRaceJobSnapshot(error.activeJob)
  );
};

/** オンメモリのレース解析ジョブstoreを作る。 */
export const createPredictRaceJobStore = (
  dependencies: CreatePredictRaceJobStoreDependencies
): PredictRaceJobStore => {
  const jobs = new Map<string, PredictRaceJobRecord>();
  const runningJobPromises = new Map<string, Promise<void>>();
  const createJobId = dependencies.createJobId ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  const maxMessages = dependencies.maxMessages ?? defaultMaxMessages;

  return {
    start: (input) => {
      const activeJob = findActiveJob(jobs);
      if (activeJob !== null) {
        throw createPredictRaceJobAlreadyRunningError(toSnapshot(activeJob));
      }

      const timestamp = now().toISOString();
      const job: PredictRaceJobRecord = {
        id: createJobId(),
        status: "queued",
        messages: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        abortController: new AbortController()
      };
      jobs.set(job.id, job);
      appendMessage(job, "レース解析ジョブを作成しました。", now, maxMessages);

      const runningJobPromise = runJob({
        job,
        input,
        predictRaceUseCase: dependencies.predictRaceUseCase,
        now,
        maxMessages
      }).finally(() => {
        runningJobPromises.delete(job.id);
      });
      runningJobPromises.set(job.id, runningJobPromise);

      return toSnapshot(job);
    },
    findById: (jobId) => {
      const job = jobs.get(jobId);
      if (job === undefined) {
        return null;
      }

      return toSnapshot(job);
    },
    abort: (jobId) => {
      const job = jobs.get(jobId);
      if (job === undefined) {
        return null;
      }
      if (!isPredictRaceJobActive(job)) {
        return toSnapshot(job);
      }

      job.abortController.abort();
      job.error = "レース解析ジョブを中止しました。";
      updateJobStatus(job, "failed", now);
      appendMessage(job, "レース解析ジョブを中止しました。", now, maxMessages);

      return toSnapshot(job);
    }
  };
};

/** 実行中または開始待ちのジョブを探す。 */
const findActiveJob = (jobs: Map<string, PredictRaceJobRecord>): PredictRaceJobRecord | null => {
  for (const job of jobs.values()) {
    if (isPredictRaceJobActive(job)) {
      return job;
    }
  }

  return null;
};

const runJob = async (input: {
  job: PredictRaceJobRecord;
  input: StartPredictRaceJobInput;
  predictRaceUseCase: PredictRaceUseCase;
  now: () => Date;
  maxMessages: number;
}): Promise<void> => {
  updateJobStatus(input.job, "running", input.now);
  appendMessage(input.job, "レース解析を開始しています。", input.now, input.maxMessages);

  try {
    const result = await input.predictRaceUseCase({
      raceUrl: input.input.raceUrl,
      signal: input.job.abortController.signal,
      onProgress: (message) => {
        if (!isPredictRaceJobActive(input.job)) {
          return;
        }

        appendMessage(input.job, message, input.now, input.maxMessages);
      }
    });
    if (!isPredictRaceJobActive(input.job)) {
      return;
    }

    input.job.raceId = result.raceId;
    updateJobStatus(input.job, "succeeded", input.now);
    appendMessage(
      input.job,
      `レース解析が完了しました: ${result.raceId}`,
      input.now,
      input.maxMessages
    );
  } catch (error) {
    if (!isPredictRaceJobActive(input.job)) {
      return;
    }

    const message = readErrorMessage(error);
    input.job.error = message;
    updateJobStatus(input.job, "failed", input.now);
    appendMessage(input.job, `レース解析に失敗しました: ${message}`, input.now, input.maxMessages);
  }
};

/** ジョブ状態が新規開始を止めるべき実行中状態かどうかを返す。 */
const isPredictRaceJobActive = (job: Pick<PredictRaceJobRecord, "status">): boolean => {
  return job.status === "queued" || job.status === "running";
};

/** ジョブ状態を更新し、更新日時も同時に進める。 */
const updateJobStatus = (
  job: PredictRaceJobRecord,
  status: PredictRaceJobStatus,
  now: () => Date
): void => {
  job.status = status;
  job.updatedAt = now().toISOString();
};

/** ジョブの進捗メッセージを追加し、固定件数を超えた古いメッセージを捨てる。 */
const appendMessage = (
  job: PredictRaceJobRecord,
  message: string,
  now: () => Date,
  maxMessages: number
): void => {
  job.messages.push(message);
  if (job.messages.length > maxMessages) {
    job.messages.splice(0, job.messages.length - maxMessages);
  }
  job.updatedAt = now().toISOString();
};

/** 内部recordを外部返却用snapshotへ変換する。 */
const toSnapshot = (job: PredictRaceJobRecord): PredictRaceJobSnapshot => {
  const snapshot: PredictRaceJobSnapshot = {
    id: job.id,
    status: job.status,
    messages: [...job.messages],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };

  if (job.raceId !== undefined) {
    snapshot.raceId = job.raceId;
  }
  if (job.error !== undefined) {
    snapshot.error = job.error;
  }

  return snapshot;
};

/** 実行中ジョブがあるため新規ジョブを開始できないErrorを作る。 */
const createPredictRaceJobAlreadyRunningError = (
  activeJob: PredictRaceJobSnapshot
): PredictRaceJobAlreadyRunningError => {
  const error = new Error(
    "別のレース解析ジョブが実行中です。"
  ) as PredictRaceJobAlreadyRunningError;
  error.activeJob = activeJob;

  return error;
};

/** unknownがPredictRaceJobSnapshotとして扱えるかを判定する。 */
const isPredictRaceJobSnapshot = (value: unknown): value is PredictRaceJobSnapshot => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return (
    "id" in value &&
    typeof value.id === "string" &&
    "status" in value &&
    (value.status === "queued" ||
      value.status === "running" ||
      value.status === "succeeded" ||
      value.status === "failed") &&
    "messages" in value &&
    Array.isArray(value.messages) &&
    value.messages.every((message) => typeof message === "string") &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "updatedAt" in value &&
    typeof value.updatedAt === "string"
  );
};

/** unknown の例外値から表示用メッセージを取り出す。 */
const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "レース解析の実行に失敗しました。";
};
