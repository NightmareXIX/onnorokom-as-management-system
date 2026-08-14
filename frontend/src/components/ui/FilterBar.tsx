import type { ReactNode } from "react";

/** Layout wrapper only — each page composes its own Select/Input filter fields inside it. */
export function FilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-end gap-3 ${className}`}>{children}</div>;
}
