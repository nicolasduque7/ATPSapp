"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps): React.JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-3xl bg-card p-6 text-center">
      <p className="text-lg font-bold text-foreground">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        We couldn&apos;t load this page. Try again, or come back in a moment.
      </p>
      <Button variant="secondary" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
