import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireStudent } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";

// Placeholder landing page for a linked student session. The student-facing
// Dashboard/Calendar are separate, not-yet-built phases — this exists only
// so requireCoach() has a real redirect target for non-coach sessions, and
// so the invite/signup/link pipeline has somewhere to prove it worked.
export default async function StudentPage(): Promise<React.JSX.Element> {
  const student = await requireStudent();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">Welcome, {student.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is set up. The student experience is coming soon.
        </p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline" className="w-full">
            <LogOut /> Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
