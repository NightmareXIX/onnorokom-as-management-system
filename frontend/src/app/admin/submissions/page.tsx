"use client";

import { useCallback, useEffect, useState } from "react";
import { SubmissionStatusBadge } from "@/components/ui/Badge";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  SubmissionStatus,
  UserRole,
  type AdminUser,
  type Assignment,
  type PagedResult,
  type Submission,
} from "@/lib/types";

export default function AdminSubmissionsPage() {
  const [paged, setPaged] = useState<PagedResult<Submission> | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | SubmissionStatus>("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page, pageSize: 20 };
      if (statusFilter !== "") params.status = statusFilter;
      if (assignmentFilter) params.assignmentId = assignmentFilter;
      if (studentFilter) params.studentId = studentFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const [submissionsRes, assignmentsRes, usersRes] = await Promise.all([
        api.get<PagedResult<Submission>>("/admin/submissions", { params }),
        api.get<PagedResult<Assignment>>("/admin/assignments", { params: { pageSize: 100 } }),
        api.get<AdminUser[]>("/admin/users"),
      ]);
      setPaged(submissionsRes.data);
      setAssignments(assignmentsRes.data.items);
      setStudents(usersRes.data.filter((u) => u.role === UserRole.Student));
      setListError(null);
    } catch (e) {
      setListError(getApiErrorMessage(e, "Could not load submissions."));
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, assignmentFilter, studentFilter, debouncedSearch]);

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
  }, [statusFilter, assignmentFilter, studentFilter, debouncedSearch]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  const submissions = paged?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Submissions</h2>
        <p className="text-sm text-zinc-500">
          Every submission in the system, regardless of owning teacher.
        </p>
      </div>

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
        <Select
          label="Assignment"
          wrapperClassName="w-56"
          value={assignmentFilter}
          onChange={(e) => setAssignmentFilter(e.target.value)}
        >
          <option value="">All assignments</option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </Select>
        <Select
          label="Student"
          wrapperClassName="w-48"
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value)}
        >
          <option value="">All students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </Select>
        <Input
          label="Search"
          placeholder="Search by student or assignment…"
          wrapperClassName="w-56"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </FilterBar>

      {isLoading && <LoadingState label="Loading submissions…" />}
      {!isLoading && listError && (
        <ErrorState message={listError} onRetry={handleRetry} isRetrying={isRetrying} />
      )}

      {!isLoading && !listError && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Assignment</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Student</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Marks</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Submitted At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 text-zinc-900">{s.assignmentTitle}</td>
                  <td className="px-3 py-2 text-zinc-600">{s.studentName}</td>
                  <td className="px-3 py-2">
                    <SubmissionStatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{s.marks ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-600">{formatDateTime(s.submittedAt)}</td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-zinc-500">
                    No submissions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !listError && paged && (
        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          totalCount={paged.totalCount}
          pageSize={paged.pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
