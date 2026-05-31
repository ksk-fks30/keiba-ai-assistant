import type { PropsWithChildren } from "react";

export const AppLayout = ({ children }: PropsWithChildren) => {
  return <div className="app-layout">{children}</div>;
};
