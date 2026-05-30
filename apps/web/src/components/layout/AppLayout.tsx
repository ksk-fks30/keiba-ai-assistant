import type { PropsWithChildren } from "react";

export function AppLayout({ children }: PropsWithChildren) {
  return <div className="app-layout">{children}</div>;
}
