"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/form";
import { getApiErrorMessage } from "@/lib/api";
import { roleHomePath, useAuth } from "@/lib/auth-context";
import { loginSchema, type LoginFormValues } from "@/lib/schemas";

/** Seeded accounts — one click fills the form so an evaluator can get straight in. */
const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@school.com", password: "Admin@123" },
  { label: "Teacher", email: "teacher@school.com", password: "Teacher@123" },
  { label: "Student", email: "student@school.com", password: "Student@123" },
];

export default function LoginPage() {
  const { login, token, role, isLoading } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!isLoading && token && role !== null) {
      router.replace(roleHomePath(role));
    }
  }, [isLoading, token, role, router]);

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Sign in failed. Please try again."));
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-12">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold text-zinc-900">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">Assignment &amp; Submission Management System</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
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
            autoComplete="current-password"
            disabled={isSubmitting}
            error={errors.password?.message}
            {...register("password")}
          />

          {formError && <Alert tone="error">{formError}</Alert>}

          <Button
            type="submit"
            className="w-full"
            isLoading={isSubmitting}
            loadingText="Signing in…"
          >
            Sign in
          </Button>
        </form>

        <div className="mt-6 border-t border-zinc-200 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Demo accounts
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="secondary"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  setValue("email", account.email, { shouldValidate: true });
                  setValue("password", account.password, { shouldValidate: true });
                  setFormError(null);
                }}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 text-sm text-zinc-600">
          Need an account?{" "}
          <Link href="/register" className="font-medium text-zinc-900 underline underline-offset-2">
            Register as a student
          </Link>
        </div>
      </div>
    </div>
  );
}
