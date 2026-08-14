"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Badge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { deadlineDistance, formatDateTime, isPastDeadline } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Assignment, PagedResult, SubjectOption, Submission } from "@/lib/types";

export default function StudentDashboardPage() {
  const [paged, setPaged] = useState<PagedResult<Assignment> | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [submissionsByAssignment, setSubmissionsByAssignment] = useState<
    Record<string, Submission>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page, pageSize: 20 };
      if (subjectFilter) params.subjectId = subjectFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const [assignmentsRes, submissionsRes, subjectsRes] = await Promise.all([
        api.get<PagedResult<Assignment>>("/assignments", { params }),
        // pageSize:100 (the backend max) so this join map covers every submission this
        // student has, not just the first paginated page — a student realistically
        // won't exceed 100 submissions in this system's scope.
        api.get<PagedResult<Submission>>("/submissions/me", { params: { pageSize: 100 } }),
        api.get<SubjectOption[]>("/subjects"),
      ]);
      setPaged(assignmentsRes.data);
      setSubmissionsByAssignment(
        Object.fromEntries(submissionsRes.data.items.map((s) => [s.assignmentId, s]))
      );
      setSubjects(subjectsRes.data);
      setError(null);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load your assignments."));
    } finally {
      setIsLoading(false);
    }
  }, [page, subjectFilter, debouncedSearch]);

  useEffect(() => {
    // load is also reused by retry; its setState calls only run after the awaited
    // requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    // Filters changing should always jump back to page 1 so narrowing results doesn't
    // strand the user off the end — a synchronous reset, not a derived-from-fetch update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [subjectFilter, debouncedSearch]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  const assignments = paged?.items ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title="Student Dashboard"
        navLinks={[{ href: "/student/submissions", label: "My Submissions" }]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-zinc-900">Your Assignments</h2>

        <FilterBar>
          <Select
            label="Subject"
            wrapperClassName="w-48"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            label="Search"
            placeholder="Search by title…"
            wrapperClassName="w-56"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </FilterBar>

        {isLoading && <LoadingState label="Loading assignments…" />}
        {!isLoading && error && (
          <ErrorState message={error} onRetry={handleRetry} isRetrying={isRetrying} />
        )}
        {!isLoading && !error && assignments.length === 0 && (
          <EmptyState
            title="Nothing to do yet"
            description="No published assignments match your filters right now."
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
          {!isLoading && !error && paged && (
            <Pagination
              page={paged.page}
              totalPages={paged.totalPages}
              totalCount={paged.totalCount}
              pageSize={paged.pageSize}
              onPageChange={setPage}
            />
          )}
        </div>
      </main>
    </div>
  );
}
