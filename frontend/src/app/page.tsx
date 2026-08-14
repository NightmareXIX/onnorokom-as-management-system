"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";
import { roleHomePath, useAuth } from "@/lib/auth-context";

export default function Home() {
  const { role, token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (token && role !== null) {
      router.replace(roleHomePath(role));
    } else {
      router.replace("/login");
    }
  }, [isLoading, token, role, router]);

  return (
    <div
      role="status"
      className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-zinc-500"
    >
      <Spinner />
      <span>Loading…</span>
    </div>
  );
}
