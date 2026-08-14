"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SubmissionStatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Submission } from "@/lib/types";

export default function StudentSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get<Submission[]>("/submissions/me");
      setSubmissions(response.data);
      setError(null);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load your submissions."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // load is also reused by retry; its setState calls only run after the awaited
    // request settles.
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
        title="My Submissions"
        navLinks={[{ href: "/student", label: "All Assignments" }]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        {isLoading && <LoadingState label="Loading submissions…" />}
        {!isLoading && error && (
          <ErrorState message={error} onRetry={handleRetry} isRetrying={isRetrying} />
        )}
        {!isLoading && !error && submissions.length === 0 && (
          <EmptyState
            title="No submissions yet"
            description="Answers you submit will show up here with their marks and feedback."
          />
        )}
        <div className="space-y-3">
          {!error &&
            submissions.map((s) => (
              <div key={s.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-zinc-900">
                    <Link
                      href={`/student/assignments/${s.assignmentId}`}
                      className="hover:underline"
                    >
                      {s.assignmentTitle}
                    </Link>
                  </h3>
                  <SubmissionStatusBadge status={s.status} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Submitted {formatDateTime(s.submittedAt)}
                  {s.updatedAt && ` · Updated ${formatDateTime(s.updatedAt)}`}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-800">
                  {s.content}
                </p>
                {s.marks !== null && (
                  <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm">
                    <p className="font-medium text-zinc-900">Marks: {s.marks}</p>
                    {s.feedback && (
                      <p className="mt-1 whitespace-pre-wrap text-zinc-700">{s.feedback}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
