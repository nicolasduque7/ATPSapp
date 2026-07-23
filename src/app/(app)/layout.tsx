import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

export default function AppRouteGroupLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): React.JSX.Element {
  return <AppShell>{children}</AppShell>;
}
