"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppHeader } from "@/components/AppHeader";
import { SubmissionAttachment } from "@/components/SubmissionAttachment";
import { useToast } from "@/components/ToastProvider";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge, Badge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FilterBar } from "@/components/ui/FilterBar";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  deadlineDistance,
  formatDateTime,
  isPastDeadline,
  toDateTimeLocalValue,
} from "@/lib/format";
import {
  buildGradeSchema,
  editAssignmentSchema,
  type EditAssignmentFormValues,
  type GradeFormValues,
} from "@/lib/schemas";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  AssignmentStatus,
  SubmissionStatus,
  type Assignment,
  type ClassOption,
  type PagedResult,
  type SubjectOption,
  type Submission,
} from "@/lib/types";

function EditAssignmentForm({
  assignment,
  classes,
  subjects,
  onSaved,
  onCancel,
}: {
  assignment: Assignment;
  classes: ClassOption[];
  subjects: SubjectOption[];
  onSaved: (updated: Assignment) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditAssignmentFormValues>({
    resolver: zodResolver(editAssignmentSchema),
    defaultValues: {
      title: assignment.title,
      description: assignment.description,
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      deadline: toDateTimeLocalValue(assignment.deadline),
      maxMarks: String(assignment.maxMarks),
      allowResubmission: assignment.allowResubmission,
    },
  });

  const onSubmit = async (values: EditAssignmentFormValues) => {
    setError(null);
    try {
      const response = await api.put<Assignment>(`/assignments/${assignment.id}`, {
        title: values.title,
        description: values.description,
        classId: values.classId,
        subjectId: values.subjectId,
        deadline: new Date(values.deadline).toISOString(),
        maxMarks: Number(values.maxMarks),
        allowResubmission: values.allowResubmission,
      });
      onSaved(response.data);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save the assignment."));
    }
  };

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-2"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <Input
        label="Title"
        wrapperClassName="sm:col-span-2"
        disabled={isSubmitting}
        error={errors.title?.message}
        {...register("title")}
      />
      <Textarea
        label="Description"
        rows={3}
        wrapperClassName="sm:col-span-2"
        disabled={isSubmitting}
        error={errors.description?.message}
        {...register("description")}
      />
      <Select
        label="Class"
        disabled={isSubmitting}
        error={errors.classId?.message}
        {...register("classId")}
      >
        <option value="">Select a class</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        label="Subject"
        disabled={isSubmitting}
        error={errors.subjectId?.message}
        {...register("subjectId")}
      >
        <option value="">Select a subject</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Input
        label="Deadline"
        type="datetime-local"
        disabled={isSubmitting}
        error={errors.deadline?.message}
        {...register("deadline")}
      />
      <Input
        label="Max Marks"
        type="number"
        min={1}
        max={1000}
        inputMode="numeric"
        disabled={isSubmitting}
        error={errors.maxMarks?.message}
        {...register("maxMarks")}
      />
      <Checkbox
        label="Allow resubmission"
        wrapperClassName="sm:col-span-2"
        disabled={isSubmitting}
        error={errors.allowResubmission?.message}
        {...register("allowResubmission")}
      />

      {error && (
        <Alert tone="error" className="sm:col-span-2">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
        <Button type="submit" isLoading={isSubmitting} loadingText="Saving…">
          Save changes
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function GradeForm({
  submission,
  maxMarks,
  onUpdated,
}: {
  submission: Submission;
  maxMarks: number;
  onUpdated: (updated: Submission) => void;
}) {
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const schema = useMemo(() => buildGradeSchema(maxMarks), [maxMarks]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GradeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      marks: submission.marks !== null ? String(submission.marks) : "",
      feedback: submission.feedback ?? "",
    },
  });

  const onSubmit = async (values: GradeFormValues) => {
    setError(null);
    try {
      const response = await api.put<Submission>(`/submissions/${submission.id}/grade`, {
        marks: Number(values.marks),
        feedback: values.feedback || null,
      });
      onUpdated(response.data);
      showToast(`Saved grade for ${submission.studentName}.`);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save the grade."));
    }
  };

  return (
    <form
      className="mt-3 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-[140px_1fr_auto] sm:items-start"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <Input
        label={`Marks (0–${maxMarks})`}
        type="number"
        min={0}
        max={maxMarks}
        inputMode="numeric"
        disabled={isSubmitting}
        error={errors.marks?.message}
        {...register("marks")}
      />
      <Input
        label="Feedback"
        placeholder="Optional feedback for the student"
        disabled={isSubmitting}
        error={errors.feedback?.message}
        {...register("feedback")}
      />
      <div className="sm:pt-6">
        <Button
          type="submit"
          className="w-full sm:w-auto"
          isLoading={isSubmitting}
          loadingText="Saving…"
        >
          {submission.status === SubmissionStatus.Graded ? "Update grade" : "Save grade"}
        </Button>
      </div>
      {error && (
        <Alert tone="error" className="sm:col-span-3">
          {error}
        </Alert>
      )}
    </form>
  );
}

function SubmissionCard({
  submission,
  maxMarks,
  onUpdated,
}: {
  submission: Submission;
  maxMarks: number;
  onUpdated: (updated: Submission) => void;
}) {
  const { showToast } = useToast();
  const [isReturning, setIsReturning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleReturnForRevision = async () => {
    setActionError(null);
    setIsReturning(true);
    try {
      const response = await api.patch<Submission>(`/submissions/${submission.id}/status`, {
        status: SubmissionStatus.ReturnedForRevision,
      });
      onUpdated(response.data);
      showToast(`Returned ${submission.studentName}'s submission for revision.`);
    } catch (e) {
      setActionError(getApiErrorMessage(e, "Could not update the submission status."));
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-zinc-900">{submission.studentName}</p>
        <SubmissionStatusBadge status={submission.status} />
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Submitted {formatDateTime(submission.submittedAt)}
        {submission.updatedAt && ` · Resubmitted ${formatDateTime(submission.updatedAt)}`}
      </p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-800">
        {submission.content}
      </p>
      {submission.fileName && (
        <SubmissionAttachment
          submissionId={submission.id}
          fileName={submission.fileName}
          fileSizeBytes={submission.fileSizeBytes}
        />
      )}

      <GradeForm submission={submission} maxMarks={maxMarks} onUpdated={onUpdated} />

      {submission.status !== SubmissionStatus.ReturnedForRevision && (
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReturnForRevision}
            isLoading={isReturning}
            loadingText="Returning…"
          >
            Return for revision
          </Button>
          <p className="mt-1 text-xs text-zinc-500">
            Flags the answer as needing changes. The student can only resubmit if the assignment
            allows it and the deadline has not passed.
          </p>
        </div>
      )}
      {actionError && (
        <Alert tone="error" className="mt-2">
          {actionError}
        </Alert>
      )}
    </div>
  );
}

export default function TeacherAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [pagedSubmissions, setPagedSubmissions] = useState<PagedResult<Submission> | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | SubmissionStatus>("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page, pageSize: 20 };
      if (statusFilter !== "") params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const [assignmentRes, submissionsRes, classesRes, subjectsRes] = await Promise.all([
        api.get<Assignment>(`/assignments/${id}`),
        api.get<PagedResult<Submission>>(`/assignments/${id}/submissions`, { params }),
        api.get<ClassOption[]>("/classes"),
        api.get<SubjectOption[]>("/subjects"),
      ]);
      setAssignment(assignmentRes.data);
      setPagedSubmissions(submissionsRes.data);
      setClasses(classesRes.data);
      setSubjects(subjectsRes.data);
      setLoadError(null);
    } catch (e) {
      setLoadError(getApiErrorMessage(e, "Could not load this assignment."));
    } finally {
      setIsLoading(false);
    }
  }, [id, page, statusFilter, debouncedSearch]);

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
  }, [statusFilter, debouncedSearch]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  const submissions = pagedSubmissions?.items ?? [];

  const handlePublish = async () => {
    setActionError(null);
    setIsPublishing(true);
    try {
      const response = await api.patch<Assignment>(`/assignments/${id}/publish`);
      setAssignment(response.data);
      showToast("Assignment published — students in the class can see it now.");
    } catch (e) {
      setActionError(getApiErrorMessage(e, "Could not publish the assignment."));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    setActionError(null);
    setIsDeleting(true);
    try {
      await api.delete(`/assignments/${id}`);
      showToast("Assignment deleted.");
      router.push("/teacher");
    } catch (e) {
      setActionError(getApiErrorMessage(e, "Could not delete the assignment."));
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  const handleSubmissionUpdated = (updated: Submission) => {
    setPagedSubmissions((prev) =>
      prev ? { ...prev, items: prev.items.map((s) => (s.id === updated.id ? updated : s)) } : prev
    );
  };

  const closed = assignment ? isPastDeadline(assignment.deadline) : false;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title="Assignment Submissions"
        navLinks={[{ href: "/teacher", label: "All Assignments" }]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <Link href="/teacher" className="text-sm text-zinc-500 hover:text-zinc-900">
          &larr; Back to assignments
        </Link>

        {isLoading && <LoadingState />}
        {!isLoading && loadError && (
          <ErrorState message={loadError} onRetry={handleRetry} isRetrying={isRetrying} />
        )}

        {assignment && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">{assignment.title}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <AssignmentStatusBadge status={assignment.status} />
                {closed && <Badge tone="red">Closed</Badge>}
                {assignment.allowResubmission && <Badge tone="blue">Resubmission allowed</Badge>}
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-600">
              {assignment.description}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {assignment.subjectName} · {assignment.className} · {assignment.maxMarks} marks
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Due {formatDateTime(assignment.deadline)} ({deadlineDistance(assignment.deadline)})
            </p>

            {!isEditing && (
              <div className="mt-4 flex flex-wrap gap-2">
                {assignment.status === AssignmentStatus.Draft && (
                  <Button
                    onClick={handlePublish}
                    isLoading={isPublishing}
                    loadingText="Publishing…"
                  >
                    Publish
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => setIsConfirmingDelete(true)}>
                  Delete
                </Button>
              </div>
            )}

            {actionError && (
              <Alert tone="error" className="mt-3">
                {actionError}
              </Alert>
            )}

            {isEditing && (
              <EditAssignmentForm
                assignment={assignment}
                classes={classes}
                subjects={subjects}
                onCancel={() => setIsEditing(false)}
                onSaved={(updated) => {
                  setAssignment(updated);
                  setIsEditing(false);
                  showToast("Assignment updated.");
                }}
              />
            )}
          </div>
        )}

        {!isLoading && !loadError && assignment && (
          <section>
            <h3 className="text-base font-semibold text-zinc-900">
              Submissions ({pagedSubmissions?.totalCount ?? 0})
            </h3>

            <FilterBar className="mt-3">
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
                placeholder="Search by student name…"
                wrapperClassName="w-56"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </FilterBar>

            <div className="mt-3 space-y-4">
              {submissions.length === 0 && (
                <EmptyState
                  title="No submissions found"
                  description={
                    assignment.status === AssignmentStatus.Draft
                      ? "This assignment is still a draft, so students cannot see it."
                      : "No submissions match your filters yet."
                  }
                />
              )}
              {submissions.map((s) => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  maxMarks={assignment.maxMarks}
                  onUpdated={handleSubmissionUpdated}
                />
              ))}
              {pagedSubmissions && (
                <Pagination
                  page={pagedSubmissions.page}
                  totalPages={pagedSubmissions.totalPages}
                  totalCount={pagedSubmissions.totalCount}
                  pageSize={pagedSubmissions.pageSize}
                  onPageChange={setPage}
                />
              )}
            </div>
          </section>
        )}
      </main>

      <ConfirmDialog
        open={isConfirmingDelete}
        title="Delete this assignment?"
        description="Its submissions and grades are deleted with it. This cannot be undone."
        confirmLabel="Delete"
        isBusy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </div>
  );
}
