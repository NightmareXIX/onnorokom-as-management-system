"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { roleHomePath, useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

export function RoleGuard({ role, children }: { role: UserRole; children: ReactNode }) {
  const { role: currentRole, token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!token || currentRole === null) {
      router.replace("/login");
      return;
    }
    if (currentRole !== role) {
      router.replace(roleHomePath(currentRole));
    }
  }, [isLoading, token, currentRole, role, router]);

  if (isLoading || !token || currentRole !== role) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
