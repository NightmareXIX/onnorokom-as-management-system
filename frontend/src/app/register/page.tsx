"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { api, getApiErrorMessage } from "@/lib/api";
import { roleHomePath, useAuth } from "@/lib/auth-context";
import { registerSchema, type RegisterFormValues } from "@/lib/schemas";
import type { ClassOption, RegisterResponse } from "@/lib/types";

export default function RegisterPage() {
  const { token, role, isLoading } = useAuth();
  const router = useRouter();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", classId: "" },
  });

  useEffect(() => {
    if (!isLoading && token && role !== null) {
      router.replace(roleHomePath(role));
    }
  }, [isLoading, token, role, router]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ClassOption[]>("/classes")
      .then((response) => {
        if (!cancelled) {
          setClasses(response.data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setClassesError(getApiErrorMessage(e, "Could not load the list of classes."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setClassesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);
    try {
      const response = await api.post<RegisterResponse>("/auth/register", values);
      setSuccessMessage(response.data.message);
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not create your account. Please try again."));
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-12">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold text-zinc-900">Create a student account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          An administrator will need to approve your account before you can sign in.
        </p>

        {successMessage ? (
          <div className="mt-6 space-y-4">
            <Alert tone="success">{successMessage}</Alert>
            <Button className="w-full" onClick={() => router.push("/login")}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input
              label="Full Name"
              autoComplete="name"
              disabled={isSubmitting}
              error={errors.fullName?.message}
              {...register("fullName")}
            />

            <Input
              label="Email"
              type="email"
              autoComplete="email"
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

            {classesLoading && <LoadingState label="Loading classes…" />}
            {!classesLoading && classesError && <ErrorState message={classesError} />}
            {!classesLoading && !classesError && (
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

            {formError && <Alert tone="error">{formError}</Alert>}

            <Button
              type="submit"
              className="w-full"
              isLoading={isSubmitting}
              loadingText="Creating account…"
              disabled={classesLoading || !!classesError}
            >
              Create account
            </Button>
          </form>
        )}

        <div className="mt-6 border-t border-zinc-200 pt-4 text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline underline-offset-2">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
