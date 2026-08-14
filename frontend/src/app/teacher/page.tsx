"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { api, getApiErrorMessage } from "@/lib/api";
import { assignmentStatusLabel, formatDateTime } from "@/lib/format";
import { AssignmentStatus, type Assignment, type ClassOption, type SubjectOption } from "@/lib/types";

const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  classId: z.string().min(1, "Select a class"),
  subjectId: z.string().min(1, "Select a subject"),
  deadline: z.string().min(1, "Deadline is required"),
  maxMarks: z
    .string()
    .min(1, "Max marks is required")
    .refine(
      (v) => Number.isInteger(Number(v)) && Number(v) > 0,
      "Must be a positive whole number"
    ),
  allowResubmission: z.boolean(),
  status: z.enum(["Draft", "Published"]),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export default function TeacherDashboardPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      classId: "",
      subjectId: "",
      deadline: "",
      maxMarks: "",
      allowResubmission: false,
      status: "Published",
    },
  });

  const loadAssignments = useCallback(async () => {
    try {
      const response = await api.get<Assignment[]>("/assignments");
      setAssignments(response.data);
      setListError(null);
    } catch (error) {
      setListError(getApiErrorMessage(error));
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    // loadAssignments is also reused by the create-assignment submit handler to
    // refresh the list; its setState calls only run after the awaited request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAssignments();
    api
      .get<ClassOption[]>("/classes")
      .then((res) => setClasses(res.data))
      .catch(() => {});
    api
      .get<SubjectOption[]>("/subjects")
      .then((res) => setSubjects(res.data))
      .catch(() => {});
  }, [loadAssignments]);

  const onSubmit = async (values: AssignmentFormValues) => {
    setFormError(null);
    setFormSuccess(null);
    try {
      await api.post("/assignments", {
        title: values.title,
        description: values.description,
        classId: values.classId,
        subjectId: values.subjectId,
        deadline: new Date(values.deadline).toISOString(),
        maxMarks: Number(values.maxMarks),
        allowResubmission: values.allowResubmission,
        status: values.status === "Published" ? AssignmentStatus.Published : AssignmentStatus.Draft,
      });
      setFormSuccess("Assignment created.");
      reset();
      await loadAssignments();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Teacher Dashboard" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-6 sm:px-6">
        <section>
          <h2 className="text-base font-semibold text-zinc-900">New Assignment</h2>
          <form
            className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700">Title</label>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                {...register("title")}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700">Description</label>
              <textarea
                rows={3}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                {...register("description")}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700">Class</label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                {...register("classId")}
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.classId && (
                <p className="mt-1 text-sm text-red-600">{errors.classId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700">Subject</label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                {...register("subjectId")}
              >
                <option value="">Select a subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.subjectId && (
                <p className="mt-1 text-sm text-red-600">{errors.subjectId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700">Deadline</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                {...register("deadline")}
              />
              {errors.deadline && (
                <p className="mt-1 text-sm text-red-600">{errors.deadline.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700">Max Marks</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                {...register("maxMarks")}
              />
              {errors.maxMarks && (
                <p className="mt-1 text-sm text-red-600">{errors.maxMarks.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700">Status</label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                {...register("status")}
              >
                <option value="Published">Published (visible to students)</option>
                <option value="Draft">Draft (hidden until published)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="allowResubmission"
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300"
                {...register("allowResubmission")}
              />
              <label htmlFor="allowResubmission" className="text-sm text-zinc-700">
                Allow resubmission
              </label>
            </div>

            {formError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
                {formError}
              </p>
            )}
            {formSuccess && (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 sm:col-span-2">
                {formSuccess}
              </p>
            )}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creating…" : "Create Assignment"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900">Your Assignments</h2>
          <div className="mt-3 space-y-3">
            {isLoadingList && <p className="text-sm text-zinc-500">Loading assignments…</p>}
            {listError && <p className="text-sm text-red-600">{listError}</p>}
            {!isLoadingList && !listError && assignments.length === 0 && (
              <p className="text-sm text-zinc-500">No assignments yet — create one above.</p>
            )}
            {assignments.map((a) => (
              <Link
                key={a.id}
                href={`/teacher/assignments/${a.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-zinc-900">{a.title}</h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {assignmentStatusLabel(a.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {a.subjectName} · {a.className} · Due {formatDateTime(a.deadline)} · {a.maxMarks}{" "}
                  marks
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
