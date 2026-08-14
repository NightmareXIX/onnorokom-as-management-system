"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, getApiErrorMessage } from "@/lib/api";
import type { ClassOption } from "@/lib/types";

const classSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type ClassFormValues = z.infer<typeof classSchema>;

function EditClassRow({
  cls,
  onSaved,
  onCancel,
}: {
  cls: ClassOption;
  onSaved: (updated: ClassOption) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: { name: cls.name, description: cls.description ?? "" },
  });

  const onSubmit = async (values: ClassFormValues) => {
    setError(null);
    try {
      const response = await api.put<ClassOption>(`/admin/classes/${cls.id}`, {
        name: values.name,
        description: values.description || null,
      });
      onSaved(response.data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  return (
    <tr className="bg-zinc-50">
      <td colSpan={3} className="p-3">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-start"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div>
            <label className="block text-xs font-medium text-zinc-700">Name</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              {...register("name")}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Description</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              {...register("description")}
            />
          </div>
          <div className="flex gap-2 sm:pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-600 sm:col-span-3">{error}</p>}
        </form>
      </td>
    </tr>
  );
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: { name: "", description: "" },
  });

  const load = useCallback(async () => {
    try {
      const response = await api.get<ClassOption[]>("/admin/classes");
      setClasses(response.data);
      setListError(null);
    } catch (e) {
      setListError(getApiErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // load is also reused after create/edit/delete to refresh the list; its setState
    // calls only run after the awaited request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const onSubmit = async (values: ClassFormValues) => {
    setFormError(null);
    try {
      await api.post("/admin/classes", { name: values.name, description: values.description || null });
      reset();
      await load();
    } catch (e) {
      setFormError(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (cls: ClassOption) => {
    if (!window.confirm(`Delete class "${cls.name}"? This cannot be undone.`)) {
      return;
    }
    setRowError(null);
    try {
      await api.delete(`/admin/classes/${cls.id}`);
      await load();
    } catch (e) {
      setRowError(getApiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-zinc-900">Create Class</h2>
        <form
          className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700">Name</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              {...register("name")}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Description</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              {...register("description")}
            />
          </div>
          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{formError}</p>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating…" : "Create Class"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Classes</h2>
        {isLoading && <p className="mt-3 text-sm text-zinc-500">Loading classes…</p>}
        {listError && <p className="mt-3 text-sm text-red-600">{listError}</p>}
        {rowError && <p className="mt-3 text-sm text-red-600">{rowError}</p>}
        {!isLoading && !listError && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Description</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {classes.map((c) =>
                  editingId === c.id ? (
                    <EditClassRow
                      key={c.id}
                      cls={c}
                      onSaved={(updated) => {
                        setClasses((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={c.id}>
                      <td className="px-3 py-2 text-zinc-900">{c.name}</td>
                      <td className="px-3 py-2 text-zinc-600">{c.description ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(c.id)}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
                {classes.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-zinc-500">
                      No classes yet.
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
