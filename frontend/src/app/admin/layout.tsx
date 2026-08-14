import { AdminTabs } from "@/components/AdminTabs";
import { AppHeader } from "@/components/AppHeader";
import { RoleGuard } from "@/components/RoleGuard";
import { UserRole } from "@/lib/types";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role={UserRole.Admin}>
      <div className="flex flex-1 flex-col">
        <AppHeader title="Admin Dashboard" />
        <AdminTabs />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </RoleGuard>
  );
}
