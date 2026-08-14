"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppHeader } from "@/components/AppHeader";
import { SubmissionAttachment } from "@/components/SubmissionAttachment";
import { useToast } from "@/components/ToastProvider";
import { Alert } from "@/components/ui/Alert";
import { Badge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FileInput } from "@/components/ui/FileInput";
import { Textarea } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { deadlineDistance, formatDateTime, isPastDeadline } from "@/lib/format";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  submissionSchema,
  validateSubmissionFile,
  type SubmissionFormValues,
} from "@/lib/schemas";
import type { Assignment, PagedResult, Submission } from "@/lib/types";

function AnswerForm({
  defaultContent,
  existingFileName,
  submitLabel,
  loadingLabel,
  onSave,
  onCancel,
}: {
  defaultContent: string;
  existingFileName?: string | null;
  submitLabel: string;
  loadingLabel: string;
  onSave: (content: string, file: File | null) => Promise<void>;
  onCancel?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubmissionFormValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { content: defaultContent },
  });

  const handleFileChange = (selected: File | null) => {
    if (selected) {
      const validationError = validateSubmissionFile(selected);
      if (validationError) {
        setFileError(validationError);
        setFile(null);
        return;
      }
    }
    setFileError(null);
    setFile(selected);
  };

  const onSubmit = async (values: SubmissionFormValues) => {
    setError(null);
    try {
      await onSave(values.content, file);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save your answer."));
    }
  };

  return (
    <form className="mt-3 space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Textarea
        rows={8}
        placeholder="Write your answer here…"
        aria-label="Your answer"
        disabled={isSubmitting}
        error={errors.content?.message}
        {...register("content")}
      />
      <FileInput
        label="Attach a file (optional)"
        hint={
          existingFileName
            ? `Choosing a new file replaces the current attachment (${existingFileName}).`
            : `Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")} — up to 10 MB.`
        }
        accept={ALLOWED_UPLOAD_EXTENSIONS.join(",")}
        disabled={isSubmitting}
        error={fileError ?? undefined}
        selectedFileName={file?.name}
        onFileChange={handleFileChange}
      />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" isLoading={isSubmitting} loadingText={loadingLabel}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function buildSubmissionFormData(content: string, file: File | null): FormData {
  const formData = new FormData();
  formData.append("Content", content);
  if (file) {
    formData.append("File", file);
  }
  return formData;
}

export default function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { showToast } = useToast();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [assignmentRes, submissionsRes] = await Promise.all([
        api.get<Assignment>(`/assignments/${id}`),
        api.get<PagedResult<Submission>>("/submissions/me", { params: { assignmentId: id } }),
      ]);
      setAssignment(assignmentRes.data);
      setSubmission(submissionsRes.data.items[0] ?? null);
      setLoadError(null);
    } catch (e) {
      setLoadError(getApiErrorMessage(e, "Could not load this assignment."));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

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

  const handleCreate = async (content: string, file: File | null) => {
    const response = await api.post<Submission>(
      `/assignments/${id}/submissions`,
      buildSubmissionFormData(content, file)
    );
    setSubmission(response.data);
    showToast("Answer submitted.");
  };

  const handleUpdate = async (content: string, file: File | null) => {
    if (!submission) {
      return;
    }
    const response = await api.put<Submission>(
      `/submissions/${submission.id}`,
      buildSubmissionFormData(content, file)
    );
    setSubmission(response.data);
    setIsEditing(false);
    showToast("Answer updated.");
  };

  const closed = assignment ? isPastDeadline(assignment.deadline) : false;
  const canResubmit = !!assignment?.allowResubmission && !closed;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title="Assignment Detail"
        navLinks={[
          { href: "/student", label: "All Assignments" },
          { href: "/student/submissions", label: "My Submissions" },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <Link href="/student" className="text-sm text-zinc-500 hover:text-zinc-900">
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
                {closed ? <Badge tone="red">Closed</Badge> : <Badge tone="green">Open</Badge>}
                {assignment.allowResubmission && <Badge tone="blue">Resubmission allowed</Badge>}
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-600">
              {assignment.description}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {assignment.subjectName} · {assignment.teacherName} · {assignment.maxMarks} marks
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Due {formatDateTime(assignment.deadline)} ({deadlineDistance(assignment.deadline)})
            </p>
          </div>
        )}

        {!isLoading && !loadError && assignment && submission && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-zinc-900">Your Submission</h3>
              <SubmissionStatusBadge status={submission.status} />
            </div>

            {!isEditing && (
              <>
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
                <p className="mt-2 text-xs text-zinc-500">
                  Submitted {formatDateTime(submission.submittedAt)}
                  {submission.updatedAt && ` · Updated ${formatDateTime(submission.updatedAt)}`}
                </p>
                {submission.marks !== null && (
                  <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm">
                    <p className="font-medium text-zinc-900">
                      Marks: {submission.marks} / {assignment.maxMarks}
                    </p>
                    {submission.feedback && (
                      <p className="mt-1 whitespace-pre-wrap text-zinc-700">
                        {submission.feedback}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-4">
                  {canResubmit ? (
                    <Button variant="secondary" onClick={() => setIsEditing(true)}>
                      Edit submission
                    </Button>
                  ) : (
                    <Alert tone="info">
                      {closed
                        ? "The deadline has passed, so this submission can no longer be changed."
                        : "This assignment does not allow resubmission, so your answer is final."}
                    </Alert>
                  )}
                </div>
              </>
            )}

            {isEditing && (
              <>
                <Alert tone="warning" className="mt-3">
                  Resubmitting replaces your answer and clears any marks and feedback it already
                  received.
                </Alert>
                <AnswerForm
                  defaultContent={submission.content}
                  existingFileName={submission.fileName}
                  submitLabel="Save answer"
                  loadingLabel="Saving…"
                  onSave={handleUpdate}
                  onCancel={() => setIsEditing(false)}
                />
              </>
            )}
          </div>
        )}

        {!isLoading && !loadError && assignment && !submission && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-base font-semibold text-zinc-900">Submit Your Answer</h3>
            {closed ? (
              <Alert tone="warning" className="mt-3">
                The deadline passed {deadlineDistance(assignment.deadline)}. Late submissions are
                not accepted.
              </Alert>
            ) : (
              <AnswerForm
                defaultContent=""
                submitLabel="Submit"
                loadingLabel="Submitting…"
                onSave={handleCreate}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
