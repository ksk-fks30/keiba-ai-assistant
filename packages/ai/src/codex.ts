export interface CodexSdkRuntime {
  model?: string;
}

export const createCodexSdkRuntime = (options: CodexSdkRuntime = {}): CodexSdkRuntime => {
  return options;
};
