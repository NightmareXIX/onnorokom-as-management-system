"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ToastProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { classSchema, type ClassFormValues } from "@/lib/schemas";
import type { ClassOption } from "@/lib/types";

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
      setError(getApiErrorMessage(e, "Could not save this class."));
    }
  };

  return (
    <tr className="bg-zinc-50">
      <td colSpan={3} className="p-3">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr]"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Input
            label="Name"
            disabled={isSubmitting}
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            label="Description"
            disabled={isSubmitting}
            error={errors.description?.message}
            {...register("description")}
          />
          {error && (
            <Alert tone="error" className="sm:col-span-2">
              {error}
            </Alert>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" size="sm" isLoading={isSubmitting} loadingText="Saving…">
              Save
            </Button>
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export default function AdminClassesPage() {
  const { showToast } = useToast();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClassOption | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      setListError(getApiErrorMessage(e, "Could not load classes."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // load is also reused by retry and after create/edit/delete; its setState calls
    // only run after the awaited request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  const onSubmit = async (values: ClassFormValues) => {
    setFormError(null);
    try {
      await api.post("/admin/classes", {
        name: values.name,
        description: values.description || null,
      });
      reset();
      showToast("Class created.");
      await load();
    } catch (e) {
      setFormError(getApiErrorMessage(e, "Could not create the class."));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setRowError(null);
    setIsDeleting(true);
    try {
      await api.delete(`/admin/classes/${pendingDelete.id}`);
      showToast(`Deleted "${pendingDelete.name}".`);
      setPendingDelete(null);
      await load();
    } catch (e) {
      setRowError(getApiErrorMessage(e, "Could not delete this class."));
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
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
          <Input
            label="Name"
            placeholder="Class 10 - Section A"
            disabled={isSubmitting}
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            label="Description"
            hint="Optional."
            disabled={isSubmitting}
            error={errors.description?.message}
            {...register("description")}
          />
          {formError && (
            <Alert tone="error" className="sm:col-span-2">
              {formError}
            </Alert>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" isLoading={isSubmitting} loadingText="Creating…">
              Create Class
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Classes</h2>
        {isLoading && (
          <div className="mt-3">
            <LoadingState label="Loading classes…" />
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
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Name</th>
                  <th className="hidden px-3 py-2 text-left font-medium text-zinc-600 sm:table-cell">
                    Description
                  </th>
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
                        showToast("Class updated.");
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={c.id}>
                      <td className="px-3 py-2 text-zinc-900">
                        {c.name}
                        {/* Description column is dropped at mobile width. */}
                        {c.description && (
                          <span className="block text-xs text-zinc-500 sm:hidden">
                            {c.description}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 text-zinc-600 sm:table-cell">
                        {c.description ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setEditingId(c.id)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setPendingDelete(c)}>
                            Delete
                          </Button>
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description="A class that still has students, assignments or teacher assignments cannot be deleted."
        confirmLabel="Delete"
        isBusy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
