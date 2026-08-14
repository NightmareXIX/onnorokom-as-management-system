import { RoleGuard } from "@/components/RoleGuard";
import { UserRole } from "@/lib/types";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard role={UserRole.Admin}>{children}</RoleGuard>;
}
