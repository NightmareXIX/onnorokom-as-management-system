import { RoleGuard } from "@/components/RoleGuard";
import { UserRole } from "@/lib/types";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard role={UserRole.Student}>{children}</RoleGuard>;
}
