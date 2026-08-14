"use client";

import { AppHeader } from "@/components/AppHeader";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="Admin Dashboard" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          The full admin module (user, class, subject, and teacher-assignment management) lands in
          Phase 6. This placeholder confirms Admin login and routing work end to end.
        </div>
      </main>
    </div>
  );
}
