"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateTime, submissionStatusLabel } from "@/lib/format";
import type { Submission } from "@/lib/types";

export default function StudentSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await api.get<Submission[]>("/submissions/me");
        if (!cancelled) {
          setSubmissions(response.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(getApiErrorMessage(e));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title="My Submissions"
        navLinks={[{ href: "/student", label: "All Assignments" }]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        {isLoading && <p className="text-sm text-zinc-500">Loading submissions…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!isLoading && !error && submissions.length === 0 && (
          <p className="text-sm text-zinc-500">You haven&apos;t submitted anything yet.</p>
        )}
        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-zinc-900">{s.assignmentTitle}</h3>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {submissionStatusLabel(s.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Submitted {formatDateTime(s.submittedAt)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{s.content}</p>
              {s.marks !== null && (
                <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm">
                  <p className="font-medium text-zinc-900">Marks: {s.marks}</p>
                  {s.feedback && <p className="mt-1 text-zinc-700">{s.feedback}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
