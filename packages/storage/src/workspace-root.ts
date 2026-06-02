import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const workspaceMarkerFileName = "pnpm-workspace.yaml" as const;

/** 現在位置から上位へ辿り、pnpm workspace root を探す。 */
export const findWorkspaceRoot = (startDir: string = process.cwd()): string => {
  let currentDir = startDir;

  while (true) {
    if (existsSync(join(currentDir, workspaceMarkerFileName))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return startDir;
    }

    currentDir = parentDir;
  }
};

/** pnpm workspace root からの絶対パスを返す。 */
export const getWorkspacePath = (...pathSegments: string[]): string => {
  return join(findWorkspaceRoot(), ...pathSegments);
};
