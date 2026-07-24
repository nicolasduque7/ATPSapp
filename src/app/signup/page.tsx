import { SignupForm } from "@/components/signup-form";

export default function SignupPage(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">CourtSide</h1>
          <p className="text-sm text-muted-foreground">Create your coach account.</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
