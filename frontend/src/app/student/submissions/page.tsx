"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SubmissionStatusBadge } from "@/components/ui/Badge";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { SubmissionStatus, type PagedResult, type Submission } from "@/lib/types";

export default function StudentSubmissionsPage() {
  const [paged, setPaged] = useState<PagedResult<Submission> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | SubmissionStatus>("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page, pageSize: 20 };
      if (statusFilter !== "") params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const response = await api.get<PagedResult<Submission>>("/submissions/me", { params });
      setPaged(response.data);
      setError(null);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load your submissions."));
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => {
    // load is also reused by retry; its setState calls only run after the awaited
    // request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    // Filters changing should always jump back to page 1 so narrowing results doesn't
    // strand the user off the end — a synchronous reset, not a derived-from-fetch update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  const submissions = paged?.items ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title="My Submissions"
        navLinks={[{ href: "/student", label: "All Assignments" }]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        <FilterBar>
          <Select
            label="Status"
            wrapperClassName="w-48"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value === "" ? "" : (Number(e.target.value) as SubmissionStatus)
              )
            }
          >
            <option value="">All statuses</option>
            <option value={SubmissionStatus.Submitted}>Submitted</option>
            <option value={SubmissionStatus.Graded}>Graded</option>
            <option value={SubmissionStatus.ReturnedForRevision}>Returned for revision</option>
          </Select>
          <Input
            label="Search"
            placeholder="Search by assignment title…"
            wrapperClassName="w-56"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </FilterBar>

        {isLoading && <LoadingState label="Loading submissions…" />}
        {!isLoading && error && (
          <ErrorState message={error} onRetry={handleRetry} isRetrying={isRetrying} />
        )}
        {!isLoading && !error && submissions.length === 0 && (
          <EmptyState
            title="No submissions found"
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
