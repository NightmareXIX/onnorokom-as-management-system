"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Assignment } from "@/lib/types";

export default function StudentDashboardPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await api.get<Assignment[]>("/assignments");
        if (!cancelled) {
          setAssignments(response.data);
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
        title="Student Dashboard"
        navLinks={[{ href: "/student/submissions", label: "My Submissions" }]}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-zinc-900">Your Assignments</h2>
        {isLoading && <p className="text-sm text-zinc-500">Loading assignments…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!isLoading && !error && assignments.length === 0 && (
          <p className="text-sm text-zinc-500">No assignments for your class yet.</p>
        )}
        <div className="space-y-3">
          {assignments.map((a) => (
            <Link
              key={a.id}
              href={`/student/assignments/${a.id}`}
              className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-sm"
            >
              <h3 className="font-medium text-zinc-900">{a.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">
                {a.subjectName} · {a.teacherName} · Due {formatDateTime(a.deadline)} · {a.maxMarks}{" "}
                marks
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
