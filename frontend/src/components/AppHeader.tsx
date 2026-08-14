"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function AppHeader({
  title,
  navLinks,
}: {
  title: string;
  navLinks?: { href: string; label: string }[];
}) {
  const { fullName, logout } = useAuth();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Assignment System</p>
          <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
        </div>
        <div className="flex items-center gap-4">
          {navLinks?.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              {link.label}
            </Link>
          ))}
          <span className="hidden text-sm text-zinc-600 sm:inline">{fullName}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
