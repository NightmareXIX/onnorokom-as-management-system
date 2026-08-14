import type { ReactNode } from "react";
import { assignmentStatusLabel, submissionStatusLabel } from "@/lib/format";
import { AssignmentStatus, SubmissionStatus } from "@/lib/types";

type BadgeTone = "neutral" | "green" | "amber" | "blue" | "red";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  red: "bg-red-100 text-red-800",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <Badge tone={status === AssignmentStatus.Published ? "green" : "amber"}>
      {assignmentStatusLabel(status)}
    </Badge>
  );
}

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const tone: BadgeTone =
    status === SubmissionStatus.Graded
      ? "green"
      : status === SubmissionStatus.ReturnedForRevision
        ? "amber"
        : "blue";
  return <Badge tone={tone}>{submissionStatusLabel(status)}</Badge>;
}
