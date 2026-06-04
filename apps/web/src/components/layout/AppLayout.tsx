import type { PropsWithChildren } from "react";

/** Web画面全体の背景と基本文字色を揃えるlayout。 */
export const AppLayout = ({ children }: PropsWithChildren) => {
  return <div className="min-h-screen bg-app-bg text-app-text">{children}</div>;
};
