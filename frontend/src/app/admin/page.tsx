"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, getApiErrorMessage } from "@/lib/api";
import { userRoleLabel } from "@/lib/format";
import { UserRole, type AdminUser, type ClassOption } from "@/lib/types";

const roleOptions = [
  { value: "Admin", label: "Admin" },
  { value: "Teacher", label: "Teacher" },
  { value: "Student", label: "Student" },
] as const;

function roleToEnum(role: string): UserRole {
  switch (role) {
    case "Admin":
      return UserRole.Admin;
    case "Teacher":
      return UserRole.Teacher;
    default:
      return UserRole.Student;
  }
}

function roleToString(role: UserRole): "Admin" | "Teacher" | "Student" {
  switch (role) {
    case UserRole.Admin:
      return "Admin";
    case UserRole.Teacher:
      return "Teacher";
    default:
      return "Student";
  }
}

const createUserSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["Admin", "Teacher", "Student"]),
    classId: z.string().optional(),
  })
  .refine((data) => data.role !== "Student" || !!data.classId, {
    message: "Select a class for a Student account",
    path: ["classId"],
  });

type CreateUserFormValues = z.infer<typeof createUserSchema>;

const editUserSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    role: z.enum(["Admin", "Teacher", "Student"]),
    classId: z.string().optional(),
    isActive: z.boolean(),
  })
  .refine((data) => data.role !== "Student" || !!data.classId, {
    message: "Select a class for a Student account",
    path: ["classId"],
  });

type EditUserFormValues = z.infer<typeof editUserSchema>;

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
    watch,
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
  const role = watch("role");

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
      setError(getApiErrorMessage(e));
    }
  };

  return (
    <tr className="bg-zinc-50">
      <td colSpan={6} className="p-3">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-start"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div>
            <label className="block text-xs font-medium text-zinc-700">Full Name</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              {...register("fullName")}
            />
            {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Email</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Role</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              {...register("role")}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Class</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:bg-zinc-100"
              disabled={role !== "Student"}
              {...register("classId")}
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.classId && <p className="mt-1 text-xs text-red-600">{errors.classId.message}</p>}
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-700">
              <input type="checkbox" className="h-4 w-4 rounded border-zinc-300" {...register("isActive")} />
              Active
            </label>
          </div>
          {error && <p className="text-xs text-red-600 lg:col-span-5">{error}</p>}
          <div className="flex gap-2 lg:col-span-5">
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
        </form>
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { fullName: "", email: "", password: "", role: "Teacher", classId: "" },
  });
  const role = watch("role");

  const loadUsers = useCallback(async () => {
    try {
      const response = await api.get<AdminUser[]>("/admin/users");
      setUsers(response.data);
      setListError(null);
    } catch (e) {
      setListError(getApiErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    api
      .get<ClassOption[]>("/classes")
      .then((res) => setClasses(res.data))
      .catch(() => {});
  }, [loadUsers]);

  const onSubmit = async (values: CreateUserFormValues) => {
    setFormError(null);
    setFormSuccess(null);
    try {
      await api.post("/admin/users", {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        role: roleToEnum(values.role),
        classId: values.role === "Student" ? values.classId : null,
      });
      setFormSuccess("User created.");
      reset();
      await loadUsers();
    } catch (e) {
      setFormError(getApiErrorMessage(e));
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    setBusyId(user.id);
    try {
      if (user.isActive) {
        await api.delete(`/admin/users/${user.id}`);
      } else {
        await api.put(`/admin/users/${user.id}`, {
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          classId: user.classId,
          isActive: true,
        });
      }
      await loadUsers();
    } catch (e) {
      setListError(getApiErrorMessage(e));
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
          <div>
            <label className="block text-sm font-medium text-zinc-700">Full Name</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              {...register("fullName")}
            />
            {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              {...register("password")}
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Role</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              {...register("role")}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {role === "Student" && (
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
          )}

          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{formError}</p>
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
              {isSubmitting ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Users</h2>
        {isLoading && <p className="mt-3 text-sm text-zinc-500">Loading users…</p>}
        {listError && <p className="mt-3 text-sm text-red-600">{listError}</p>}
        {!isLoading && !listError && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600">Email</th>
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
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={u.id}>
                      <td className="px-3 py-2 text-zinc-900">{u.fullName}</td>
                      <td className="px-3 py-2 text-zinc-600">{u.email}</td>
                      <td className="px-3 py-2 text-zinc-600">{userRoleLabel(u.role)}</td>
                      <td className="px-3 py-2 text-zinc-600">{u.className ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.isActive ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(u.id)}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => handleToggleActive(u)}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
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
    </div>
  );
}
