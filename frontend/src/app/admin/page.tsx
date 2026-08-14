"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ToastProvider";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { userRoleLabel } from "@/lib/format";
import {
  createUserSchema,
  editUserSchema,
  type CreateUserFormValues,
  type EditUserFormValues,
} from "@/lib/schemas";
import { UserRole, type AdminUser, type ClassOption } from "@/lib/types";

const roleOptions = ["Admin", "Teacher", "Student"] as const;
type RoleName = (typeof roleOptions)[number];

function roleToEnum(role: RoleName): UserRole {
  switch (role) {
    case "Admin":
      return UserRole.Admin;
    case "Teacher":
      return UserRole.Teacher;
    default:
      return UserRole.Student;
  }
}

function roleToString(role: UserRole): RoleName {
  switch (role) {
    case UserRole.Admin:
      return "Admin";
    case UserRole.Teacher:
      return "Teacher";
    default:
      return "Student";
  }
}

function EditUserRow({
  user,
  classes,
  onSaved,
  onCancel,
}: {
  user: AdminUser;
  classes: ClassOption[];
  onSaved: (updated: AdminUser) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: user.fullName,
      email: user.email,
      role: roleToString(user.role),
      classId: user.classId ?? "",
      isActive: user.isActive,
    },
  });
  // `useWatch` rather than `watch()` — the latter returns a function the React
  // Compiler cannot memoize, which makes it skip compiling the whole component.
  const role = useWatch({ control, name: "role" });

  const onSubmit = async (values: EditUserFormValues) => {
    setError(null);
    try {
      const response = await api.put<AdminUser>(`/admin/users/${user.id}`, {
        fullName: values.fullName,
        email: values.email,
        role: roleToEnum(values.role),
        classId: values.role === "Student" ? values.classId : null,
        isActive: values.isActive,
      });
      onSaved(response.data);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save this user."));
    }
  };

  return (
    <tr className="bg-zinc-50">
      <td colSpan={6} className="p-3">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Input
            label="Full Name"
            disabled={isSubmitting}
            error={errors.fullName?.message}
            {...register("fullName")}
          />
          <Input
            label="Email"
            type="email"
            disabled={isSubmitting}
            error={errors.email?.message}
            {...register("email")}
          />
          <Select
            label="Role"
            disabled={isSubmitting}
            error={errors.role?.message}
            {...register("role")}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select
            label="Class"
            disabled={isSubmitting || role !== "Student"}
            error={errors.classId?.message}
            hint={role !== "Student" ? "Only students belong to a class." : undefined}
            {...register("classId")}
          >
            <option value="">Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Checkbox
            label="Active"
            wrapperClassName="lg:col-span-4"
            disabled={isSubmitting}
            {...register("isActive")}
          />
          {error && (
            <Alert tone="error" className="lg:col-span-4">
              {error}
            </Alert>
          )}
          <div className="flex flex-wrap gap-2 lg:col-span-4">
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

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDeactivation, setPendingDeactivation] = useState<AdminUser | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { fullName: "", email: "", password: "", role: "Teacher", classId: "" },
  });
  const role = useWatch({ control, name: "role" });

  const load = useCallback(async () => {
    try {
      const [usersRes, classesRes] = await Promise.all([
        api.get<AdminUser[]>("/admin/users"),
        api.get<ClassOption[]>("/classes"),
      ]);
      setUsers(usersRes.data);
      setClasses(classesRes.data);
      setListError(null);
    } catch (e) {
      setListError(getApiErrorMessage(e, "Could not load users."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // load is also reused by retry and after create/deactivate; its setState calls
    // only run after the awaited requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  const onSubmit = async (values: CreateUserFormValues) => {
    setFormError(null);
    try {
      await api.post("/admin/users", {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        role: roleToEnum(values.role),
        classId: values.role === "Student" ? values.classId : null,
      });
      reset();
      showToast(`${values.fullName} can now sign in as a ${values.role}.`);
      await load();
    } catch (e) {
      setFormError(getApiErrorMessage(e, "Could not create the user."));
    }
  };

  const handleActivate = async (user: AdminUser) => {
    setActionError(null);
    setBusyId(user.id);
    try {
      await api.put(`/admin/users/${user.id}`, {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        classId: user.classId,
        isActive: true,
      });
      showToast(`${user.fullName} reactivated.`);
      await load();
    } catch (e) {
      setActionError(getApiErrorMessage(e, "Could not reactivate this user."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeactivate = async () => {
    if (!pendingDeactivation) {
      return;
    }
    setActionError(null);
    setBusyId(pendingDeactivation.id);
    try {
      await api.delete(`/admin/users/${pendingDeactivation.id}`);
      showToast(`${pendingDeactivation.fullName} deactivated.`);
      setPendingDeactivation(null);
      await load();
    } catch (e) {
      setActionError(getApiErrorMessage(e, "Could not deactivate this user."));
      setPendingDeactivation(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-zinc-900">Create User</h2>
        <form
          className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Input
            label="Full Name"
            disabled={isSubmitting}
            error={errors.fullName?.message}
            {...register("fullName")}
          />
          <Input
            label="Email"
            type="email"
            disabled={isSubmitting}
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 6 characters."
            disabled={isSubmitting}
            error={errors.password?.message}
            {...register("password")}
          />
          <Select
            label="Role"
            disabled={isSubmitting}
            error={errors.role?.message}
            {...register("role")}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>

          {role === "Student" && (
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
          )}

          {formError && (
            <Alert tone="error" className="sm:col-span-2">
              {formError}
            </Alert>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" isLoading={isSubmitting} loadingText="Creating…">
              Create User
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Users</h2>
        {isLoading && (
          <div className="mt-3">
            <LoadingState label="Loading users…" />
          </div>
        )}
        {!isLoading && listError && (
          <div className="mt-3">
            <ErrorState message={listError} onRetry={handleRetry} isRetrying={isRetrying} />
          </div>
        )}
        {actionError && (
          <Alert tone="error" className="mt-3">
            {actionError}
          </Alert>
        )}
        {!isLoading && !listError && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Name</th>
                  <th className="hidden px-3 py-2 text-left font-medium text-zinc-600 sm:table-cell">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Role</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Class</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map((u) =>
                  editingId === u.id ? (
                    <EditUserRow
                      key={u.id}
                      user={u}
                      classes={classes}
                      onSaved={(updated) => {
                        setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                        setEditingId(null);
                        showToast("User updated.");
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={u.id}>
                      <td className="px-3 py-2 text-zinc-900">
                        {u.fullName}
                        {/* The email column is dropped at mobile width to keep the
                            table readable, so fold it into the name cell there. */}
                        <span className="block text-xs text-zinc-500 sm:hidden">{u.email}</span>
                      </td>
                      <td className="hidden px-3 py-2 text-zinc-600 sm:table-cell">{u.email}</td>
                      <td className="px-3 py-2 text-zinc-600">{userRoleLabel(u.role)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                        {u.className ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={u.isActive ? "green" : "neutral"}>
                          {u.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingId(u.id)}
                            disabled={busyId === u.id}
                          >
                            Edit
                          </Button>
                          {u.isActive ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setPendingDeactivation(u)}
                              disabled={busyId === u.id}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleActivate(u)}
                              isLoading={busyId === u.id}
                              loadingText="Working…"
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDeactivation !== null}
        title={`Deactivate ${pendingDeactivation?.fullName ?? "this user"}?`}
        description="They will not be able to sign in. Their assignments and submissions are kept, and you can reactivate them at any time."
        confirmLabel="Deactivate"
        isBusy={busyId !== null && busyId === pendingDeactivation?.id}
        onConfirm={handleDeactivate}
        onCancel={() => setPendingDeactivation(null)}
      />
    </div>
  );
}
