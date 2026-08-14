import { AssignmentStatus, SubmissionStatus } from "./types";

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function assignmentStatusLabel(status: AssignmentStatus): string {
  return status === AssignmentStatus.Published ? "Published" : "Draft";
}

export function submissionStatusLabel(status: SubmissionStatus): string {
  switch (status) {
    case SubmissionStatus.Graded:
      return "Graded";
    case SubmissionStatus.ReturnedForRevision:
      return "Returned for revision";
    default:
      return "Submitted";
  }
}
