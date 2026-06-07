import type { LessonEntry } from "@keiba-ai-assistant/models";
import type { LessonRepository } from "@keiba-ai-assistant/web/server/repositories/lesson-repository";

/** Lesson採用入力。 */
export interface ApproveLessonInput {
  /** 採用するLesson ID。 */
  lessonId: string;
}

/** Lesson採用usecaseの依存関係。 */
export interface ApproveLessonDependencies {
  /** Lessonを保存・参照するrepository。 */
  lessonRepository: LessonRepository;
}

/** Lessonをapprovedへ更新するusecase。 */
export type ApproveLessonUseCase = (input: ApproveLessonInput) => Promise<LessonEntry>;

/** 依存関係を注入してLesson採用usecaseを作る。 */
export const createApproveLessonUseCase = (
  dependencies: ApproveLessonDependencies
): ApproveLessonUseCase => {
  return async (input) => {
    return await dependencies.lessonRepository.updateLessonStatus(input.lessonId, "approved");
  };
};
