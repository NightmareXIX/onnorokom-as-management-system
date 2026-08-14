"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ToastProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { teacherAssignmentSchema, type TeacherAssignmentFormValues } from "@/lib/schemas";
import { UserRole } from "@/lib/types";
import type { AdminUser, ClassOption, SubjectOption, TeacherAssignmentRecord } from "@/lib/types";

export default function AdminTeacherAssignmentsPage() {
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState<TeacherAssignmentRecord[]>([]);
  const [teachers, setTeachers] = useState<AdminUser[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TeacherAssignmentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeacherAssignmentFormValues>({
    resolver: zodResolver(teacherAssignmentSchema),
    defaultValues: { teacherId: "", subjectId: "", classId: "" },
  });

  const load = useCallback(async () => {
    try {
      const [assignmentsRes, usersRes, classesRes, subjectsRes] = await Promise.all([
        api.get<TeacherAssignmentRecord[]>("/admin/teacher-assignments"),
        api.get<AdminUser[]>("/admin/users"),
        api.get<ClassOption[]>("/classes"),
        api.get<SubjectOption[]>("/subjects"),
      ]);
      setAssignments(assignmentsRes.data);
      setTeachers(usersRes.data.filter((u) => u.role === UserRole.Teacher && u.isActive));
      setClasses(classesRes.data);
      setSubjects(subjectsRes.data);
      setListError(null);
    } catch (e) {
      setListError(getApiErrorMessage(e, "Could not load teacher assignments."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // load is also reused by retry and after create/delete; its setState calls only
    // run after the awaited requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  const onSubmit = async (values: TeacherAssignmentFormValues) => {
    setFormError(null);
    try {
      await api.post("/admin/teacher-assignments", {
        teacherId: values.teacherId,
        subjectId: values.subjectId,
        classId: values.classId,
      });
      reset();
      showToast("Teacher assigned.");
      await load();
    } catch (e) {
      setFormError(getApiErrorMessage(e, "Could not create the teacher assignment."));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setRowError(null);
    setIsDeleting(true);
    try {
      await api.delete(`/admin/teacher-assignments/${pendingDelete.id}`);
      showToast("Teacher assignment removed.");
      setPendingDelete(null);
      await load();
    } catch (e) {
      setRowError(getApiErrorMessage(e, "Could not remove this teacher assignment."));
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-zinc-900">Assign Teacher</h2>
        <form
          className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Select
            label="Teacher"
            disabled={isSubmitting}
            error={errors.teacherId?.message}
            {...register("teacherId")}
          >
            <option value="">Select a teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
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

          {formError && (
            <Alert tone="error" className="sm:col-span-3">
              {formError}
            </Alert>
          )}

          {!isLoading && teachers.length === 0 && (
            <Alert tone="info" className="sm:col-span-3">
              No active teacher accounts yet — create one on the Users tab first.
            </Alert>
          )}

          <div className="sm:col-span-3">
            <Button type="submit" isLoading={isSubmitting} loadingText="Assigning…">
              Assign
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Teacher Assignments</h2>
        {isLoading && (
          <div className="mt-3">
            <LoadingState />
          </div>
        )}
        {!isLoading && listError && (
          <div className="mt-3">
            <ErrorState message={listError} onRetry={handleRetry} isRetrying={isRetrying} />
          </div>
        )}
        {rowError && (
          <Alert tone="error" className="mt-3">
            {rowError}
          </Alert>
        )}
        {!isLoading && !listError && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Teacher</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Subject</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Class</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-zinc-900">{a.teacherName}</td>
                    <td className="px-3 py-2 text-zinc-600">{a.subjectName}</td>
                    <td className="px-3 py-2 text-zinc-600">{a.className}</td>
                    <td className="px-3 py-2">
                      <Button variant="danger" size="sm" onClick={() => setPendingDelete(a)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-zinc-500">
                      No teacher assignments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this teacher assignment?"
        description={
          pendingDelete
            ? `${pendingDelete.teacherName} will no longer be listed as teaching ${pendingDelete.subjectName} to ${pendingDelete.className}.`
            : undefined
        }
        confirmLabel="Remove"
        isBusy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
