import { RoleGuard } from "@/components/RoleGuard";
import { UserRole } from "@/lib/types";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard role={UserRole.Teacher}>{children}</RoleGuard>;
}
