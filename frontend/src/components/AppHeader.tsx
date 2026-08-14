"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { userRoleLabel } from "@/lib/format";

export function AppHeader({
  title,
  navLinks,
}: {
  title: string;
  navLinks?: { href: string; label: string }[];
}) {
  const { fullName, role, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="relative mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Assignment System</p>
          <h1 className="truncate text-lg font-semibold text-zinc-900">{title}</h1>
        </div>
        <nav className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {navLinks?.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`text-sm font-medium ${
                pathname === link.href
                  ? "text-zinc-900 underline underline-offset-4"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <NotificationBell />
          <span className="hidden items-center gap-2 sm:flex">
            <span className="max-w-[10rem] truncate text-sm text-zinc-600">{fullName}</span>
            {role !== null && <Badge>{userRoleLabel(role)}</Badge>}
          </span>
          <Button variant="secondary" size="sm" onClick={logout}>
            Log out
          </Button>
        </nav>
      </div>
    </header>
  );
}
