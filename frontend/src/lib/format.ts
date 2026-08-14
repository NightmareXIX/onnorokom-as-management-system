import { AssignmentStatus, SubmissionStatus, UserRole } from "./types";

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Value for an `<input type="datetime-local">`, in the viewer's local timezone. */
export function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function isPastDeadline(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

/** "in 3 days" / "in 5 hours" / "2 days ago" — only rendered from fetched data. */
export function deadlineDistance(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const past = diffMs < 0;
  const minutes = Math.round(Math.abs(diffMs) / 60000);

  let value: string;
  if (minutes < 60) {
    value = `${Math.max(minutes, 1)} minute${minutes === 1 ? "" : "s"}`;
  } else if (minutes < 60 * 24) {
    const hours = Math.round(minutes / 60);
    value = `${hours} hour${hours === 1 ? "" : "s"}`;
  } else {
    const days = Math.round(minutes / (60 * 24));
    value = `${days} day${days === 1 ? "" : "s"}`;
  }

  return past ? `${value} ago` : `in ${value}`;
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

export function userRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.Admin:
      return "Admin";
    case UserRole.Teacher:
      return "Teacher";
    default:
      return "Student";
  }
}
