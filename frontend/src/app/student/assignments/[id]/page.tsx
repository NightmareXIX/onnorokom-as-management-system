"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateTime, submissionStatusLabel } from "@/lib/format";
import type { Assignment, Submission } from "@/lib/types";

const submissionSchema = z.object({
  content: z.string().min(1, "Please write an answer before submitting"),
});

type SubmissionFormValues = z.infer<typeof submissionSchema>;

export default function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubmissionFormValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { content: "" },
  });

  const load = useCallback(async () => {
    try {
      const [assignmentRes, submissionsRes] = await Promise.all([
        api.get<Assignment>(`/assignments/${id}`),
        api.get<Submission[]>("/submissions/me"),
      ]);
      setAssignment(assignmentRes.data);
      setExistingSubmission(
        submissionsRes.data.find((s) => s.assignmentId === id) ?? null
      );
      setLoadError(null);
    } catch (e) {
      setLoadError(getApiErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // load's setState calls only run after the awaited requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const onSubmit = async (values: SubmissionFormValues) => {
    setSubmitError(null);
    try {
      const response = await api.post<Submission>(`/assignments/${id}/submissions`, {
        content: values.content,
      });
      setExistingSubmission(response.data);
    } catch (e) {
      setSubmitError(getApiErrorMessage(e));
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        title="Assignment Detail"
        navLinks={[
          { href: "/student", label: "All Assignments" },
          { href: "/student/submissions", label: "My Submissions" },
        ]}
      />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <Link href="/student" className="text-sm text-zinc-500 hover:text-zinc-900">
          &larr; Back to assignments
        </Link>

        {isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}

        {assignment && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-zinc-900">{assignment.title}</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">
              {assignment.description}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {assignment.subjectName} · {assignment.teacherName} · Due{" "}
              {formatDateTime(assignment.deadline)} · {assignment.maxMarks} marks
            </p>
          </div>
        )}

        {!isLoading && !loadError && existingSubmission && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-zinc-900">Your Submission</h3>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                {submissionStatusLabel(existingSubmission.status)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
              {existingSubmission.content}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Submitted {formatDateTime(existingSubmission.submittedAt)}
            </p>
            {existingSubmission.marks !== null && (
              <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm">
                <p className="font-medium text-zinc-900">
                  Marks: {existingSubmission.marks} / {assignment?.maxMarks}
                </p>
                {existingSubmission.feedback && (
                  <p className="mt-1 text-zinc-700">{existingSubmission.feedback}</p>
                )}
              </div>
            )}
          </div>
        )}

        {!isLoading && !loadError && !existingSubmission && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-base font-semibold text-zinc-900">Submit Your Answer</h3>
            <form className="mt-3 space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
              <textarea
                rows={6}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Write your answer here…"
                {...register("content")}
              />
              {errors.content && (
                <p className="text-sm text-red-600">{errors.content.message}</p>
              )}
              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting…" : "Submit"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
