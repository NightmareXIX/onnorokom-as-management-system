"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Badge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { deadlineDistance, formatDateTime, isPastDeadline } from "@/lib/format";
import type { Assignment, Submission } from "@/lib/types";

export default function StudentDashboardPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissionsByAssignment, setSubmissionsByAssignment] = useState<
    Record<string, Submission>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [assignmentsRes, submissionsRes] = await Promise.all([
        api.get<Assignment[]>("/assignments"),
        api.get<Submission[]>("/submissions/me"),
      ]);
      setAssignments(assignmentsRes.data);
      setSubmissionsByAssignment(
        Object.fromEntries(submissionsRes.data.map((s) => [s.assignmentId, s]))
      );
      setError(null);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load your assignments."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // load is also reused by retry; its setState calls only run after the awaited
    // requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title="Student Dashboard"
        navLinks={[{ href: "/student/submissions", label: "My Submissions" }]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-zinc-900">Your Assignments</h2>
        {isLoading && <LoadingState label="Loading assignments…" />}
        {!isLoading && error && (
          <ErrorState message={error} onRetry={handleRetry} isRetrying={isRetrying} />
        )}
        {!isLoading && !error && assignments.length === 0 && (
          <EmptyState
            title="Nothing to do yet"
            description="No published assignments for your class right now."
          />
        )}
        <div className="space-y-3">
          {!error &&
            assignments.map((a) => {
              const submission = submissionsByAssignment[a.id];
              const closed = isPastDeadline(a.deadline);
              return (
                <Link
                  key={a.id}
                  href={`/student/assignments/${a.id}`}
                  className="block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-zinc-900">{a.title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {submission ? (
                        <SubmissionStatusBadge status={submission.status} />
                      ) : closed ? (
                        <Badge tone="red">Missed</Badge>
                      ) : (
                        <Badge tone="amber">Not submitted</Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {a.subjectName} · {a.teacherName} · {a.maxMarks} marks
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    Due {formatDateTime(a.deadline)} ({deadlineDistance(a.deadline)})
                  </p>
                </Link>
              );
            })}
        </div>
      </main>
    </div>
  );
}
