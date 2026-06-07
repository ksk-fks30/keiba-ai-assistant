import { randomUUID } from "node:crypto";
import type { ReflectRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/reflect-race";

/** レース振り返りジョブの状態。 */
export type ReflectRaceJobStatus = "queued" | "running" | "succeeded" | "failed";

/** 画面へ返すレース振り返りジョブの状態snapshot。 */
export interface ReflectRaceJobSnapshot {
  /** ジョブID。 */
  id: string;
  /** 現在のジョブ状態。 */
  status: ReflectRaceJobStatus;
  /** 進捗メッセージ。 */
  messages: string[];
  /** 作成日時。 */
  createdAt: string;
  /** 更新日時。 */
  updatedAt: string;
  /** 対象race ID。 */
  raceId: string;
  /** 失敗時のエラーメッセージ。 */
  error?: string;
}

/** レース振り返りジョブ開始入力。 */
export interface StartReflectRaceJobInput {
  /** 対象race ID。 */
  raceId: string;
}

/** レース振り返りジョブをオンメモリで管理するstore。 */
export interface ReflectRaceJobStore {
  /** レース振り返りジョブを作成し、バックグラウンドで実行開始する。 */
  start: (input: StartReflectRaceJobInput) => ReflectRaceJobSnapshot;
  /** 指定IDのジョブ状態を返す。存在しない場合はnull。 */
  findById: (jobId: string) => ReflectRaceJobSnapshot | null;
}

/** 実行中ジョブがあるため新規ジョブを開始できないことを表すError。 */
export interface ReflectRaceJobAlreadyRunningError extends Error {
  /** 実行中のジョブsnapshot。 */
  activeJob: ReflectRaceJobSnapshot;
}

/** レース振り返りジョブstoreの依存関係。 */
export interface CreateReflectRaceJobStoreDependencies {
  /** 実際の結果取得とAI振り返りを行うusecase。 */
  reflectRaceUseCase: ReflectRaceUseCase;
  /** ジョブID生成関数。テストで固定する。 */
  createJobId?: (() => string) | undefined;
  /** 現在日時を返す関数。テストで固定する。 */
  now?: (() => Date) | undefined;
  /** 保持する進捗メッセージの最大件数。 */
  maxMessages?: number | undefined;
}

interface ReflectRaceJobRecord {
  id: string;
  status: ReflectRaceJobStatus;
  messages: string[];
  createdAt: string;
  updatedAt: string;
  raceId: string;
  abortController: AbortController;
  error?: string;
}

const defaultMaxMessages = 200;

/** unknownが実行中ジョブによる開始拒否Errorかどうかを判定する。 */
export const isReflectRaceJobAlreadyRunningError = (
  error: unknown
): error is ReflectRaceJobAlreadyRunningError => {
  return (
    error instanceof Error && "activeJob" in error && isReflectRaceJobSnapshot(error.activeJob)
  );
};

/** オンメモリのレース振り返りジョブstoreを作る。 */
export const createReflectRaceJobStore = (
  dependencies: CreateReflectRaceJobStoreDependencies
): ReflectRaceJobStore => {
  const jobs = new Map<string, ReflectRaceJobRecord>();
  const runningJobPromises = new Map<string, Promise<void>>();
  const createJobId = dependencies.createJobId ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  const maxMessages = dependencies.maxMessages ?? defaultMaxMessages;

  return {
    start: (input) => {
      const activeJob = findActiveJob(jobs);
      if (activeJob !== null) {
        throw createReflectRaceJobAlreadyRunningError(toSnapshot(activeJob));
      }

      const timestamp = now().toISOString();
      const job: ReflectRaceJobRecord = {
        id: createJobId(),
        status: "queued",
        messages: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        raceId: input.raceId,
        abortController: new AbortController()
      };
      jobs.set(job.id, job);
      appendMessage(job, "レース振り返りジョブを作成しました。", now, maxMessages);

      const runningJobPromise = runJob({
        job,
        reflectRaceUseCase: dependencies.reflectRaceUseCase,
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
    }
  };
};

/** 実行中または開始待ちのジョブを探す。 */
const findActiveJob = (jobs: Map<string, ReflectRaceJobRecord>): ReflectRaceJobRecord | null => {
  for (const job of jobs.values()) {
    if (isReflectRaceJobActive(job)) {
      return job;
    }
  }

  return null;
};

const runJob = async (input: {
  job: ReflectRaceJobRecord;
  reflectRaceUseCase: ReflectRaceUseCase;
  now: () => Date;
  maxMessages: number;
}): Promise<void> => {
  updateJobStatus(input.job, "running", input.now);
  appendMessage(
    input.job,
    "レース結果の取得と振り返りを開始しています。",
    input.now,
    input.maxMessages
  );

  try {
    const result = await input.reflectRaceUseCase({
      raceId: input.job.raceId,
      signal: input.job.abortController.signal,
      onProgress: (message) => {
        if (!isReflectRaceJobActive(input.job) || input.job.abortController.signal.aborted) {
          return;
        }

        appendMessage(input.job, message, input.now, input.maxMessages);
      }
    });
    if (!isReflectRaceJobActive(input.job)) {
      return;
    }

    input.job.raceId = result.raceId;
    updateJobStatus(input.job, "succeeded", input.now);
    appendMessage(
      input.job,
      `レース振り返りが完了しました: ${result.raceId}`,
      input.now,
      input.maxMessages
    );
  } catch (error) {
    if (!isReflectRaceJobActive(input.job)) {
      return;
    }

    const message = readErrorMessage(error);
    input.job.error = message;
    updateJobStatus(input.job, "failed", input.now);
    appendMessage(
      input.job,
      `レース振り返りに失敗しました: ${message}`,
      input.now,
      input.maxMessages
    );
  }
};

/** ジョブ状態が新規開始を止めるべき実行中状態かどうかを返す。 */
const isReflectRaceJobActive = (job: Pick<ReflectRaceJobRecord, "status">): boolean => {
  return job.status === "queued" || job.status === "running";
};

/** ジョブ状態を更新し、更新日時も同時に進める。 */
const updateJobStatus = (
  job: ReflectRaceJobRecord,
  status: ReflectRaceJobStatus,
  now: () => Date
): void => {
  job.status = status;
  job.updatedAt = now().toISOString();
};

/** ジョブの進捗メッセージを追加し、固定件数を超えた古いメッセージを捨てる。 */
const appendMessage = (
  job: ReflectRaceJobRecord,
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
const toSnapshot = (job: ReflectRaceJobRecord): ReflectRaceJobSnapshot => {
  const snapshot: ReflectRaceJobSnapshot = {
    id: job.id,
    status: job.status,
    messages: [...job.messages],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    raceId: job.raceId
  };

  if (job.error !== undefined) {
    snapshot.error = job.error;
  }

  return snapshot;
};

/** 実行中ジョブがあるため新規ジョブを開始できないErrorを作る。 */
const createReflectRaceJobAlreadyRunningError = (
  activeJob: ReflectRaceJobSnapshot
): ReflectRaceJobAlreadyRunningError => {
  const error = new Error(
    "別のレース振り返りジョブが実行中です。"
  ) as ReflectRaceJobAlreadyRunningError;
  error.activeJob = activeJob;

  return error;
};

/** unknownがReflectRaceJobSnapshotとして扱えるかを判定する。 */
const isReflectRaceJobSnapshot = (value: unknown): value is ReflectRaceJobSnapshot => {
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
    typeof value.updatedAt === "string" &&
    "raceId" in value &&
    typeof value.raceId === "string"
  );
};

/** unknown の例外値から表示用メッセージを取り出す。 */
const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "レース振り返りの実行に失敗しました。";
};
