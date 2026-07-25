import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { StudentSidebar } from "@/components/student-sidebar";

export default function StudentLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): React.JSX.Element {
  return <AppShell sidebar={<StudentSidebar />}>{children}</AppShell>;
}
