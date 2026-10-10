"use client";

import { useEffect } from "react";
import { Alert, Button } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <Alert tone="error" title="Something went wrong">
        We could not load this page. Check your connection and try again.
        {error.digest ? <p className="mt-1 text-xs opacity-75">Reference: {error.digest}</p> : null}
      </Alert>
      <Button className="mt-4 w-full sm:w-auto" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
