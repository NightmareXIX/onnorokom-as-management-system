"use client";

import { useCallback, useEffect, useState } from "react";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  AssignmentStatus,
  UserRole,
  type AdminUser,
  type Assignment,
  type ClassOption,
  type PagedResult,
  type SubjectOption,
} from "@/lib/types";

export default function AdminAssignmentsPage() {
  const [paged, setPaged] = useState<PagedResult<Assignment> | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | AssignmentStatus>("");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page, pageSize: 20 };
      if (statusFilter !== "") params.status = statusFilter;
      if (classFilter) params.classId = classFilter;
      if (subjectFilter) params.subjectId = subjectFilter;
      if (teacherFilter) params.teacherId = teacherFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const [assignmentsRes, classesRes, subjectsRes, usersRes] = await Promise.all([
        api.get<PagedResult<Assignment>>("/admin/assignments", { params }),
        api.get<ClassOption[]>("/classes"),
        api.get<SubjectOption[]>("/subjects"),
        api.get<AdminUser[]>("/admin/users"),
      ]);
      setPaged(assignmentsRes.data);
      setClasses(classesRes.data);
      setSubjects(subjectsRes.data);
      setTeachers(usersRes.data.filter((u) => u.role === UserRole.Teacher));
      setListError(null);
    } catch (e) {
      setListError(getApiErrorMessage(e, "Could not load assignments."));
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, classFilter, subjectFilter, teacherFilter, debouncedSearch]);

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
  }, [statusFilter, classFilter, subjectFilter, teacherFilter, debouncedSearch]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  const assignments = paged?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Assignments</h2>
        <p className="text-sm text-zinc-500">
          Every assignment in the system, any status, regardless of owning teacher.
        </p>
      </div>

      <FilterBar>
        <Select
          label="Status"
          wrapperClassName="w-40"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value === "" ? "" : (Number(e.target.value) as AssignmentStatus))
          }
        >
          <option value="">All statuses</option>
          <option value={AssignmentStatus.Published}>Published</option>
          <option value={AssignmentStatus.Draft}>Draft</option>
        </Select>
        <Select
          label="Class"
          wrapperClassName="w-44"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          label="Subject"
          wrapperClassName="w-44"
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
        <Select
          label="Teacher"
          wrapperClassName="w-44"
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
        >
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
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
      {!isLoading && listError && (
        <ErrorState message={listError} onRetry={handleRetry} isRetrying={isRetrying} />
      )}

      {!isLoading && !listError && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Title</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Class</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Subject</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Teacher</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Deadline</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Max Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 text-zinc-900">{a.title}</td>
                  <td className="px-3 py-2 text-zinc-600">{a.className}</td>
                  <td className="px-3 py-2 text-zinc-600">{a.subjectName}</td>
                  <td className="px-3 py-2 text-zinc-600">{a.teacherName}</td>
                  <td className="px-3 py-2">
                    <AssignmentStatusBadge status={a.status} />
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{formatDateTime(a.deadline)}</td>
                  <td className="px-3 py-2 text-zinc-600">{a.maxMarks}</td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-zinc-500">
                    No assignments match your filters.
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
