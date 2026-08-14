import type { ReactNode } from "react";

type AlertTone = "error" | "success" | "warning" | "info";

const TONE_CLASSES: Record<AlertTone, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

export function Alert({
  tone = "error",
  title,
  children,
  className = "",
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      // Errors and warnings interrupt; success/info are announced politely.
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${TONE_CLASSES[tone]} ${className}`}
    >
      {title && <p className="font-medium">{title}</p>}
      {children}
    </div>
  );
}
