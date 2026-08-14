"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, getApiErrorMessage } from "@/lib/api";
import { UserRole } from "@/lib/types";
import type { AdminUser, ClassOption, SubjectOption, TeacherAssignmentRecord } from "@/lib/types";

const assignmentSchema = z.object({
  teacherId: z.string().min(1, "Select a teacher"),
  subjectId: z.string().min(1, "Select a subject"),
  classId: z.string().min(1, "Select a class"),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export default function AdminTeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<TeacherAssignmentRecord[]>([]);
  const [teachers, setTeachers] = useState<AdminUser[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { teacherId: "", subjectId: "", classId: "" },
  });

  const load = useCallback(async () => {
    try {
      const [assignmentsRes, usersRes] = await Promise.all([
        api.get<TeacherAssignmentRecord[]>("/admin/teacher-assignments"),
        api.get<AdminUser[]>("/admin/users"),
      ]);
      setAssignments(assignmentsRes.data);
      setTeachers(usersRes.data.filter((u) => u.role === UserRole.Teacher && u.isActive));
      setListError(null);
    } catch (e) {
      setListError(getApiErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // load is also reused after create/delete to refresh the list; its setState calls
    // only run after the awaited requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    api
      .get<ClassOption[]>("/classes")
      .then((res) => setClasses(res.data))
      .catch(() => {});
    api
      .get<SubjectOption[]>("/subjects")
      .then((res) => setSubjects(res.data))
      .catch(() => {});
  }, [load]);

  const onSubmit = async (values: AssignmentFormValues) => {
    setFormError(null);
    try {
      await api.post("/admin/teacher-assignments", {
        teacherId: values.teacherId,
        subjectId: values.subjectId,
        classId: values.classId,
      });
      reset();
      await load();
    } catch (e) {
      setFormError(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (assignment: TeacherAssignmentRecord) => {
    if (
      !window.confirm(
        `Remove ${assignment.teacherName} from ${assignment.subjectName} · ${assignment.className}?`
      )
    ) {
      return;
    }
    setRowError(null);
    try {
      await api.delete(`/admin/teacher-assignments/${assignment.id}`);
      await load();
    } catch (e) {
      setRowError(getApiErrorMessage(e));
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
          <div>
            <label className="block text-sm font-medium text-zinc-700">Teacher</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              {...register("teacherId")}
            >
              <option value="">Select a teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
            {errors.teacherId && <p className="mt-1 text-sm text-red-600">{errors.teacherId.message}</p>}
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
            {errors.subjectId && <p className="mt-1 text-sm text-red-600">{errors.subjectId.message}</p>}
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
            {errors.classId && <p className="mt-1 text-sm text-red-600">{errors.classId.message}</p>}
          </div>

          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-3">{formError}</p>
          )}

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Assigning…" : "Assign"}
            </button>
          </div>
        </form>
        {teachers.length === 0 && !isLoading && (
          <p className="mt-2 text-xs text-zinc-500">
            No active teacher accounts yet — create one on the Users tab first.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Teacher Assignments</h2>
        {isLoading && <p className="mt-3 text-sm text-zinc-500">Loading…</p>}
        {listError && <p className="mt-3 text-sm text-red-600">{listError}</p>}
        {rowError && <p className="mt-3 text-sm text-red-600">{rowError}</p>}
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
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
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
    </div>
  );
}
