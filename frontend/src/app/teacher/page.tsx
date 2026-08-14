"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/components/ToastProvider";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { deadlineDistance, formatDateTime, isPastDeadline } from "@/lib/format";
import { createAssignmentSchema, type CreateAssignmentFormValues } from "@/lib/schemas";
import {
  AssignmentStatus,
  type Assignment,
  type ClassOption,
  type SubjectOption,
} from "@/lib/types";

function NewAssignmentForm({
  classes,
  subjects,
  onCreated,
  onCancel,
}: {
  classes: ClassOption[];
  subjects: SubjectOption[];
  onCreated: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssignmentFormValues>({
    resolver: zodResolver(createAssignmentSchema),
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

  const onSubmit = async (values: CreateAssignmentFormValues) => {
    setFormError(null);
    try {
      await api.post("/assignments", {
        title: values.title,
        description: values.description,
        classId: values.classId,
        subjectId: values.subjectId,
        deadline: new Date(values.deadline).toISOString(),
        maxMarks: Number(values.maxMarks),
        allowResubmission: values.allowResubmission,
        status:
          values.status === "Published" ? AssignmentStatus.Published : AssignmentStatus.Draft,
      });
      await onCreated();
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not create the assignment."));
    }
  };

  return (
    <form
      className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2"
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

      <Select
        label="Status"
        disabled={isSubmitting}
        error={errors.status?.message}
        {...register("status")}
      >
        <option value="Published">Published (visible to students)</option>
        <option value="Draft">Draft (hidden until published)</option>
      </Select>

      <Checkbox
        label="Allow resubmission"
        wrapperClassName="sm:pt-7"
        disabled={isSubmitting}
        error={errors.allowResubmission?.message}
        {...register("allowResubmission")}
      />

      {formError && (
        <Alert tone="error" className="sm:col-span-2">
          {formError}
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
        <Button type="submit" isLoading={isSubmitting} loadingText="Creating…">
          Create Assignment
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function TeacherDashboardPage() {
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [assignmentsRes, classesRes, subjectsRes] = await Promise.all([
        api.get<Assignment[]>("/assignments"),
        api.get<ClassOption[]>("/classes"),
        api.get<SubjectOption[]>("/subjects"),
      ]);
      setAssignments(assignmentsRes.data);
      setClasses(classesRes.data);
      setSubjects(subjectsRes.data);
      setLoadError(null);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Could not load your assignments."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // load is also reused by retry and after a create; its setState calls only run
    // after the awaited requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Teacher Dashboard" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Your Assignments</h2>
              <p className="text-sm text-zinc-500">
                Everything you have created, draft or published.
              </p>
            </div>
            {!isFormOpen && (
              <Button onClick={() => setIsFormOpen(true)} disabled={isLoading || !!loadError}>
                New Assignment
              </Button>
            )}
          </div>

          {isFormOpen && (
            <NewAssignmentForm
              classes={classes}
              subjects={subjects}
              onCancel={() => setIsFormOpen(false)}
              onCreated={async () => {
                setIsFormOpen(false);
                showToast("Assignment created.");
                await load();
              }}
            />
          )}

          <div className="mt-4 space-y-3">
            {isLoading && <LoadingState label="Loading assignments…" />}
            {!isLoading && loadError && (
              <ErrorState message={loadError} onRetry={handleRetry} isRetrying={isRetrying} />
            )}
            {!isLoading && !loadError && assignments.length === 0 && (
              <EmptyState
                title="No assignments yet"
                description="Use the New Assignment button above to create your first one."
              />
            )}
            {!loadError &&
              assignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/teacher/assignments/${a.id}`}
                  className="block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-zinc-900">{a.title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <AssignmentStatusBadge status={a.status} />
                      {isPastDeadline(a.deadline) && <Badge tone="red">Closed</Badge>}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {a.subjectName} · {a.className} · {a.maxMarks} marks
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    Due {formatDateTime(a.deadline)} ({deadlineDistance(a.deadline)})
                  </p>
                </Link>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}
