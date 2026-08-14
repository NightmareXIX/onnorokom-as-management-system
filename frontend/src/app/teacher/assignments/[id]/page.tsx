"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { api, getApiErrorMessage } from "@/lib/api";
import { assignmentStatusLabel, formatDateTime, submissionStatusLabel } from "@/lib/format";
import { AssignmentStatus, SubmissionStatus, type Assignment, type Submission } from "@/lib/types";

const gradeSchema = z.object({
  marks: z
    .string()
    .min(1, "Marks is required")
    .refine(
      (v) => Number.isInteger(Number(v)) && Number(v) >= 0,
      "Must be a non-negative whole number"
    ),
  feedback: z.string().optional(),
});

type GradeFormValues = z.infer<typeof gradeSchema>;

function GradeForm({
  submission,
  onGraded,
}: {
  submission: Submission;
  onGraded: (updated: Submission) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GradeFormValues>({
    resolver: zodResolver(gradeSchema),
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
      onGraded(response.data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  return (
    <form
      className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-start"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div>
        <label className="block text-xs font-medium text-zinc-700">Marks</label>
        <input
          type="number"
          min={0}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          {...register("marks")}
        />
        {errors.marks && <p className="mt-1 text-xs text-red-600">{errors.marks.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Feedback</label>
        <input
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          {...register("feedback")}
        />
      </div>
      <div className="sm:pt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? "Saving…" : submission.status === SubmissionStatus.Graded ? "Update Grade" : "Grade"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
    </form>
  );
}

export default function TeacherAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [assignmentRes, submissionsRes] = await Promise.all([
        api.get<Assignment>(`/assignments/${id}`),
        api.get<Submission[]>(`/assignments/${id}/submissions`),
      ]);
      setAssignment(assignmentRes.data);
      setSubmissions(submissionsRes.data);
      setError(null);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // load's setState calls only run after the awaited requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleGraded = (updated: Submission) => {
    setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handlePublish = async () => {
    setPublishError(null);
    setIsPublishing(true);
    try {
      const response = await api.patch<Assignment>(`/assignments/${id}/publish`);
      setAssignment(response.data);
    } catch (e) {
      setPublishError(getApiErrorMessage(e));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title="Assignment Submissions"
        navLinks={[{ href: "/teacher", label: "All Assignments" }]}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <Link href="/teacher" className="text-sm text-zinc-500 hover:text-zinc-900">
          &larr; Back to assignments
        </Link>

        {isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {assignment && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">{assignment.title}</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                {assignmentStatusLabel(assignment.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{assignment.description}</p>
            <p className="mt-2 text-sm text-zinc-500">
              {assignment.subjectName} · {assignment.className} · Due{" "}
              {formatDateTime(assignment.deadline)} · {assignment.maxMarks} marks
            </p>
            {assignment.status === AssignmentStatus.Draft && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPublishing ? "Publishing…" : "Publish"}
                </button>
                {publishError && <p className="mt-1 text-sm text-red-600">{publishError}</p>}
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && (
          <div>
            <h3 className="text-base font-semibold text-zinc-900">
              Submissions ({submissions.length})
            </h3>
            {submissions.length === 0 && (
              <p className="mt-2 text-sm text-zinc-500">No submissions yet.</p>
            )}
            <div className="mt-3 space-y-4">
              {submissions.map((s) => (
                <div key={s.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-zinc-900">{s.studentName}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {submissionStatusLabel(s.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Submitted {formatDateTime(s.submittedAt)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{s.content}</p>
                  <GradeForm submission={s} onGraded={handleGraded} />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
